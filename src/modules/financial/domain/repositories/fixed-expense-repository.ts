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
  findAll(): Promise<FixedExpense[]>;
  findById(id: string): Promise<FixedExpense | null>;
  findActiveRecurring(): Promise<FixedExpense[]>;
  create(input: CreateFixedExpenseInput): Promise<FixedExpense>;
  update(id: string, input: UpdateFixedExpenseInput): Promise<FixedExpense>;
}
