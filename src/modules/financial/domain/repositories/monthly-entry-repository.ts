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
  findById(id: string): Promise<MonthlyEntry | null>;
  findByCompetencyMonth(month: string): Promise<MonthlyEntry[]>;
  findFixedExpenseEntryForMonth(
    fixedExpenseId: string,
    competencyMonth: string,
  ): Promise<MonthlyEntry | null>;
  existsForFixedExpenseAndMonth(fixedExpenseId: string, competencyMonth: string): Promise<boolean>;
  create(input: CreateMonthlyEntryInput): Promise<MonthlyEntry>;
  update(id: string, input: UpdateMonthlyEntryInput): Promise<MonthlyEntry>;
  delete(id: string): Promise<void>;
  sumByCompetencyMonth(month: string): Promise<number>;
}
