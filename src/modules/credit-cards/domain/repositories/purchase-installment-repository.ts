import type { PurchaseInstallment } from "../entities/purchase-installment.js";

export interface CreatePurchaseInstallmentInput {
  purchaseId: string;
  statementId: string;
  installmentNumber: number;
  totalInstallments: number;
  amountCents: number;
  competencyMonth: string;
  status?: "pending" | "paid";
}

export interface PurchaseInstallmentRepository {
  createMany(inputs: CreatePurchaseInstallmentInput[]): Promise<void>;
  findByStatementId(statementId: string): Promise<PurchaseInstallment[]>;
  sumPendingByStatementId(statementId: string): Promise<number>;
  findFuturePending(fromCompetencyMonth: string): Promise<PurchaseInstallment[]>;
}
