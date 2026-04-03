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
    totalInst: number;
    curInst: number;
    card: CreditCard;
    equalInstallmentCents?: number;
  },
): Promise<InstallmentPreviewRow[]> {
  const amounts =
    params.equalInstallmentCents != null
      ? Array.from({ length: params.totalInst }, () => params.equalInstallmentCents!)
      : splitInstallmentCents(params.totalAmountCents, params.totalInst);
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

  for (let i = params.curInst; i <= params.totalInst; i++) {
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

    let stmt = await tx.statement.findUnique({
      where: {
        creditCardId_referenceMonth: {
          creditCardId: params.creditCardId,
          referenceMonth: refMonth,
        },
      },
    });
    if (!stmt) {
      stmt = await tx.statement.create({
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
      statementId: stmt.id,
      installmentNumber: i,
      totalInstallments: params.totalInst,
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
    const c = await repo.findById(id);
    if (!c) throw new NotFoundError("CreditCard", id);
    return c;
  };
}

export function makeCreateCreditCard(repo: CreditCardRepository) {
  return (input: {
    name: string;
    brand?: string | null;
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
      limitCents?: number | null;
      closingDay?: number;
      dueDay?: number;
      isActive?: boolean;
    },
  ) => {
    const c = await repo.findById(id);
    if (!c) throw new NotFoundError("CreditCard", id);
    if (input.closingDay !== undefined) assertDueDay(input.closingDay, "dia de fechamento");
    if (input.dueDay !== undefined) assertDueDay(input.dueDay, "dia de vencimento");
    return repo.update(id, input);
  };
}

export function makeEstimateStatementCycle() {
  return (input: { purchaseDate: Date; closingDay: number; dueDay: number; installmentNumber?: number }) => {
    const firstRef = purchaseToClosingReferenceMonth(input.purchaseDate, input.closingDay);
    const n = input.installmentNumber ?? 1;
    const referenceMonth = installmentClosingReferenceMonth(firstRef, n);
    const { periodStart, periodEnd } = periodBoundsForReferenceMonth(referenceMonth, input.closingDay);
    const closingDate = closingDateForReferenceMonth(referenceMonth, input.closingDay);
    const dueDate = dueDateForReferenceMonth(referenceMonth, input.dueDay, input.closingDay);
    return { referenceMonth, firstInstallmentReferenceMonth: firstRef, installmentNumber: n, periodStart, periodEnd, closingDate, dueDate };
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
    const card = await cardRepo.findById(input.creditCardId);
    if (!card) throw new NotFoundError("CreditCard", input.creditCardId);
    const cat = await catRepo.findById(input.categoryId);
    if (!cat) throw new NotFoundError("Category", input.categoryId);

    let totalInst = input.totalInstallments;
    let curInst = input.currentInstallment;
    if (!input.isInstallmentPurchase) {
      totalInst = 1;
      curInst = 1;
    }
    if (totalInst < 1) throw new ValidationError("total de parcelas deve ser >= 1");
    if (curInst < 1 || curInst > totalInst) {
      throw new ValidationError("parcela atual inválida");
    }

    const resolved = resolvePurchaseTotalAndInstallmentMode({
      isInstallmentPurchase: input.isInstallmentPurchase,
      totalInstallments: totalInst,
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
        ? Array.from({ length: totalInst }, () => resolved.equalInstallmentCents!)
        : splitInstallmentCents(resolved.totalAmountCents, totalInst);

    const result = await db.$transaction(async (tx) => {
      const purchaseRow = await tx.creditCardPurchase.create({
        data: {
          creditCardId: input.creditCardId,
          categoryId: input.categoryId,
          description: input.description,
          purchaseDate: input.purchaseDate,
          totalAmountCents: resolved.totalAmountCents,
          isInstallmentPurchase: input.isInstallmentPurchase,
          totalInstallments: totalInst,
          currentInstallment: curInst,
          installmentAmountCents: totalInst > 1 ? amounts[curInst - 1]! : resolved.totalAmountCents,
        },
      });

      const preview = await createInstallmentsForPurchaseTx(tx, {
        purchaseId: purchaseRow.id,
        creditCardId: input.creditCardId,
        purchaseDate: input.purchaseDate,
        totalAmountCents: resolved.totalAmountCents,
        totalInst,
        curInst,
        card,
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

    const cat = await catRepo.findById(input.categoryId);
    if (!cat) throw new NotFoundError("Category", input.categoryId);

    const card = await cardRepo.findById(existing.creditCardId);
    if (!card) throw new NotFoundError("CreditCard", existing.creditCardId);

    let totalInst = input.totalInstallments;
    let curInst = input.currentInstallment;
    if (!input.isInstallmentPurchase) {
      totalInst = 1;
      curInst = 1;
    }
    if (totalInst < 1) throw new ValidationError("total de parcelas deve ser >= 1");
    if (curInst < 1 || curInst > totalInst) {
      throw new ValidationError("parcela atual inválida");
    }

    const resolved = resolvePurchaseTotalAndInstallmentMode({
      isInstallmentPurchase: input.isInstallmentPurchase,
      totalInstallments: totalInst,
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
        ? Array.from({ length: totalInst }, () => resolved.equalInstallmentCents!)
        : splitInstallmentCents(resolved.totalAmountCents, totalInst);

    const instRows = await db.purchaseInstallment.findMany({
      where: { purchaseId: id },
      include: { statement: true },
    });
    const touchesPaid =
      instRows.length > 0 &&
      instRows.some((row) => row.statement.status === "paid" || row.status === "paid");

    if (
      touchesPaid &&
      !structuralPurchaseEquals(existing, {
        purchaseDate: input.purchaseDate,
        totalAmountCents: resolved.totalAmountCents,
        isInstallmentPurchase: input.isInstallmentPurchase,
        totalInstallments: totalInst,
        currentInstallment: curInst,
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
          totalInstallments: totalInst,
          currentInstallment: curInst,
          installmentAmountCents: totalInst > 1 ? amounts[curInst - 1]! : resolved.totalAmountCents,
        },
      });
      const preview = await createInstallmentsForPurchaseTx(tx, {
        purchaseId: id,
        creditCardId: existing.creditCardId,
        purchaseDate: input.purchaseDate,
        totalAmountCents: resolved.totalAmountCents,
        totalInst,
        curInst,
        card,
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
    const c = await cardRepo.findById(creditCardId);
    if (!c) throw new NotFoundError("CreditCard", creditCardId);
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
    const s = await stmtRepo.findById(id);
    if (!s) throw new NotFoundError("Statement", id);
    const totalCents = await instRepo.sumPendingByStatementId(id);
    const withPurchase = await db.purchaseInstallment.findMany({
      where: { statementId: id },
      include: { purchase: { include: { category: true } } },
      orderBy: [
        { purchase: { purchaseDate: "desc" } },
        { purchase: { createdAt: "desc" } },
        { installmentNumber: "desc" },
      ],
    });

    const cardStatements = await stmtRepo.findByCreditCardId(s.creditCardId);
    const idx = cardStatements.findIndex((x) => x.id === id);
    const previousStatementId = idx > 0 ? cardStatements[idx - 1]!.id : null;
    const nextStatementId =
      idx >= 0 && idx < cardStatements.length - 1 ? cardStatements[idx + 1]!.id : null;

    const catMap = new Map<string, { categoryId: string; categoryName: string; amountCents: number }>();
    let totalInvoiceCents = 0;
    for (const row of withPurchase) {
      totalInvoiceCents += row.amountCents;
      const cid = row.purchase.categoryId;
      const name = row.purchase.category.name;
      const cur = catMap.get(cid) ?? { categoryId: cid, categoryName: name, amountCents: 0 };
      cur.amountCents += row.amountCents;
      catMap.set(cid, cur);
    }
    const categoryBreakdown = [...catMap.values()].map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      amountCents: c.amountCents,
      percentOfTotal:
        totalInvoiceCents > 0 ? Math.round((c.amountCents / totalInvoiceCents) * 10000) / 100 : 0,
    }));

    return {
      statement: s,
      totalPendingCents: totalCents,
      totalInvoiceCents,
      navigation: { previousStatementId, nextStatementId },
      categoryBreakdown,
      installments: withPurchase.map((row) => ({
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
    const s = await stmtRepo.findById(id);
    if (!s) throw new NotFoundError("Statement", id);
    return stmtRepo.updateStatus(id, "paid");
  };
}

export function makeListCreditCardPurchases(purRepo: CreditCardPurchaseRepository) {
  return (creditCardId?: string) => purRepo.findAll({ creditCardId });
}

export function makeGetCreditCardPurchase(purRepo: CreditCardPurchaseRepository) {
  return async (id: string) => {
    const p = await purRepo.findById(id);
    if (!p) throw new NotFoundError("CreditCardPurchase", id);
    return p;
  };
}

export function makeListFutureInstallments(instRepo: PurchaseInstallmentRepository) {
  return (fromCompetencyMonth: string) => instRepo.findFuturePending(fromCompetencyMonth);
}
