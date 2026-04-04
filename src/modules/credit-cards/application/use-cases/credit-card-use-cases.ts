import { NotFoundError, ValidationError } from "../../../../shared/domain/errors/domain-error.js";
import { assertDueDay } from "../../../financial/domain/value-objects/due-day.js";
import { assertNonNegativeCents } from "../../../financial/domain/value-objects/money.js";
import type { CategoryRepository } from "../../../financial/domain/repositories/category-repository.js";
import type { CreditCardRepository } from "../../domain/repositories/credit-card-repository.js";
import type { StatementRepository } from "../../domain/repositories/statement-repository.js";
import type { CreditCardPurchaseRepository } from "../../domain/repositories/credit-card-purchase-repository.js";
import type { PurchaseInstallmentRepository } from "../../domain/repositories/purchase-installment-repository.js";
import {
  closingDateForReferenceMonth,
  dueDateForReferenceMonth,
  installmentClosingReferenceMonth,
  periodBoundsForReferenceMonth,
  purchaseToClosingReferenceMonth,
  resolvePurchaseTotalAndInstallmentMode,
  splitInstallmentCents,
} from "../../domain/services/statement-cycle.js";
import type { CreditCard } from "../../domain/entities/credit-card.js";
import type { CreditCardPurchase } from "../../domain/entities/credit-card-purchase.js";
import type { PrismaClient } from "@prisma/client";

type InstallmentPreviewRow = {
  referenceMonth: string;
  amountCents: number;
  installmentNumber: number;
  dueDate: string;
};

type TxClient = Pick<PrismaClient, "statement" | "purchaseInstallment">;

function sameUtcCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function structuralPurchaseEquals(
  existing: CreditCardPurchase,
  input: {
    purchaseDate: Date;
    totalAmountCents: number;
    isInstallmentPurchase: boolean;
    totalInstallments: number;
    currentInstallment: number;
  },
): boolean {
  return (
    existing.totalAmountCents === input.totalAmountCents &&
    existing.isInstallmentPurchase === input.isInstallmentPurchase &&
    existing.totalInstallments === input.totalInstallments &&
    existing.currentInstallment === input.currentInstallment &&
    sameUtcCalendarDay(existing.purchaseDate, input.purchaseDate)
  );
}

async function createInstallmentsForPurchaseTx(
  tx: TxClient,
  params: {
    purchaseId: string;
    creditCardId: string;
    purchaseDate: Date;
    totalAmountCents: number;
    totalInstallments: number;
    currentInstallment: number;
    card: CreditCard;
    equalInstallmentCents?: number;
  },
): Promise<InstallmentPreviewRow[]> {
  const amounts =
    params.equalInstallmentCents != null
      ? Array.from({ length: params.totalInstallments }, () => params.equalInstallmentCents!)
      : splitInstallmentCents(params.totalAmountCents, params.totalInstallments);
  const firstClosingRef = purchaseToClosingReferenceMonth(params.purchaseDate, params.card.closingDay);
  const preview: InstallmentPreviewRow[] = [];
  const installmentRows: {
    purchaseId: string;
    statementId: string;
    installmentNumber: number;
    totalInstallments: number;
    amountCents: number;
    competencyMonth: string;
  }[] = [];

  for (let i = params.currentInstallment; i <= params.totalInstallments; i++) {
    const refMonth = installmentClosingReferenceMonth(firstClosingRef, i);
    const dueDate = dueDateForReferenceMonth(refMonth, params.card.dueDay, params.card.closingDay);
    preview.push({
      referenceMonth: refMonth,
      amountCents: amounts[i - 1]!,
      installmentNumber: i,
      dueDate: dueDate.toISOString(),
    });

    const { periodStart, periodEnd } = periodBoundsForReferenceMonth(refMonth, params.card.closingDay);
    const closingDate = closingDateForReferenceMonth(refMonth, params.card.closingDay);

    let statementRow = await tx.statement.findUnique({
      where: {
        creditCardId_referenceMonth: {
          creditCardId: params.creditCardId,
          referenceMonth: refMonth,
        },
      },
    });
    if (!statementRow) {
      statementRow = await tx.statement.create({
        data: {
          creditCardId: params.creditCardId,
          referenceMonth: refMonth,
          periodStart,
          periodEnd,
          closingDate,
          dueDate,
          status: "open",
        },
      });
    }

    installmentRows.push({
      purchaseId: params.purchaseId,
      statementId: statementRow.id,
      installmentNumber: i,
      totalInstallments: params.totalInstallments,
      amountCents: amounts[i - 1]!,
      competencyMonth: refMonth,
    });
  }

  if (installmentRows.length > 0) {
    await tx.purchaseInstallment.createMany({ data: installmentRows });
  }

  return preview;
}

export function makeListCreditCards(repo: CreditCardRepository) {
  return () => repo.findAll();
}

export function makeGetCreditCard(repo: CreditCardRepository) {
  return async (id: string) => {
    const creditCard = await repo.findById(id);
    if (!creditCard) throw new NotFoundError("CreditCard", id);
    return creditCard;
  };
}

export function makeCreateCreditCard(repo: CreditCardRepository) {
  return (input: {
    name: string;
    brand?: string | null;
    themeColor?: string | null;
    limitCents?: number | null;
    closingDay: number;
    dueDay: number;
    isActive?: boolean;
  }) => {
    assertDueDay(input.closingDay, "dia de fechamento");
    assertDueDay(input.dueDay, "dia de vencimento");
    return repo.create(input);
  };
}

export function makeUpdateCreditCard(repo: CreditCardRepository) {
  return async (
    id: string,
    input: {
      name?: string;
      brand?: string | null;
      themeColor?: string | null;
      limitCents?: number | null;
      closingDay?: number;
      dueDay?: number;
      isActive?: boolean;
    },
  ) => {
    const creditCard = await repo.findById(id);
    if (!creditCard) throw new NotFoundError("CreditCard", id);
    if (input.closingDay !== undefined) assertDueDay(input.closingDay, "dia de fechamento");
    if (input.dueDay !== undefined) assertDueDay(input.dueDay, "dia de vencimento");
    return repo.update(id, input);
  };
}

export function makeEstimateStatementCycle() {
  return (input: { purchaseDate: Date; closingDay: number; dueDay: number; installmentNumber?: number }) => {
    const firstRef = purchaseToClosingReferenceMonth(input.purchaseDate, input.closingDay);
    const activeInstallmentNumber = input.installmentNumber ?? 1;
    const referenceMonth = installmentClosingReferenceMonth(firstRef, activeInstallmentNumber);
    const { periodStart, periodEnd } = periodBoundsForReferenceMonth(referenceMonth, input.closingDay);
    const closingDate = closingDateForReferenceMonth(referenceMonth, input.closingDay);
    const dueDate = dueDateForReferenceMonth(referenceMonth, input.dueDay, input.closingDay);
    return {
      referenceMonth,
      firstInstallmentReferenceMonth: firstRef,
      installmentNumber: activeInstallmentNumber,
      periodStart,
      periodEnd,
      closingDate,
      dueDate,
    };
  };
}

export function makeRegisterCreditCardPurchase(
  db: PrismaClient,
  cardRepo: CreditCardRepository,
  catRepo: CategoryRepository,
  purRepo: CreditCardPurchaseRepository,
) {
  return async (input: {
    creditCardId: string;
    categoryId: string;
    description: string;
    purchaseDate: Date;
    totalAmountCents: number;
    isInstallmentPurchase: boolean;
    totalInstallments: number;
    currentInstallment: number;
    installmentAmountCents?: number | null;
  }) => {
    const creditCard = await cardRepo.findById(input.creditCardId);
    if (!creditCard) throw new NotFoundError("CreditCard", input.creditCardId);
    const category = await catRepo.findById(input.categoryId);
    if (!category) throw new NotFoundError("Category", input.categoryId);

    let effectiveTotalInstallments = input.totalInstallments;
    let effectiveCurrentInstallment = input.currentInstallment;
    if (!input.isInstallmentPurchase) {
      effectiveTotalInstallments = 1;
      effectiveCurrentInstallment = 1;
    }
    if (effectiveTotalInstallments < 1) throw new ValidationError("total de parcelas deve ser >= 1");
    if (effectiveCurrentInstallment < 1 || effectiveCurrentInstallment > effectiveTotalInstallments) {
      throw new ValidationError("parcela atual inválida");
    }

    const resolved = resolvePurchaseTotalAndInstallmentMode({
      isInstallmentPurchase: input.isInstallmentPurchase,
      totalInstallments: effectiveTotalInstallments,
      totalAmountCents: input.totalAmountCents,
      installmentAmountCents: input.installmentAmountCents,
    });
    assertNonNegativeCents(resolved.totalAmountCents, "valor total");
    if (input.isInstallmentPurchase && resolved.totalAmountCents <= 0) {
      throw new ValidationError("informe valor da parcela ou valor total da compra");
    }
    if (!input.isInstallmentPurchase && resolved.totalAmountCents <= 0) {
      throw new ValidationError("valor total deve ser maior que zero");
    }

    const amounts =
      resolved.equalInstallmentCents != null
        ? Array.from({ length: effectiveTotalInstallments }, () => resolved.equalInstallmentCents!)
        : splitInstallmentCents(resolved.totalAmountCents, effectiveTotalInstallments);

    const result = await db.$transaction(async (tx) => {
      const purchaseRow = await tx.creditCardPurchase.create({
        data: {
          creditCardId: input.creditCardId,
          categoryId: input.categoryId,
          description: input.description,
          purchaseDate: input.purchaseDate,
          totalAmountCents: resolved.totalAmountCents,
          isInstallmentPurchase: input.isInstallmentPurchase,
          totalInstallments: effectiveTotalInstallments,
          currentInstallment: effectiveCurrentInstallment,
          installmentAmountCents:
            effectiveTotalInstallments > 1 ? amounts[effectiveCurrentInstallment - 1]! : resolved.totalAmountCents,
        },
      });

      const preview = await createInstallmentsForPurchaseTx(tx, {
        purchaseId: purchaseRow.id,
        creditCardId: input.creditCardId,
        purchaseDate: input.purchaseDate,
        totalAmountCents: resolved.totalAmountCents,
        totalInstallments: effectiveTotalInstallments,
        currentInstallment: effectiveCurrentInstallment,
        card: creditCard,
        equalInstallmentCents: resolved.equalInstallmentCents,
      });

      return { purchaseId: purchaseRow.id, preview };
    });

    const purchase = await purRepo.findById(result.purchaseId);
    return { purchase, preview: result.preview };
  };
}

export function makeUpdateCreditCardPurchase(
  db: PrismaClient,
  cardRepo: CreditCardRepository,
  catRepo: CategoryRepository,
  purRepo: CreditCardPurchaseRepository,
) {
  return async (
    id: string,
    input: {
      categoryId: string;
      description: string;
      purchaseDate: Date;
      totalAmountCents: number;
      isInstallmentPurchase: boolean;
      totalInstallments: number;
      currentInstallment: number;
      installmentAmountCents?: number | null;
    },
  ) => {
    const existing = await purRepo.findById(id);
    if (!existing) throw new NotFoundError("CreditCardPurchase", id);

    const category = await catRepo.findById(input.categoryId);
    if (!category) throw new NotFoundError("Category", input.categoryId);

    const creditCard = await cardRepo.findById(existing.creditCardId);
    if (!creditCard) throw new NotFoundError("CreditCard", existing.creditCardId);

    let effectiveTotalInstallments = input.totalInstallments;
    let effectiveCurrentInstallment = input.currentInstallment;
    if (!input.isInstallmentPurchase) {
      effectiveTotalInstallments = 1;
      effectiveCurrentInstallment = 1;
    }
    if (effectiveTotalInstallments < 1) throw new ValidationError("total de parcelas deve ser >= 1");
    if (effectiveCurrentInstallment < 1 || effectiveCurrentInstallment > effectiveTotalInstallments) {
      throw new ValidationError("parcela atual inválida");
    }

    const resolved = resolvePurchaseTotalAndInstallmentMode({
      isInstallmentPurchase: input.isInstallmentPurchase,
      totalInstallments: effectiveTotalInstallments,
      totalAmountCents: input.totalAmountCents,
      installmentAmountCents: input.installmentAmountCents,
    });
    assertNonNegativeCents(resolved.totalAmountCents, "valor total");
    if (input.isInstallmentPurchase && resolved.totalAmountCents <= 0) {
      throw new ValidationError("informe valor da parcela ou valor total da compra");
    }
    if (!input.isInstallmentPurchase && resolved.totalAmountCents <= 0) {
      throw new ValidationError("valor total deve ser maior que zero");
    }

    const amounts =
      resolved.equalInstallmentCents != null
        ? Array.from({ length: effectiveTotalInstallments }, () => resolved.equalInstallmentCents!)
        : splitInstallmentCents(resolved.totalAmountCents, effectiveTotalInstallments);

    const installmentRows = await db.purchaseInstallment.findMany({
      where: { purchaseId: id },
      include: { statement: true },
    });
    const touchesPaid =
      installmentRows.length > 0 &&
      installmentRows.some((row) => row.statement.status === "paid" || row.status === "paid");

    if (
      touchesPaid &&
      !structuralPurchaseEquals(existing, {
        purchaseDate: input.purchaseDate,
        totalAmountCents: resolved.totalAmountCents,
        isInstallmentPurchase: input.isInstallmentPurchase,
        totalInstallments: effectiveTotalInstallments,
        currentInstallment: effectiveCurrentInstallment,
      })
    ) {
      throw new ValidationError(
        "Não é possível alterar data, valor ou parcelas: há parcela em fatura paga. Altere apenas descrição e categoria.",
      );
    }

    if (touchesPaid) {
      await db.creditCardPurchase.update({
        where: { id },
        data: {
          categoryId: input.categoryId,
          description: input.description,
        },
      });
      const purchase = await purRepo.findById(id);
      return { purchase, preview: undefined };
    }

    const result = await db.$transaction(async (tx) => {
      await tx.purchaseInstallment.deleteMany({ where: { purchaseId: id } });
      await tx.creditCardPurchase.update({
        where: { id },
        data: {
          categoryId: input.categoryId,
          description: input.description,
          purchaseDate: input.purchaseDate,
          totalAmountCents: resolved.totalAmountCents,
          isInstallmentPurchase: input.isInstallmentPurchase,
          totalInstallments: effectiveTotalInstallments,
          currentInstallment: effectiveCurrentInstallment,
          installmentAmountCents:
            effectiveTotalInstallments > 1
              ? amounts[effectiveCurrentInstallment - 1]!
              : resolved.totalAmountCents,
        },
      });
      const preview = await createInstallmentsForPurchaseTx(tx, {
        purchaseId: id,
        creditCardId: existing.creditCardId,
        purchaseDate: input.purchaseDate,
        totalAmountCents: resolved.totalAmountCents,
        totalInstallments: effectiveTotalInstallments,
        currentInstallment: effectiveCurrentInstallment,
        card: creditCard,
        equalInstallmentCents: resolved.equalInstallmentCents,
      });
      return { preview };
    });

    const purchase = await purRepo.findById(id);
    return { purchase, preview: result.preview };
  };
}

export function makeListStatementsByCard(stmtRepo: StatementRepository, cardRepo: CreditCardRepository) {
  return async (creditCardId: string) => {
    const creditCard = await cardRepo.findById(creditCardId);
    if (!creditCard) throw new NotFoundError("CreditCard", creditCardId);
    return stmtRepo.findByCreditCardId(creditCardId);
  };
}

export function makeListAllStatements(stmtRepo: StatementRepository) {
  return (creditCardId?: string) => stmtRepo.listAll({ creditCardId });
}

export function makeGetStatementDetails(
  stmtRepo: StatementRepository,
  instRepo: PurchaseInstallmentRepository,
  db: PrismaClient,
) {
  return async (id: string) => {
    const statement = await stmtRepo.findById(id);
    if (!statement) throw new NotFoundError("Statement", id);
    const totalCents = await instRepo.sumPendingByStatementId(id);
    const installmentsWithPurchase = await db.purchaseInstallment.findMany({
      where: { statementId: id },
      include: { purchase: { include: { category: true } } },
      orderBy: [
        { purchase: { purchaseDate: "desc" } },
        { purchase: { createdAt: "desc" } },
        { installmentNumber: "desc" },
      ],
    });

    const statementsForCard = await stmtRepo.findByCreditCardId(statement.creditCardId);
    const statementIndex = statementsForCard.findIndex((stmt) => stmt.id === id);
    const previousStatementId =
      statementIndex > 0 ? statementsForCard[statementIndex - 1]!.id : null;
    const nextStatementId =
      statementIndex >= 0 && statementIndex < statementsForCard.length - 1
        ? statementsForCard[statementIndex + 1]!.id
        : null;

    const categoryTotalsById = new Map<
      string,
      { categoryId: string; categoryName: string; amountCents: number }
    >();
    let totalInvoiceCents = 0;
    for (const row of installmentsWithPurchase) {
      totalInvoiceCents += row.amountCents;
      const categoryId = row.purchase.categoryId;
      const categoryName = row.purchase.category.name;
      const categoryTotal =
        categoryTotalsById.get(categoryId) ?? {
          categoryId,
          categoryName,
          amountCents: 0,
        };
      categoryTotal.amountCents += row.amountCents;
      categoryTotalsById.set(categoryId, categoryTotal);
    }
    const categoryBreakdown = [...categoryTotalsById.values()].map((breakdown) => ({
      categoryId: breakdown.categoryId,
      categoryName: breakdown.categoryName,
      amountCents: breakdown.amountCents,
      percentOfTotal:
        totalInvoiceCents > 0
          ? Math.round((breakdown.amountCents / totalInvoiceCents) * 10000) / 100
          : 0,
    }));

    return {
      statement,
      totalPendingCents: totalCents,
      totalInvoiceCents,
      navigation: { previousStatementId, nextStatementId },
      categoryBreakdown,
      installments: installmentsWithPurchase.map((row) => ({
        id: row.id,
        installmentNumber: row.installmentNumber,
        totalInstallments: row.totalInstallments,
        amountCents: row.amountCents,
        competencyMonth: row.competencyMonth,
        status: row.status,
        purchaseDescription: row.purchase.description,
        purchaseId: row.purchaseId,
        categoryId: row.purchase.categoryId,
        categoryName: row.purchase.category.name,
      })),
    };
  };
}

export function makeMarkStatementPaid(stmtRepo: StatementRepository) {
  return async (id: string) => {
    const statement = await stmtRepo.findById(id);
    if (!statement) throw new NotFoundError("Statement", id);
    return stmtRepo.updateStatus(id, "paid");
  };
}

export function makeListCreditCardPurchases(purRepo: CreditCardPurchaseRepository) {
  return (creditCardId?: string) => purRepo.findAll({ creditCardId });
}

export function makeGetCreditCardPurchase(purRepo: CreditCardPurchaseRepository) {
  return async (id: string) => {
    const purchase = await purRepo.findById(id);
    if (!purchase) throw new NotFoundError("CreditCardPurchase", id);
    return purchase;
  };
}

export function makeListFutureInstallments(instRepo: PurchaseInstallmentRepository) {
  return (fromCompetencyMonth: string) => instRepo.findFuturePending(fromCompetencyMonth);
}
