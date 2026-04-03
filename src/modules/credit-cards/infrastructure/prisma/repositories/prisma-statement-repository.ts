import type { PrismaClient, StatementStatus as PStatus } from "@prisma/client";
import type {
  CreateStatementInput,
  StatementRepository,
} from "../../../domain/repositories/statement-repository.js";
import type { StatementStatus } from "../../../domain/entities/statement.js";
import { toStatementDomain } from "../mappers/credit-mappers.js";

export class PrismaStatementRepository implements StatementRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string) {
    const row = await this.db.statement.findUnique({ where: { id } });
    return row ? toStatementDomain(row) : null;
  }

  async findByCardAndReferenceMonth(cardId: string, referenceMonth: string) {
    const row = await this.db.statement.findUnique({
      where: { creditCardId_referenceMonth: { creditCardId: cardId, referenceMonth } },
    });
    return row ? toStatementDomain(row) : null;
  }

  async findByCreditCardId(cardId: string) {
    const rows = await this.db.statement.findMany({
      where: { creditCardId: cardId },
      orderBy: { referenceMonth: "asc" },
    });
    return rows.map(toStatementDomain);
  }

  async listAll(filters?: { creditCardId?: string }) {
    const rows = await this.db.statement.findMany({
      where: filters?.creditCardId ? { creditCardId: filters.creditCardId } : undefined,
      orderBy: [{ referenceMonth: "asc" }],
    });
    return rows.map(toStatementDomain);
  }

  async create(input: CreateStatementInput) {
    const row = await this.db.statement.create({
      data: {
        creditCardId: input.creditCardId,
        referenceMonth: input.referenceMonth,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        closingDate: input.closingDate,
        dueDate: input.dueDate,
        status: (input.status ?? "open") as PStatus,
      },
    });
    return toStatementDomain(row);
  }

  async updateStatus(id: string, status: StatementStatus) {
    const row = await this.db.statement.update({
      where: { id },
      data: { status: status as PStatus },
    });
    return toStatementDomain(row);
  }
}
