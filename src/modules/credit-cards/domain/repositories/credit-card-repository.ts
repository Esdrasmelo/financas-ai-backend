import type { CreditCard } from "../entities/credit-card.js";

export interface CreateCreditCardInput {
  name: string;
  brand?: string | null;
  themeColor?: string | null;
  limitCents?: number | null;
  closingDay: number;
  dueDay: number;
  isActive?: boolean;
}

export interface UpdateCreditCardInput {
  name?: string;
  brand?: string | null;
  themeColor?: string | null;
  limitCents?: number | null;
  closingDay?: number;
  dueDay?: number;
  isActive?: boolean;
}

export interface CreditCardRepository {
  findAll(userId: string): Promise<CreditCard[]>;
  findById(id: string, userId: string): Promise<CreditCard | null>;
  create(userId: string, input: CreateCreditCardInput): Promise<CreditCard>;
  update(id: string, userId: string, input: UpdateCreditCardInput): Promise<CreditCard>;
}
