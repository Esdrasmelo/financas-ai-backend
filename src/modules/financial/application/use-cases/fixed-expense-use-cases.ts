import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { assertDueDay } from "../../domain/value-objects/due-day.js";
import { assertNonNegativeCents } from "../../domain/value-objects/money.js";
import { addMonthsToCompetencyMonth, parseCompetencyMonth } from "../../domain/value-objects/competency-month.js";
import type { FixedExpenseRepository } from "../../domain/repositories/fixed-expense-repository.js";
import type { CategoryRepository } from "../../domain/repositories/category-repository.js";
import type { MonthlyEntryRepository } from "../../domain/repositories/monthly-entry-repository.js";
import { competencyMonthFromDate } from "../../domain/value-objects/competency-month.js";

export function makeListFixedExpenses(repo: FixedExpenseRepository) {
  return () => repo.findAll();
}

export function makeCreateFixedExpense(fixedRepo: FixedExpenseRepository, catRepo: CategoryRepository) {
  return async (input: {
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
    const cat = await catRepo.findById(input.categoryId);
    if (!cat) throw new NotFoundError("Category", input.categoryId);
    return fixedRepo.create(input);
  };
}

export function makeUpdateFixedExpense(fixedRepo: FixedExpenseRepository, catRepo: CategoryRepository) {
  return async (
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
    const existing = await fixedRepo.findById(id);
    if (!existing) throw new NotFoundError("FixedExpense", id);
    if (input.amountCents !== undefined) assertNonNegativeCents(input.amountCents, "valor");
    if (input.dueDay !== undefined) assertDueDay(input.dueDay, "dia de vencimento");
    if (input.categoryId !== undefined) {
      const cat = await catRepo.findById(input.categoryId);
      if (!cat) throw new NotFoundError("Category", input.categoryId);
    }
    return fixedRepo.update(id, input);
  };
}

export function makeDisableFixedExpense(fixedRepo: FixedExpenseRepository) {
  return async (id: string) => {
    const existing = await fixedRepo.findById(id);
    if (!existing) throw new NotFoundError("FixedExpense", id);
    return fixedRepo.update(id, { isActive: false });
  };
}

export function makeGenerateMonthlyEntriesFromFixedExpenses(
  fixedRepo: FixedExpenseRepository,
  entriesRepo: MonthlyEntryRepository,
) {
  return async (competencyMonthRaw: string) => {
    const competencyMonth = parseCompetencyMonth(competencyMonthRaw);
    const active = await fixedRepo.findActiveRecurring();
    const created: string[] = [];
    const skipped: string[] = [];

    for (const fe of active) {
      const exists = await entriesRepo.existsForFixedExpenseAndMonth(fe.id, competencyMonth);
      if (exists) {
        skipped.push(fe.id);
        continue;
      }
      const day = Math.min(fe.dueDay, 28);
      const [y, m] = competencyMonth.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, day, 12, 0, 0, 0));

      let amountCents = fe.amountCents;
      if (fe.isVariableAmount) {
        const prevMonth = addMonthsToCompetencyMonth(competencyMonth, -1);
        const prevEntry = await entriesRepo.findFixedExpenseEntryForMonth(fe.id, prevMonth);
        if (prevEntry) {
          amountCents = prevEntry.amountCents;
        }
      }

      await entriesRepo.create({
        description: fe.name,
        amountCents,
        date,
        competencyMonth,
        categoryId: fe.categoryId,
        paymentMethod: "pix",
        sourceType: "fixed_expense",
        fixedExpenseId: fe.id,
      });
      created.push(fe.id);
    }

    return { competencyMonth, createdCount: created.length, skippedCount: skipped.length, created, skipped };
  };
}

export function makeRegisterVariableExpense(
  entriesRepo: MonthlyEntryRepository,
  catRepo: CategoryRepository,
) {
  return async (input: {
    description: string;
    amountCents: number;
    date: Date;
    categoryId: string;
    paymentMethod: "cash" | "debit" | "pix" | "credit_card";
    competencyMonth?: string;
  }) => {
    assertNonNegativeCents(input.amountCents, "valor");
    const cat = await catRepo.findById(input.categoryId);
    if (!cat) throw new NotFoundError("Category", input.categoryId);
    const competencyMonth = input.competencyMonth
      ? parseCompetencyMonth(input.competencyMonth)
      : competencyMonthFromDate(input.date);
    return entriesRepo.create({
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
  return async (competencyMonthRaw: string) => {
    const competencyMonth = parseCompetencyMonth(competencyMonthRaw);
    return entriesRepo.findByCompetencyMonth(competencyMonth);
  };
}

export function makeGetMonthlyEntriesSummary(entriesRepo: MonthlyEntryRepository) {
  return async (competencyMonthRaw: string) => {
    const competencyMonth = parseCompetencyMonth(competencyMonthRaw);
    const entries = await entriesRepo.findByCompetencyMonth(competencyMonth);
    let variableCents = 0;
    let fixedCents = 0;
    for (const e of entries) {
      if (e.sourceType === "variable") variableCents += e.amountCents;
      else fixedCents += e.amountCents;
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
    const existing = await entriesRepo.findById(id);
    if (!existing) throw new NotFoundError("MonthlyEntry", id);
    if (input.amountCents !== undefined) assertNonNegativeCents(input.amountCents, "valor");
    if (input.competencyMonth !== undefined) parseCompetencyMonth(input.competencyMonth);
    if (input.categoryId !== undefined) {
      const cat = await catRepo.findById(input.categoryId);
      if (!cat) throw new NotFoundError("Category", input.categoryId);
    }
    return entriesRepo.update(id, {
      ...input,
      competencyMonth: input.competencyMonth ? parseCompetencyMonth(input.competencyMonth) : undefined,
    });
  };
}

export function makeDeleteMonthlyEntry(entriesRepo: MonthlyEntryRepository) {
  return async (id: string) => {
    const existing = await entriesRepo.findById(id);
    if (!existing) throw new NotFoundError("MonthlyEntry", id);
    await entriesRepo.delete(id);
  };
}
