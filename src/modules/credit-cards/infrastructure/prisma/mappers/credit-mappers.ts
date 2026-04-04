import type {
  CreditCard as PCard,
  Statement as PStmt,
  CreditCardPurchase as PPur,
  PurchaseInstallment as PIns,
} from "@prisma/client";
import type { CreditCard } from "../../../domain/entities/credit-card.js";
import type { Statement } from "../../../domain/entities/statement.js";
import type { CreditCardPurchase } from "../../../domain/entities/credit-card-purchase.js";
import type { PurchaseInstallment } from "../../../domain/entities/purchase-installment.js";

export function toCreditCardDomain(row: PCard): CreditCard {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    themeColor: row.themeColor,
    limitCents: row.limitCents,
    closingDay: row.closingDay,
    dueDay: row.dueDay,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toStatementDomain(row: PStmt): Statement {
  return {
    id: row.id,
    creditCardId: row.creditCardId,
    referenceMonth: row.referenceMonth,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    closingDate: row.closingDate,
    dueDate: row.dueDate,
    status: row.status as Statement["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPurchaseDomain(row: PPur): CreditCardPurchase {
  return {
    id: row.id,
    creditCardId: row.creditCardId,
    categoryId: row.categoryId,
    description: row.description,
    purchaseDate: row.purchaseDate,
    totalAmountCents: row.totalAmountCents,
    isInstallmentPurchase: row.isInstallmentPurchase,
    totalInstallments: row.totalInstallments,
    currentInstallment: row.currentInstallment,
    installmentAmountCents: row.installmentAmountCents,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toInstallmentDomain(row: PIns): PurchaseInstallment {
  return {
    id: row.id,
    purchaseId: row.purchaseId,
    statementId: row.statementId,
    installmentNumber: row.installmentNumber,
    totalInstallments: row.totalInstallments,
    amountCents: row.amountCents,
    competencyMonth: row.competencyMonth,
    status: row.status as PurchaseInstallment["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
