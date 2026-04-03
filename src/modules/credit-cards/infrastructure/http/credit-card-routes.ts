import { Router } from "express";
import { z } from "zod";
import type { Request } from "express";
import type { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../../../../shared/infrastructure/http/error-handler.js";
import { NotFoundError, ValidationError } from "../../../../shared/domain/errors/domain-error.js";
import { PrismaCategoryRepository } from "../../../financial/infrastructure/prisma/repositories/prisma-category-repository.js";
import { PrismaCreditCardRepository } from "../prisma/repositories/prisma-credit-card-repository.js";
import { PrismaStatementRepository } from "../prisma/repositories/prisma-statement-repository.js";
import { PrismaCreditCardPurchaseRepository } from "../prisma/repositories/prisma-credit-card-purchase-repository.js";
import { PrismaPurchaseInstallmentRepository } from "../prisma/repositories/prisma-purchase-installment-repository.js";
import {
  dueDateForReferenceMonth,
  installmentClosingReferenceMonth,
  purchaseToClosingReferenceMonth,
  resolvePurchaseTotalAndInstallmentMode,
  splitInstallmentCents,
} from "../../domain/services/statement-cycle.js";
import {
  makeCreateCreditCard,
  makeEstimateStatementCycle,
  makeGetCreditCardPurchase,
  makeGetStatementDetails,
  makeListAllStatements,
  makeListCreditCardPurchases,
  makeListCreditCards,
  makeListFutureInstallments,
  makeListStatementsByCard,
  makeMarkStatementPaid,
  makeRegisterCreditCardPurchase,
  makeUpdateCreditCard,
  makeUpdateCreditCardPurchase,
} from "../../application/use-cases/credit-card-use-cases.js";

const cardCreateSchema = z.object({
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  limitCents: z.number().int().nonnegative().nullable().optional(),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  isActive: z.boolean().optional(),
});

const cardUpdateSchema = cardCreateSchema.partial();

function purchaseInstallmentAmountRefine(
  data: {
    isInstallmentPurchase: boolean;
    totalAmountCents: number;
    installmentAmountCents?: number;
  },
  ctx: z.RefinementCtx,
) {
  if (!data.isInstallmentPurchase) return;
  const hasPer = (data.installmentAmountCents ?? 0) > 0;
  const hasTot = data.totalAmountCents > 0;
  if (!hasPer && !hasTot) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Para compra parcelada informe installmentAmountCents (valor da parcela) ou totalAmountCents (valor total).",
    });
  }
}

const purchaseFieldsSchema = z.object({
  categoryId: z.string().uuid(),
  description: z.string().min(1),
  purchaseDate: z.string().datetime(),
  totalAmountCents: z.number().int().nonnegative(),
  isInstallmentPurchase: z.boolean(),
  totalInstallments: z.number().int().min(1),
  currentInstallment: z.number().int().min(1),
  installmentAmountCents: z.number().int().nonnegative().optional(),
});

const purchaseSchema = purchaseFieldsSchema
  .extend({ creditCardId: z.string().uuid() })
  .superRefine(purchaseInstallmentAmountRefine);

const previewSchema = z
  .object({
    creditCardId: z.string().uuid(),
    purchaseDate: z.string().datetime(),
    totalAmountCents: z.number().int().nonnegative(),
    isInstallmentPurchase: z.boolean(),
    totalInstallments: z.number().int().min(1),
    currentInstallment: z.number().int().min(1),
    installmentAmountCents: z.number().int().nonnegative().optional(),
  })
  .superRefine(purchaseInstallmentAmountRefine);

const purchaseUpdateSchema = purchaseFieldsSchema.superRefine(purchaseInstallmentAmountRefine);

function parseBody<T>(schema: z.ZodType<T>, req: Request): T {
  const r = schema.safeParse(req.body);
  if (!r.success) {
    throw new ValidationError(r.error.flatten().formErrors.join("; "));
  }
  return r.data;
}

export function createCreditCardRouter(db: PrismaClient): Router {
  const r = Router();
  const cardRepo = new PrismaCreditCardRepository(db);
  const stmtRepo = new PrismaStatementRepository(db);
  const purRepo = new PrismaCreditCardPurchaseRepository(db);
  const instRepo = new PrismaPurchaseInstallmentRepository(db);
  const catRepo = new PrismaCategoryRepository(db);

  const listCards = makeListCreditCards(cardRepo);
  const createCard = makeCreateCreditCard(cardRepo);
  const updateCard = makeUpdateCreditCard(cardRepo);
  const estimate = makeEstimateStatementCycle();
  const registerPurchase = makeRegisterCreditCardPurchase(db, cardRepo, catRepo, purRepo);
  const updatePurchase = makeUpdateCreditCardPurchase(db, cardRepo, catRepo, purRepo);
  const listStmtsByCard = makeListStatementsByCard(stmtRepo, cardRepo);
  const listStmts = makeListAllStatements(stmtRepo);
  const getStmt = makeGetStatementDetails(stmtRepo, instRepo, db);
  const markPaid = makeMarkStatementPaid(stmtRepo);
  const listPurchases = makeListCreditCardPurchases(purRepo);
  const getPurchase = makeGetCreditCardPurchase(purRepo);
  const listFutureInst = makeListFutureInstallments(instRepo);

  r.get(
    "/credit-cards",
    asyncHandler(async (_req, res) => {
      res.json(await listCards());
    }),
  );

  r.post(
    "/credit-cards",
    asyncHandler(async (req, res) => {
      const body = parseBody(cardCreateSchema, req);
      const data = await createCard(body);
      res.status(201).json(data);
    }),
  );

  r.post(
    "/credit-cards/estimate-cycle",
    asyncHandler(async (req, res) => {
      const schema = z.object({
        creditCardId: z.string().uuid(),
        purchaseDate: z.string().datetime(),
        installmentNumber: z.number().int().min(1).optional(),
      });
      const body = parseBody(schema, req);
      const card = await cardRepo.findById(body.creditCardId);
      if (!card) throw new NotFoundError("CreditCard", body.creditCardId);
      res.json(
        estimate({
          purchaseDate: new Date(body.purchaseDate),
          closingDay: card.closingDay,
          dueDay: card.dueDay,
          installmentNumber: body.installmentNumber,
        }),
      );
    }),
  );

  r.put(
    "/credit-cards/:id",
    asyncHandler(async (req, res) => {
      const body = parseBody(cardUpdateSchema, req);
      res.json(await updateCard(req.params.id, body));
    }),
  );

  r.get(
    "/credit-cards/:id/statements",
    asyncHandler(async (req, res) => {
      res.json(await listStmtsByCard(req.params.id));
    }),
  );

  r.get(
    "/credit-card-purchases",
    asyncHandler(async (req, res) => {
      const q = z.object({ creditCardId: z.string().uuid().optional() }).safeParse(req.query);
      res.json(await listPurchases(q.success ? q.data.creditCardId : undefined));
    }),
  );

  r.post(
    "/credit-card-purchases",
    asyncHandler(async (req, res) => {
      const body = parseBody(purchaseSchema, req);
      const data = await registerPurchase({
        ...body,
        purchaseDate: new Date(body.purchaseDate),
      });
      res.status(201).json(data);
    }),
  );

  r.post(
    "/credit-card-purchases/preview",
    asyncHandler(async (req, res) => {
      const body = parseBody(previewSchema, req);
      const card = await cardRepo.findById(body.creditCardId);
      if (!card) throw new NotFoundError("CreditCard", body.creditCardId);
      let totalInst = body.totalInstallments;
      let curInst = body.currentInstallment;
      if (!body.isInstallmentPurchase) {
        totalInst = 1;
        curInst = 1;
      }
      const resolved = resolvePurchaseTotalAndInstallmentMode({
        isInstallmentPurchase: body.isInstallmentPurchase,
        totalInstallments: totalInst,
        totalAmountCents: body.totalAmountCents,
        installmentAmountCents: body.installmentAmountCents,
      });
      const amounts =
        resolved.equalInstallmentCents != null
          ? Array.from({ length: totalInst }, () => resolved.equalInstallmentCents!)
          : splitInstallmentCents(resolved.totalAmountCents, totalInst);
      const firstRef = purchaseToClosingReferenceMonth(new Date(body.purchaseDate), card.closingDay);
      const preview: { referenceMonth: string; amountCents: number; installmentNumber: number; dueDate: string }[] = [];
      for (let i = curInst; i <= totalInst; i++) {
        const refMonth = installmentClosingReferenceMonth(firstRef, i);
        preview.push({
          referenceMonth: refMonth,
          amountCents: amounts[i - 1]!,
          installmentNumber: i,
          dueDate: dueDateForReferenceMonth(refMonth, card.dueDay, card.closingDay).toISOString(),
        });
      }
      res.json({ preview });
    }),
  );

  r.patch(
    "/credit-card-purchases/:id",
    asyncHandler(async (req, res) => {
      const body = parseBody(purchaseUpdateSchema, req);
      const data = await updatePurchase(req.params.id, {
        ...body,
        purchaseDate: new Date(body.purchaseDate),
      });
      res.json(data);
    }),
  );

  r.get(
    "/credit-card-purchases/:id",
    asyncHandler(async (req, res) => {
      res.json(await getPurchase(req.params.id));
    }),
  );

  r.get(
    "/statements",
    asyncHandler(async (req, res) => {
      const q = z.object({ creditCardId: z.string().uuid().optional() }).safeParse(req.query);
      res.json(await listStmts(q.success ? q.data.creditCardId : undefined));
    }),
  );

  r.get(
    "/statements/:id",
    asyncHandler(async (req, res) => {
      res.json(await getStmt(req.params.id));
    }),
  );

  r.patch(
    "/statements/:id/pay",
    asyncHandler(async (req, res) => {
      res.json(await markPaid(req.params.id));
    }),
  );

  r.get(
    "/installments/future",
    asyncHandler(async (req, res) => {
      const q = z
        .object({ fromCompetencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })
        .safeParse(req.query);
      if (!q.success) throw new ValidationError("query fromCompetencyMonth YYYY-MM obrigatório");
      res.json(await listFutureInst(q.data.fromCompetencyMonth));
    }),
  );

  return r;
}
