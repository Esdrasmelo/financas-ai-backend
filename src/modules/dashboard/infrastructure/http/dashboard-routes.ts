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
  const queryParseResult = monthQuery.safeParse(req.query);
  if (!queryParseResult.success) {
    throw new ValidationError("query: competencyMonth YYYY-MM; view opcional occurrence|payment");
  }
  return {
    competencyMonth: queryParseResult.data.competencyMonth,
    view: queryParseResult.data.view ?? "occurrence",
  };
}

export function createDashboardRouter(prisma: PrismaClient): Router {
  const router = Router();
  const dashboardQueries = new DashboardQueries(prisma);

  router.get(
    "/dashboard/kpis",
    asyncHandler(async (req, res) => {
      const { competencyMonth, view } = parseMonthQuery(req);
      res.json(await dashboardQueries.kpis(competencyMonth, view));
    }),
  );

  router.get(
    "/dashboard/monthly-summary",
    asyncHandler(async (req, res) => {
      const { competencyMonth, view } = parseMonthQuery(req);
      res.json(await dashboardQueries.monthlySummary(competencyMonth, view));
    }),
  );

  router.get(
    "/dashboard/category-breakdown",
    asyncHandler(async (req, res) => {
      const { competencyMonth, view } = parseMonthQuery(req);
      res.json(await dashboardQueries.expensesByCategory(competencyMonth, view));
    }),
  );

  router.get(
    "/dashboard/credit-cards-overview",
    asyncHandler(async (_req, res) => {
      res.json(await dashboardQueries.creditCardsOverview());
    }),
  );

  router.get(
    "/dashboard/future-commitments",
    asyncHandler(async (req, res) => {
      const schema = z.object({
        fromCompetencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      });
      const queryParseResult = schema.safeParse(req.query);
      if (!queryParseResult.success) {
        throw new ValidationError("query fromCompetencyMonth YYYY-MM obrigatório");
      }
      res.json(await dashboardQueries.futureCommitments(queryParseResult.data.fromCompetencyMonth));
    }),
  );

  router.get(
    "/dashboard/upcoming-statements",
    asyncHandler(async (req, res) => {
      const schema = z.object({
        limit: z.coerce.number().int().min(1).max(24).optional(),
      });
      const queryParseResult = schema.safeParse(req.query);
      if (!queryParseResult.success) {
        throw new ValidationError("query limit opcional, inteiro entre 1 e 24");
      }
      const limit = queryParseResult.data.limit ?? 6;
      res.json(await dashboardQueries.upcomingStatements(limit));
    }),
  );

  return router;
}
