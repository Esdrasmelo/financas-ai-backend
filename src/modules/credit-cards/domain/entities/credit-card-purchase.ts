export interface CreditCardPurchase {
  id: string;
  creditCardId: string;
  categoryId: string;
  description: string;
  purchaseDate: Date;
  totalAmountCents: number;
  isInstallmentPurchase: boolean;
  totalInstallments: number;
  currentInstallment: number;
  installmentAmountCents: number | null;
  createdAt: Date;
  updatedAt: Date;
}
