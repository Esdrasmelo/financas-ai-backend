import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { assertDueDay } from "../../domain/value-objects/due-day.js";
import { assertNonNegativeCents } from "../../domain/value-objects/money.js";
import { addMonthsToCompetencyMonth, parseCompetencyMonth } from "../../domain/value-objects/competency-month.js";
import type { FixedExpenseRepository } from "../../domain/repositories/fixed-expense-repository.js";
import type { CategoryRepository } from "../../domain/repositories/category-repository.js";
import type { MonthlyEntryRepository } from "../../domain/repositories/monthly-entry-repository.js";
import { competencyMonthFromDate } from "../../domain/value-objects/competency-month.js";

export function makeListFixedExpenses(repo: FixedExpenseRepository) {
  return (userId: string) => repo.findAll(userId);
}

export function makeCreateFixedExpense(fixedRepo: FixedExpenseRepository, catRepo: CategoryRepository) {
  return async (userId: string, input: {
    name: string;
    description?: string | null;
    amountCents: number;
    categoryId: string;
    dueDay: number;
    isActive?: boolean;
    isRecurringMonthly?: boolean;
    isVariableAmount?: boolean;
  }) => {
    assertNonNegativeCents(input.amountCents, "valor");
    assertDueDay(input.dueDay, "dia de vencimento");
    const category = await catRepo.findById(input.categoryId, userId);
    if (!category) throw new NotFoundError("Category", input.categoryId);
    return fixedRepo.create(userId, input);
  };
}

export function makeUpdateFixedExpense(fixedRepo: FixedExpenseRepository, catRepo: CategoryRepository) {
  return async (
    userId: string,
    id: string,
    input: {
      name?: string;
      description?: string | null;
      amountCents?: number;
      categoryId?: string;
      dueDay?: number;
      isActive?: boolean;
      isRecurringMonthly?: boolean;
      isVariableAmount?: boolean;
    },
  ) => {
    const existing = await fixedRepo.findById(id, userId);
    if (!existing) throw new NotFoundError("FixedExpense", id);
    if (input.amountCents !== undefined) assertNonNegativeCents(input.amountCents, "valor");
    if (input.dueDay !== undefined) assertDueDay(input.dueDay, "dia de vencimento");
    if (input.categoryId !== undefined) {
      const category = await catRepo.findById(input.categoryId, userId);
      if (!category) throw new NotFoundError("Category", input.categoryId);
    }
    return fixedRepo.update(id, userId, input);
  };
}

export function makeDisableFixedExpense(fixedRepo: FixedExpenseRepository) {
  return async (userId: string, id: string) => {
    const existing = await fixedRepo.findById(id, userId);
    if (!existing) throw new NotFoundError("FixedExpense", id);
    return fixedRepo.update(id, userId, { isActive: false });
  };
}

export function makeGenerateMonthlyEntriesFromFixedExpenses(
  fixedRepo: FixedExpenseRepository,
  entriesRepo: MonthlyEntryRepository,
) {
  return async (userId: string, competencyMonthRaw: string) => {
    const competencyMonth = parseCompetencyMonth(competencyMonthRaw);
    const active = await fixedRepo.findActiveRecurring(userId);
    const created: string[] = [];
    const skipped: string[] = [];

    for (const fixedExpense of active) {
      const exists = await entriesRepo.existsForFixedExpenseAndMonth(userId, fixedExpense.id, competencyMonth);
      if (exists) {
        skipped.push(fixedExpense.id);
        continue;
      }
      const day = Math.min(fixedExpense.dueDay, 28);
      const [year, monthNum] = competencyMonth.split("-").map(Number);
      const date = new Date(Date.UTC(year, monthNum - 1, day, 12, 0, 0, 0));

      let amountCents = fixedExpense.amountCents;
      if (fixedExpense.isVariableAmount) {
        const prevMonth = addMonthsToCompetencyMonth(competencyMonth, -1);
        const prevEntry = await entriesRepo.findFixedExpenseEntryForMonth(userId, fixedExpense.id, prevMonth);
        if (prevEntry) {
          amountCents = prevEntry.amountCents;
        }
      }

      await entriesRepo.create(userId, {
        description: fixedExpense.name,
        amountCents,
        date,
        competencyMonth,
        categoryId: fixedExpense.categoryId,
        paymentMethod: "pix",
        sourceType: "fixed_expense",
        fixedExpenseId: fixedExpense.id,
      });
      created.push(fixedExpense.id);
    }

    return { competencyMonth, createdCount: created.length, skippedCount: skipped.length, created, skipped };
  };
}

export function makeRegisterVariableExpense(
  entriesRepo: MonthlyEntryRepository,
  catRepo: CategoryRepository,
) {
  return async (userId: string, input: {
    description: string;
    amountCents: number;
    date: Date;
    categoryId: string;
    paymentMethod: "cash" | "debit" | "pix" | "credit_card";
    competencyMonth?: string;
  }) => {
    assertNonNegativeCents(input.amountCents, "valor");
    const category = await catRepo.findById(input.categoryId, userId);
    if (!category) throw new NotFoundError("Category", input.categoryId);
    const competencyMonth = input.competencyMonth
      ? parseCompetencyMonth(input.competencyMonth)
      : competencyMonthFromDate(input.date);
    return entriesRepo.create(userId, {
      description: input.description,
      amountCents: input.amountCents,
      date: input.date,
      competencyMonth,
      categoryId: input.categoryId,
      paymentMethod: input.paymentMethod,
      sourceType: "variable",
      fixedExpenseId: null,
    });
  };
}

export function makeListMonthlyEntries(entriesRepo: MonthlyEntryRepository) {
  return async (userId: string, competencyMonthRaw: string) => {
    const competencyMonth = parseCompetencyMonth(competencyMonthRaw);
    return entriesRepo.findByCompetencyMonth(userId, competencyMonth);
  };
}

export function makeGetMonthlyEntriesSummary(entriesRepo: MonthlyEntryRepository) {
  return async (userId: string, competencyMonthRaw: string) => {
    const competencyMonth = parseCompetencyMonth(competencyMonthRaw);
    const entries = await entriesRepo.findByCompetencyMonth(userId, competencyMonth);
    let variableCents = 0;
    let fixedCents = 0;
    for (const entry of entries) {
      if (entry.sourceType === "variable") variableCents += entry.amountCents;
      else fixedCents += entry.amountCents;
    }
    const totalCents = variableCents + fixedCents;
    return { competencyMonth, totalCents, variableCents, fixedCents, entryCount: entries.length };
  };
}

export function makeUpdateMonthlyEntry(
  entriesRepo: MonthlyEntryRepository,
  catRepo: CategoryRepository,
) {
  return async (
    userId: string,
    id: string,
    input: {
      description?: string;
      amountCents?: number;
      date?: Date;
      competencyMonth?: string;
      categoryId?: string;
      paymentMethod?: "cash" | "debit" | "pix" | "credit_card";
    },
  ) => {
    const existing = await entriesRepo.findById(id, userId);
    if (!existing) throw new NotFoundError("MonthlyEntry", id);
    if (input.amountCents !== undefined) assertNonNegativeCents(input.amountCents, "valor");
    if (input.competencyMonth !== undefined) parseCompetencyMonth(input.competencyMonth);
    if (input.categoryId !== undefined) {
      const category = await catRepo.findById(input.categoryId, userId);
      if (!category) throw new NotFoundError("Category", input.categoryId);
    }
    return entriesRepo.update(id, userId, {
      ...input,
      competencyMonth: input.competencyMonth ? parseCompetencyMonth(input.competencyMonth) : undefined,
    });
  };
}

export function makeDeleteMonthlyEntry(entriesRepo: MonthlyEntryRepository) {
  return async (userId: string, id: string) => {
    const existing = await entriesRepo.findById(id, userId);
    if (!existing) throw new NotFoundError("MonthlyEntry", id);
    await entriesRepo.delete(id, userId);
  };
}
