import type { FixedExpense } from "../entities/fixed-expense.js";

export interface CreateFixedExpenseInput {
  name: string;
  description?: string | null;
  amountCents: number;
  isVariableAmount?: boolean;
  categoryId: string;
  dueDay: number;
  isActive?: boolean;
  isRecurringMonthly?: boolean;
}

export interface UpdateFixedExpenseInput {
  name?: string;
  description?: string | null;
  amountCents?: number;
  isVariableAmount?: boolean;
  categoryId?: string;
  dueDay?: number;
  isActive?: boolean;
  isRecurringMonthly?: boolean;
}

export interface FixedExpenseRepository {
  findAll(userId: string): Promise<FixedExpense[]>;
  findById(id: string, userId: string): Promise<FixedExpense | null>;
  findActiveRecurring(userId: string): Promise<FixedExpense[]>;
  create(userId: string, input: CreateFixedExpenseInput): Promise<FixedExpense>;
  update(id: string, userId: string, input: UpdateFixedExpenseInput): Promise<FixedExpense>;
}
