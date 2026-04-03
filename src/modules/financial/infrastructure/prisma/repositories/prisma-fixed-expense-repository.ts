import type { PrismaClient } from "@prisma/client";
import type {
  CreateFixedExpenseInput,
  FixedExpenseRepository,
  UpdateFixedExpenseInput,
} from "../../../domain/repositories/fixed-expense-repository.js";
import { toFixedExpenseDomain } from "../mappers/financial-mappers.js";

export class PrismaFixedExpenseRepository implements FixedExpenseRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll() {
    const rows = await this.db.fixedExpense.findMany({ orderBy: { name: "asc" } });
    return rows.map(toFixedExpenseDomain);
  }

  async findById(id: string) {
    const row = await this.db.fixedExpense.findUnique({ where: { id } });
    return row ? toFixedExpenseDomain(row) : null;
  }

  async findActiveRecurring() {
    const rows = await this.db.fixedExpense.findMany({
      where: { isActive: true, isRecurringMonthly: true },
    });
    return rows.map(toFixedExpenseDomain);
  }

  async create(input: CreateFixedExpenseInput) {
    const row = await this.db.fixedExpense.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        amountCents: input.amountCents,
        categoryId: input.categoryId,
        dueDay: input.dueDay,
        isActive: input.isActive ?? true,
        isRecurringMonthly: input.isRecurringMonthly ?? true,
        isVariableAmount: input.isVariableAmount ?? false,
      },
    });
    return toFixedExpenseDomain(row);
  }

  async update(id: string, input: UpdateFixedExpenseInput) {
    const row = await this.db.fixedExpense.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.amountCents !== undefined && { amountCents: input.amountCents }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.dueDay !== undefined && { dueDay: input.dueDay }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.isRecurringMonthly !== undefined && { isRecurringMonthly: input.isRecurringMonthly }),
        ...(input.isVariableAmount !== undefined && { isVariableAmount: input.isVariableAmount }),
      },
    });
    return toFixedExpenseDomain(row);
  }
}
