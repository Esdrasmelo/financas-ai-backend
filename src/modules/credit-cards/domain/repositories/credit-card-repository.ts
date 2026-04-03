import type { CreditCard } from "../entities/credit-card.js";

export interface CreateCreditCardInput {
  name: string;
  brand?: string | null;
  limitCents?: number | null;
  closingDay: number;
  dueDay: number;
  isActive?: boolean;
}

export interface UpdateCreditCardInput {
  name?: string;
  brand?: string | null;
  limitCents?: number | null;
  closingDay?: number;
  dueDay?: number;
  isActive?: boolean;
}

export interface CreditCardRepository {
  findAll(): Promise<CreditCard[]>;
  findById(id: string): Promise<CreditCard | null>;
  create(input: CreateCreditCardInput): Promise<CreditCard>;
  update(id: string, input: UpdateCreditCardInput): Promise<CreditCard>;
}
