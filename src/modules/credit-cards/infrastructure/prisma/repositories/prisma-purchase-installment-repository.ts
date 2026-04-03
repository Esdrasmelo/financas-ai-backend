import type { PrismaClient } from "@prisma/client";
import type {
  CreatePurchaseInstallmentInput,
  PurchaseInstallmentRepository,
} from "../../../domain/repositories/purchase-installment-repository.js";
import { toInstallmentDomain } from "../mappers/credit-mappers.js";

export class PrismaPurchaseInstallmentRepository implements PurchaseInstallmentRepository {
  constructor(private readonly db: PrismaClient) {}

  async createMany(inputs: CreatePurchaseInstallmentInput[]) {
    if (inputs.length === 0) return;
    await this.db.purchaseInstallment.createMany({
      data: inputs.map((i) => ({
        purchaseId: i.purchaseId,
        statementId: i.statementId,
        installmentNumber: i.installmentNumber,
        totalInstallments: i.totalInstallments,
        amountCents: i.amountCents,
        competencyMonth: i.competencyMonth,
        status: i.status ?? "pending",
      })),
    });
  }

  async findByStatementId(statementId: string) {
    const rows = await this.db.purchaseInstallment.findMany({
      where: { statementId },
      orderBy: { installmentNumber: "asc" },
    });
    return rows.map(toInstallmentDomain);
  }

  async sumPendingByStatementId(statementId: string) {
    const agg = await this.db.purchaseInstallment.aggregate({
      where: { statementId, status: "pending" },
      _sum: { amountCents: true },
    });
    return agg._sum.amountCents ?? 0;
  }

  async findFuturePending(fromCompetencyMonth: string) {
    const rows = await this.db.purchaseInstallment.findMany({
      where: {
        status: "pending",
        competencyMonth: { gte: fromCompetencyMonth },
      },
      orderBy: [{ competencyMonth: "asc" }, { installmentNumber: "asc" }],
    });
    return rows.map(toInstallmentDomain);
  }
}
