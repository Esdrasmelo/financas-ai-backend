export type PaymentMethod = "cash" | "debit" | "pix" | "credit_card";
export type MonthlyEntrySourceType = "variable" | "fixed_expense";

export interface MonthlyEntry {
  id: string;
  description: string;
  amountCents: number;
  date: Date;
  competencyMonth: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  sourceType: MonthlyEntrySourceType;
  fixedExpenseId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
