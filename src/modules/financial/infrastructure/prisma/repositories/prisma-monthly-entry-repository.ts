import type { PrismaClient } from "@prisma/client";
import type {
  CreateMonthlyEntryInput,
  MonthlyEntryRepository,
  UpdateMonthlyEntryInput,
} from "../../../domain/repositories/monthly-entry-repository.js";
import { toMonthlyEntryDomain } from "../mappers/financial-mappers.js";

export class PrismaMonthlyEntryRepository implements MonthlyEntryRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string) {
    const row = await this.db.monthlyEntry.findUnique({ where: { id } });
    return row ? toMonthlyEntryDomain(row) : null;
  }

  async findByCompetencyMonth(month: string) {
    const rows = await this.db.monthlyEntry.findMany({
      where: { competencyMonth: month },
      orderBy: { date: "desc" },
    });
    return rows.map(toMonthlyEntryDomain);
  }

  async findFixedExpenseEntryForMonth(fixedExpenseId: string, competencyMonth: string) {
    const row = await this.db.monthlyEntry.findFirst({
      where: {
        fixedExpenseId,
        competencyMonth,
        sourceType: "fixed_expense",
      },
    });
    return row ? toMonthlyEntryDomain(row) : null;
  }

  async existsForFixedExpenseAndMonth(fixedExpenseId: string, competencyMonth: string) {
    const count = await this.db.monthlyEntry.count({
      where: { fixedExpenseId, competencyMonth },
    });
    return count > 0;
  }

  async create(input: CreateMonthlyEntryInput) {
    const row = await this.db.monthlyEntry.create({
      data: {
        description: input.description,
        amountCents: input.amountCents,
        date: input.date,
        competencyMonth: input.competencyMonth,
        categoryId: input.categoryId,
        paymentMethod: input.paymentMethod,
        sourceType: input.sourceType,
        fixedExpenseId: input.fixedExpenseId ?? null,
      },
    });
    return toMonthlyEntryDomain(row);
  }

  async update(id: string, input: UpdateMonthlyEntryInput) {
    const row = await this.db.monthlyEntry.update({
      where: { id },
      data: {
        ...(input.description !== undefined && { description: input.description }),
        ...(input.amountCents !== undefined && { amountCents: input.amountCents }),
        ...(input.date !== undefined && { date: input.date }),
        ...(input.competencyMonth !== undefined && { competencyMonth: input.competencyMonth }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod }),
      },
    });
    return toMonthlyEntryDomain(row);
  }

  async delete(id: string) {
    await this.db.monthlyEntry.delete({ where: { id } });
  }

  async sumByCompetencyMonth(month: string) {
    const agg = await this.db.monthlyEntry.aggregate({
      where: { competencyMonth: month },
      _sum: { amountCents: true },
    });
    return agg._sum.amountCents ?? 0;
  }
}
