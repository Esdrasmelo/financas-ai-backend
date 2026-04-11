import type { MonthlyEntry, MonthlyEntrySourceType, PaymentMethod } from "../entities/monthly-entry.js";

export interface CreateMonthlyEntryInput {
  description: string;
  amountCents: number;
  date: Date;
  competencyMonth: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  sourceType: MonthlyEntrySourceType;
  fixedExpenseId?: string | null;
}

export interface UpdateMonthlyEntryInput {
  description?: string;
  amountCents?: number;
  date?: Date;
  competencyMonth?: string;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
}

export interface MonthlyEntryRepository {
  findById(id: string, userId: string): Promise<MonthlyEntry | null>;
  findByCompetencyMonth(userId: string, month: string): Promise<MonthlyEntry[]>;
  findFixedExpenseEntryForMonth(
    userId: string,
    fixedExpenseId: string,
    competencyMonth: string,
  ): Promise<MonthlyEntry | null>;
  existsForFixedExpenseAndMonth(userId: string, fixedExpenseId: string, competencyMonth: string): Promise<boolean>;
  create(userId: string, input: CreateMonthlyEntryInput): Promise<MonthlyEntry>;
  update(id: string, userId: string, input: UpdateMonthlyEntryInput): Promise<MonthlyEntry>;
  delete(id: string, userId: string): Promise<void>;
  sumByCompetencyMonth(userId: string, month: string): Promise<number>;
}
