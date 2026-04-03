import type { PrismaClient } from "@prisma/client";
import type {
  CreateCreditCardPurchaseInput,
  CreditCardPurchaseRepository,
} from "../../../domain/repositories/credit-card-purchase-repository.js";
import { toPurchaseDomain } from "../mappers/credit-mappers.js";

export class PrismaCreditCardPurchaseRepository implements CreditCardPurchaseRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string) {
    const row = await this.db.creditCardPurchase.findUnique({ where: { id } });
    return row ? toPurchaseDomain(row) : null;
  }

  async findAll(filters?: { creditCardId?: string }) {
    const rows = await this.db.creditCardPurchase.findMany({
      where: filters?.creditCardId ? { creditCardId: filters.creditCardId } : undefined,
      orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toPurchaseDomain);
  }

  async create(input: CreateCreditCardPurchaseInput) {
    const row = await this.db.creditCardPurchase.create({
      data: {
        creditCardId: input.creditCardId,
        categoryId: input.categoryId,
        description: input.description,
        purchaseDate: input.purchaseDate,
        totalAmountCents: input.totalAmountCents,
        isInstallmentPurchase: input.isInstallmentPurchase,
        totalInstallments: input.totalInstallments,
        currentInstallment: input.currentInstallment,
        installmentAmountCents: input.installmentAmountCents,
      },
    });
    return toPurchaseDomain(row);
  }
}
