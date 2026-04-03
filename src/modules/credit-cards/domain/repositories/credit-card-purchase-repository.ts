import type { CreditCardPurchase } from "../entities/credit-card-purchase.js";

export interface CreateCreditCardPurchaseInput {
  creditCardId: string;
  categoryId: string;
  description: string;
  purchaseDate: Date;
  totalAmountCents: number;
  isInstallmentPurchase: boolean;
  totalInstallments: number;
  currentInstallment: number;
  installmentAmountCents: number | null;
}

export interface CreditCardPurchaseRepository {
  findById(id: string): Promise<CreditCardPurchase | null>;
  findAll(filters?: { creditCardId?: string }): Promise<CreditCardPurchase[]>;
  create(input: CreateCreditCardPurchaseInput): Promise<CreditCardPurchase>;
}
