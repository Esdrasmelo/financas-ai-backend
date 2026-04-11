import type { PrismaClient } from "@prisma/client";
import type {
  CreateMonthlyEntryInput,
  MonthlyEntryRepository,
  UpdateMonthlyEntryInput,
} from "../../../domain/repositories/monthly-entry-repository.js";
import { toMonthlyEntryDomain } from "../mappers/financial-mappers.js";

export class PrismaMonthlyEntryRepository implements MonthlyEntryRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string, userId: string) {
    const row = await this.db.monthlyEntry.findFirst({ where: { id, userId } });
    return row ? toMonthlyEntryDomain(row) : null;
  }

  async findByCompetencyMonth(userId: string, month: string) {
    const rows = await this.db.monthlyEntry.findMany({
      where: { userId, competencyMonth: month },
      orderBy: { date: "desc" },
    });
    return rows.map(toMonthlyEntryDomain);
  }

  async findFixedExpenseEntryForMonth(userId: string, fixedExpenseId: string, competencyMonth: string) {
    const row = await this.db.monthlyEntry.findFirst({
      where: {
        userId,
        fixedExpenseId,
        competencyMonth,
        sourceType: "fixed_expense",
      },
    });
    return row ? toMonthlyEntryDomain(row) : null;
  }

  async existsForFixedExpenseAndMonth(userId: string, fixedExpenseId: string, competencyMonth: string) {
    const count = await this.db.monthlyEntry.count({
      where: { userId, fixedExpenseId, competencyMonth },
    });
    return count > 0;
  }

  async create(userId: string, input: CreateMonthlyEntryInput) {
    const row = await this.db.monthlyEntry.create({
      data: {
        userId,
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

  async update(id: string, _userId: string, input: UpdateMonthlyEntryInput) {
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

  async delete(id: string, _userId: string) {
    await this.db.monthlyEntry.delete({ where: { id } });
  }

  async sumByCompetencyMonth(userId: string, month: string) {
    const agg = await this.db.monthlyEntry.aggregate({
      where: { userId, competencyMonth: month },
      _sum: { amountCents: true },
    });
    return agg._sum.amountCents ?? 0;
  }
}
