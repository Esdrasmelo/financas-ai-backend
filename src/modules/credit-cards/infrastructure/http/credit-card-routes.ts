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
import { DashboardQueries } from "../../../dashboard/infrastructure/queries/dashboard-queries.js";
import {
  makeCreateCreditCard,
  makeEstimateStatementCycle,
  makeGetCreditCard,
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

const cardNetworkBrandSchema = z.enum(["visa", "mastercard", "elo", "amex", "hipercard", "other"]);

const cardCreateSchema = z.object({
  name: z.string().min(1),
  brand: cardNetworkBrandSchema.nullable().optional(),
  themeColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "themeColor deve ser #RRGGBB")
    .nullable()
    .optional(),
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
  const hasInstallmentAmount = (data.installmentAmountCents ?? 0) > 0;
  const hasTotalAmount = data.totalAmountCents > 0;
  if (!hasInstallmentAmount && !hasTotalAmount) {
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
  const bodyParseResult = schema.safeParse(req.body);
  if (!bodyParseResult.success) {
    throw new ValidationError(bodyParseResult.error.flatten().formErrors.join("; "));
  }
  return bodyParseResult.data;
}

export function createCreditCardRouter(prisma: PrismaClient): Router {
  const router = Router();
  const creditCardRepository = new PrismaCreditCardRepository(prisma);
  const statementRepository = new PrismaStatementRepository(prisma);
  const purchaseRepository = new PrismaCreditCardPurchaseRepository(prisma);
  const installmentRepository = new PrismaPurchaseInstallmentRepository(prisma);
  const categoryRepository = new PrismaCategoryRepository(prisma);

  const listCards = makeListCreditCards(creditCardRepository);
  const createCard = makeCreateCreditCard(creditCardRepository);
  const updateCard = makeUpdateCreditCard(creditCardRepository);
  const estimate = makeEstimateStatementCycle();
  const registerPurchase = makeRegisterCreditCardPurchase(
    prisma,
    creditCardRepository,
    categoryRepository,
    purchaseRepository,
  );
  const updatePurchase = makeUpdateCreditCardPurchase(
    prisma,
    creditCardRepository,
    categoryRepository,
    purchaseRepository,
  );
  const listStmtsByCard = makeListStatementsByCard(statementRepository, creditCardRepository);
  const listStmts = makeListAllStatements(statementRepository);
  const getStmt = makeGetStatementDetails(statementRepository, installmentRepository, prisma);
  const markPaid = makeMarkStatementPaid(statementRepository);
  const listPurchases = makeListCreditCardPurchases(purchaseRepository);
  const getPurchase = makeGetCreditCardPurchase(purchaseRepository);
  const listFutureInst = makeListFutureInstallments(installmentRepository);
  const getCard = makeGetCreditCard(creditCardRepository);
  const dashboardQueries = new DashboardQueries(prisma);

  router.get(
    "/credit-cards",
    asyncHandler(async (_req, res) => {
      res.json(await listCards());
    }),
  );

  router.post(
    "/credit-cards",
    asyncHandler(async (req, res) => {
      const body = parseBody(cardCreateSchema, req);
      const data = await createCard(body);
      res.status(201).json(data);
    }),
  );

  router.post(
    "/credit-cards/estimate-cycle",
    asyncHandler(async (req, res) => {
      const schema = z.object({
        creditCardId: z.string().uuid(),
        purchaseDate: z.string().datetime(),
        installmentNumber: z.number().int().min(1).optional(),
      });
      const body = parseBody(schema, req);
      const creditCard = await creditCardRepository.findById(body.creditCardId);
      if (!creditCard) throw new NotFoundError("CreditCard", body.creditCardId);
      res.json(
        estimate({
          purchaseDate: new Date(body.purchaseDate),
          closingDay: creditCard.closingDay,
          dueDay: creditCard.dueDay,
          installmentNumber: body.installmentNumber,
        }),
      );
    }),
  );

  router.put(
    "/credit-cards/:id",
    asyncHandler(async (req, res) => {
      const body = parseBody(cardUpdateSchema, req);
      res.json(await updateCard(req.params.id, body));
    }),
  );

  router.get(
    "/credit-cards/:id/statements",
    asyncHandler(async (req, res) => {
      res.json(await listStmtsByCard(req.params.id));
    }),
  );

  router.get(
    "/credit-cards/:id/analytics",
    asyncHandler(async (req, res) => {
      const queryParseResult = z
        .object({
          fromCompetencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
          toCompetencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
          view: z.enum(["occurrence", "payment"]).optional(),
        })
        .safeParse(req.query);
      if (!queryParseResult.success) {
        throw new ValidationError("Query: fromCompetencyMonth e toCompetencyMonth (YYYY-MM); view opcional.");
      }
      const creditCard = await creditCardRepository.findById(req.params.id);
      if (!creditCard) throw new NotFoundError("CreditCard", req.params.id);
      const view = queryParseResult.data.view ?? "payment";
      const [monthly, categories] = await Promise.all([
        dashboardQueries.creditCardMonthlySeries(
          req.params.id,
          queryParseResult.data.fromCompetencyMonth,
          queryParseResult.data.toCompetencyMonth,
          view,
        ),
        dashboardQueries.creditCardCategoryBreakdownInRange(
          req.params.id,
          queryParseResult.data.fromCompetencyMonth,
          queryParseResult.data.toCompetencyMonth,
          view,
        ),
      ]);
      res.json({ creditCardId: req.params.id, view, monthly, categories });
    }),
  );

  router.get(
    "/credit-cards/:id",
    asyncHandler(async (req, res) => {
      res.json(await getCard(req.params.id));
    }),
  );

  router.get(
    "/credit-card-purchases",
    asyncHandler(async (req, res) => {
      const queryParseResult = z
        .object({ creditCardId: z.string().uuid().optional() })
        .safeParse(req.query);
      res.json(
        await listPurchases(queryParseResult.success ? queryParseResult.data.creditCardId : undefined),
      );
    }),
  );

  router.post(
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

  router.post(
    "/credit-card-purchases/preview",
    asyncHandler(async (req, res) => {
      const body = parseBody(previewSchema, req);
      const creditCard = await creditCardRepository.findById(body.creditCardId);
      if (!creditCard) throw new NotFoundError("CreditCard", body.creditCardId);
      let effectiveTotalInstallments = body.totalInstallments;
      let effectiveCurrentInstallment = body.currentInstallment;
      if (!body.isInstallmentPurchase) {
        effectiveTotalInstallments = 1;
        effectiveCurrentInstallment = 1;
      }
      const resolved = resolvePurchaseTotalAndInstallmentMode({
        isInstallmentPurchase: body.isInstallmentPurchase,
        totalInstallments: effectiveTotalInstallments,
        totalAmountCents: body.totalAmountCents,
        installmentAmountCents: body.installmentAmountCents,
      });
      const amounts =
        resolved.equalInstallmentCents != null
          ? Array.from({ length: effectiveTotalInstallments }, () => resolved.equalInstallmentCents!)
          : splitInstallmentCents(resolved.totalAmountCents, effectiveTotalInstallments);
      const firstRef = purchaseToClosingReferenceMonth(new Date(body.purchaseDate), creditCard.closingDay);
      const preview: {
        referenceMonth: string;
        amountCents: number;
        installmentNumber: number;
        dueDate: string;
      }[] = [];
      for (let i = effectiveCurrentInstallment; i <= effectiveTotalInstallments; i++) {
        const refMonth = installmentClosingReferenceMonth(firstRef, i);
        preview.push({
          referenceMonth: refMonth,
          amountCents: amounts[i - 1]!,
          installmentNumber: i,
          dueDate: dueDateForReferenceMonth(refMonth, creditCard.dueDay, creditCard.closingDay).toISOString(),
        });
      }
      res.json({ preview });
    }),
  );

  router.patch(
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

  router.get(
    "/credit-card-purchases/:id",
    asyncHandler(async (req, res) => {
      res.json(await getPurchase(req.params.id));
    }),
  );

  router.get(
    "/statements",
    asyncHandler(async (req, res) => {
      const queryParseResult = z
        .object({ creditCardId: z.string().uuid().optional() })
        .safeParse(req.query);
      res.json(
        await listStmts(queryParseResult.success ? queryParseResult.data.creditCardId : undefined),
      );
    }),
  );

  router.get(
    "/statements/:id",
    asyncHandler(async (req, res) => {
      res.json(await getStmt(req.params.id));
    }),
  );

  router.patch(
    "/statements/:id/pay",
    asyncHandler(async (req, res) => {
      res.json(await markPaid(req.params.id));
    }),
  );

  router.get(
    "/installments/future",
    asyncHandler(async (req, res) => {
      const queryParseResult = z
        .object({ fromCompetencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })
        .safeParse(req.query);
      if (!queryParseResult.success) {
        throw new ValidationError("query fromCompetencyMonth YYYY-MM obrigatório");
      }
      res.json(await listFutureInst(queryParseResult.data.fromCompetencyMonth));
    }),
  );

  return router;
}
