import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../../../../shared/infrastructure/http/error-handler.js";
import { ValidationError } from "../../../../shared/domain/errors/domain-error.js";
import { DashboardQueries, type CompetencyView } from "../queries/dashboard-queries.js";

const monthQuery = z.object({
  competencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  view: z.enum(["occurrence", "payment"]).optional(),
});

function parseMonthQuery(req: { query: unknown }): { competencyMonth: string; view: CompetencyView } {
  const r = monthQuery.safeParse(req.query);
  if (!r.success) throw new ValidationError("query: competencyMonth YYYY-MM; view opcional occurrence|payment");
  return {
    competencyMonth: r.data.competencyMonth,
    view: r.data.view ?? "occurrence",
  };
}

export function createDashboardRouter(db: PrismaClient): Router {
  const r = Router();
  const q = new DashboardQueries(db);

  r.get(
    "/dashboard/kpis",
    asyncHandler(async (req, res) => {
      const { competencyMonth, view } = parseMonthQuery(req);
      res.json(await q.kpis(competencyMonth, view));
    }),
  );

  r.get(
    "/dashboard/monthly-summary",
    asyncHandler(async (req, res) => {
      const { competencyMonth, view } = parseMonthQuery(req);
      res.json(await q.monthlySummary(competencyMonth, view));
    }),
  );

  r.get(
    "/dashboard/category-breakdown",
    asyncHandler(async (req, res) => {
      const { competencyMonth, view } = parseMonthQuery(req);
      res.json(await q.expensesByCategory(competencyMonth, view));
    }),
  );

  r.get(
    "/dashboard/credit-cards-overview",
    asyncHandler(async (_req, res) => {
      res.json(await q.creditCardsOverview());
    }),
  );

  r.get(
    "/dashboard/future-commitments",
    asyncHandler(async (req, res) => {
      const schema = z.object({
        fromCompetencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      });
      const r0 = schema.safeParse(req.query);
      if (!r0.success) throw new ValidationError("query fromCompetencyMonth YYYY-MM obrigatório");
      res.json(await q.futureCommitments(r0.data.fromCompetencyMonth));
    }),
  );

  r.get(
    "/dashboard/upcoming-statements",
    asyncHandler(async (req, res) => {
      const schema = z.object({
        limit: z.coerce.number().int().min(1).max(24).optional(),
      });
      const r0 = schema.safeParse(req.query);
      if (!r0.success) throw new ValidationError("query limit opcional, inteiro entre 1 e 24");
      const limit = r0.data.limit ?? 6;
      res.json(await q.upcomingStatements(limit));
    }),
  );

  return r;
}
