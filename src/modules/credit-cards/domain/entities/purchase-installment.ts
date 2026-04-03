export type InstallmentStatus = "pending" | "paid";

export interface PurchaseInstallment {
  id: string;
  purchaseId: string;
  statementId: string;
  installmentNumber: number;
  totalInstallments: number;
  amountCents: number;
  competencyMonth: string;
  status: InstallmentStatus;
  createdAt: Date;
  updatedAt: Date;
}
