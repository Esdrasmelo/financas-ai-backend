export interface CreditCardPurchase {
  id: string;
  creditCardId: string;
  categoryId: string;
  description: string;
  purchaseDate: Date;
  totalAmountCents: number;
  /** Estorno/crédito do cartão: `totalAmountCents` é negativo e a compra tem parcela única. */
  isRefund: boolean;
  isInstallmentPurchase: boolean;
  totalInstallments: number;
  currentInstallment: number;
  installmentAmountCents: number | null;
  createdAt: Date;
  updatedAt: Date;
}
