export interface FixedExpense {
  id: string;
  name: string;
  description: string | null;
  /** Valor fixo ou referência quando `isVariableAmount` */
  amountCents: number;
  isVariableAmount: boolean;
  categoryId: string;
  dueDay: number;
  isActive: boolean;
  isRecurringMonthly: boolean;
  createdAt: Date;
  updatedAt: Date;
}
