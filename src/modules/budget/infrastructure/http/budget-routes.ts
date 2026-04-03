import { Router } from "express";
import { z } from "zod";
import type { Request } from "express";
import type { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../../../../shared/infrastructure/http/error-handler.js";
import { NotFoundError, ValidationError } from "../../../../shared/domain/errors/domain-error.js";
import { DashboardQueries, type CompetencyView } from "../../../dashboard/infrastructure/queries/dashboard-queries.js";

const ymParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

function parseBody<T>(schema: z.ZodType<T>, req: Request): T {
  const r = schema.safeParse(req.body);
  if (!r.success) {
    throw new ValidationError(r.error.flatten().formErrors.join("; "));
  }
  return r.data;
}

export function createBudgetRouter(db: PrismaClient): Router {
  const r = Router();
  const dq = new DashboardQueries(db);

  r.get(
    "/budget/month/:competencyMonth",
    asyncHandler(async (req, res) => {
      const pr = ymParam.safeParse(req.params.competencyMonth);
      if (!pr.success) throw new ValidationError("competencyMonth deve ser YYYY-MM");
      const viewQ = z.enum(["occurrence", "payment"]).optional().safeParse(req.query.view);
      const view: CompetencyView = viewQ.success && viewQ.data ? viewQ.data : "payment";

      const [plan, savings, incomeReceipts, summary] = await Promise.all([
        db.monthlyIncomePlan.findUnique({ where: { competencyMonth: pr.data } }),
        db.savingsDeposit.findMany({
          where: { competencyMonth: pr.data },
          orderBy: { createdAt: "desc" },
        }),
        db.incomeReceipt.findMany({
          where: { competencyMonth: pr.data },
          orderBy: { createdAt: "desc" },
        }),
        dq.monthlySummary(pr.data, view),
      ]);

      const salaryCents = plan?.salaryCents ?? null;
      const incomeReceiptsTotalCents = incomeReceipts.reduce((a, r) => a + r.amountCents, 0);
      const totalReceivedCents = (salaryCents ?? 0) + incomeReceiptsTotalCents;
      const hasIncomeConfigured = salaryCents != null || incomeReceipts.length > 0;
      const surplusCents = hasIncomeConfigured ? totalReceivedCents - summary.totalSpentCents : null;

      const savingsTotalCents = savings.reduce((a, s) => a + s.amountCents, 0);

      res.json({
        competencyMonth: pr.data,
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

  r.put(
    "/budget/month/:competencyMonth",
    asyncHandler(async (req, res) => {
      const pr = ymParam.safeParse(req.params.competencyMonth);
      if (!pr.success) throw new ValidationError("competencyMonth deve ser YYYY-MM");
      const body = parseBody(
        z.object({
          salaryCents: z.number().int().nonnegative().nullable(),
        }),
        req,
      );
      const row = await db.monthlyIncomePlan.upsert({
        where: { competencyMonth: pr.data },
        create: { competencyMonth: pr.data, salaryCents: body.salaryCents },
        update: { salaryCents: body.salaryCents },
      });
      res.json(row);
    }),
  );

  r.post(
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
      const row = await db.incomeReceipt.create({
        data: {
          competencyMonth: body.competencyMonth,
          amountCents: body.amountCents,
          note: body.note ?? null,
        },
      });
      res.status(201).json(row);
    }),
  );

  r.delete(
    "/budget/income-receipts/:id",
    asyncHandler(async (req, res) => {
      const del = await db.incomeReceipt.deleteMany({ where: { id: req.params.id } });
      if (del.count === 0) throw new NotFoundError("IncomeReceipt", req.params.id);
      res.status(204).send();
    }),
  );

  r.post(
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
      const row = await db.savingsDeposit.create({
        data: {
          competencyMonth: body.competencyMonth,
          amountCents: body.amountCents,
          note: body.note ?? null,
        },
      });
      res.status(201).json(row);
    }),
  );

  r.delete(
    "/budget/savings/:id",
    asyncHandler(async (req, res) => {
      const del = await db.savingsDeposit.deleteMany({ where: { id: req.params.id } });
      if (del.count === 0) throw new NotFoundError("SavingsDeposit", req.params.id);
      res.status(204).send();
    }),
  );

  return r;
}
