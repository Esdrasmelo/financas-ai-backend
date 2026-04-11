import type { PrismaClient } from "@prisma/client";
import type {
  CreateCreditCardInput,
  CreditCardRepository,
  UpdateCreditCardInput,
} from "../../../domain/repositories/credit-card-repository.js";
import { toCreditCardDomain } from "../mappers/credit-mappers.js";

export class PrismaCreditCardRepository implements CreditCardRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(userId: string) {
    const rows = await this.db.creditCard.findMany({ where: { userId }, orderBy: { name: "asc" } });
    return rows.map(toCreditCardDomain);
  }

  async findById(id: string, userId: string) {
    const row = await this.db.creditCard.findFirst({ where: { id, userId } });
    return row ? toCreditCardDomain(row) : null;
  }

  async create(userId: string, input: CreateCreditCardInput) {
    const row = await this.db.creditCard.create({
      data: {
        userId,
        name: input.name,
        brand: input.brand ?? null,
        themeColor: input.themeColor ?? null,
        limitCents: input.limitCents ?? null,
        closingDay: input.closingDay,
        dueDay: input.dueDay,
        isActive: input.isActive ?? true,
      },
    });
    return toCreditCardDomain(row);
  }

  async update(id: string, _userId: string, input: UpdateCreditCardInput) {
    const row = await this.db.creditCard.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.brand !== undefined && { brand: input.brand }),
        ...(input.themeColor !== undefined && { themeColor: input.themeColor }),
        ...(input.limitCents !== undefined && { limitCents: input.limitCents }),
        ...(input.closingDay !== undefined && { closingDay: input.closingDay }),
        ...(input.dueDay !== undefined && { dueDay: input.dueDay }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    return toCreditCardDomain(row);
  }
}
