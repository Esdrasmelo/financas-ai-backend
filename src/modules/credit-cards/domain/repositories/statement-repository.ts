import type { Statement, StatementStatus } from "../entities/statement.js";

export interface CreateStatementInput {
  creditCardId: string;
  referenceMonth: string;
  periodStart: Date;
  periodEnd: Date;
  closingDate: Date;
  dueDate: Date;
  status?: StatementStatus;
}

export interface StatementRepository {
  findById(id: string): Promise<Statement | null>;
  findByCardAndReferenceMonth(cardId: string, referenceMonth: string): Promise<Statement | null>;
  findByCreditCardId(cardId: string): Promise<Statement[]>;
  listAll(filters: { userId: string; creditCardId?: string }): Promise<Statement[]>;
  create(input: CreateStatementInput): Promise<Statement>;
  updateStatus(id: string, status: StatementStatus): Promise<Statement>;
}
