import { Router } from "express";
import { z } from "zod";
import type { Request } from "express";
import type { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../../../../shared/infrastructure/http/error-handler.js";
import { NotFoundError, ValidationError } from "../../../../shared/domain/errors/domain-error.js";
import { DashboardQueries, type CompetencyView } from "../../../dashboard/infrastructure/queries/dashboard-queries.js";

const ymParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

function parseBody<T>(schema: z.ZodType<T>, req: Request): T {
  const bodyParseResult = schema.safeParse(req.body);
  if (!bodyParseResult.success) {
    throw new ValidationError(bodyParseResult.error.flatten().formErrors.join("; "));
  }
  return bodyParseResult.data;
}

export function createBudgetRouter(prisma: PrismaClient): Router {
  const router = Router();
  const dashboardQueries = new DashboardQueries(prisma);

  router.get(
    "/budget/month/:competencyMonth",
    asyncHandler(async (req, res) => {
      const competencyMonthParse = ymParam.safeParse(req.params.competencyMonth);
      if (!competencyMonthParse.success) throw new ValidationError("competencyMonth deve ser YYYY-MM");
      const viewQuery = z.enum(["occurrence", "payment"]).optional().safeParse(req.query.view);
      const view: CompetencyView = viewQuery.success && viewQuery.data ? viewQuery.data : "payment";

      const [plan, savings, incomeReceipts, summary] = await Promise.all([
        prisma.monthlyIncomePlan.findUnique({ where: { competencyMonth: competencyMonthParse.data } }),
        prisma.savingsDeposit.findMany({
          where: { competencyMonth: competencyMonthParse.data },
          orderBy: { createdAt: "desc" },
        }),
        prisma.incomeReceipt.findMany({
          where: { competencyMonth: competencyMonthParse.data },
          orderBy: { createdAt: "desc" },
        }),
        dashboardQueries.monthlySummary(competencyMonthParse.data, view),
      ]);

      const salaryCents = plan?.salaryCents ?? null;
      const incomeReceiptsTotalCents = incomeReceipts.reduce(
        (sum, receipt) => sum + receipt.amountCents,
        0,
      );
      const totalReceivedCents = (salaryCents ?? 0) + incomeReceiptsTotalCents;
      const hasIncomeConfigured = salaryCents != null || incomeReceipts.length > 0;
      const surplusCents = hasIncomeConfigured ? totalReceivedCents - summary.totalSpentCents : null;

      const savingsTotalCents = savings.reduce((sum, deposit) => sum + deposit.amountCents, 0);

      res.json({
        competencyMonth: competencyMonthParse.data,
        view,
        salaryCents,
        incomeReceipts,
        incomeReceiptsTotalCents,
        totalReceivedCents,
        hasIncomeConfigured,
        savingsDeposits: savings,
        savingsTotalCents,
        monthlySummary: summary,
        surplusCents,
      });
    }),
  );

  router.put(
    "/budget/month/:competencyMonth",
    asyncHandler(async (req, res) => {
      const competencyMonthParse = ymParam.safeParse(req.params.competencyMonth);
      if (!competencyMonthParse.success) throw new ValidationError("competencyMonth deve ser YYYY-MM");
      const body = parseBody(
        z.object({
          salaryCents: z.number().int().nonnegative().nullable(),
        }),
        req,
      );
      const row = await prisma.monthlyIncomePlan.upsert({
        where: { competencyMonth: competencyMonthParse.data },
        create: { competencyMonth: competencyMonthParse.data, salaryCents: body.salaryCents },
        update: { salaryCents: body.salaryCents },
      });
      res.json(row);
    }),
  );

  router.post(
    "/budget/income-receipts",
    asyncHandler(async (req, res) => {
      const body = parseBody(
        z.object({
          competencyMonth: ymParam,
          amountCents: z.number().int().positive(),
          note: z.string().max(500).nullable().optional(),
        }),
        req,
      );
      const row = await prisma.incomeReceipt.create({
        data: {
          competencyMonth: body.competencyMonth,
          amountCents: body.amountCents,
          note: body.note ?? null,
        },
      });
      res.status(201).json(row);
    }),
  );

  router.delete(
    "/budget/income-receipts/:id",
    asyncHandler(async (req, res) => {
      const deleteResult = await prisma.incomeReceipt.deleteMany({ where: { id: req.params.id } });
      if (deleteResult.count === 0) throw new NotFoundError("IncomeReceipt", req.params.id);
      res.status(204).send();
    }),
  );

  router.post(
    "/budget/savings",
    asyncHandler(async (req, res) => {
      const body = parseBody(
        z.object({
          competencyMonth: ymParam,
          amountCents: z.number().int().positive(),
          note: z.string().max(500).nullable().optional(),
        }),
        req,
      );
      const row = await prisma.savingsDeposit.create({
        data: {
          competencyMonth: body.competencyMonth,
          amountCents: body.amountCents,
          note: body.note ?? null,
        },
      });
      res.status(201).json(row);
    }),
  );

  router.delete(
    "/budget/savings/:id",
    asyncHandler(async (req, res) => {
      const deleteResult = await prisma.savingsDeposit.deleteMany({ where: { id: req.params.id } });
      if (deleteResult.count === 0) throw new NotFoundError("SavingsDeposit", req.params.id);
      res.status(204).send();
    }),
  );

  return router;
}
