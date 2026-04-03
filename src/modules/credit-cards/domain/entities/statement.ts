export type StatementStatus = "open" | "closed" | "paid" | "overdue";

export interface Statement {
  id: string;
  creditCardId: string;
  referenceMonth: string;
  periodStart: Date;
  periodEnd: Date;
  closingDate: Date;
  dueDate: Date;
  status: StatementStatus;
  createdAt: Date;
  updatedAt: Date;
}
