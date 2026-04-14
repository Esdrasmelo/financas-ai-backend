import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../../../../shared/infrastructure/http/error-handler.js";
import { NotFoundError, ValidationError } from "../../../../shared/domain/errors/domain-error.js";
import { DashboardQueries, type CompetencyView } from "../../../dashboard/infrastructure/queries/dashboard-queries.js";
import { buildMonthlyReportDoc, type MonthlyReportData } from "../pdf/monthly-report.js";
import { buildStatementReportDoc, type StatementReportData } from "../pdf/statement-report.js";
import { buildBudgetReportDoc, type BudgetReportData } from "../pdf/budget-report.js";
import { buildEntriesReportDoc, type EntriesReportData } from "../pdf/entries-report.js";
import { generateAndSend } from "../pdf/pdf-shared.js";

const ymQuery = z.object({
  competencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  view: z.enum(["occurrence", "payment"]).optional(),
});

export function createReportRouter(prisma: PrismaClient): Router {
  const router = Router();
  const dashboardQueries = new DashboardQueries(prisma);

  router.get(
    "/reports/monthly",
    asyncHandler(async (req, res) => {
      const parsed = ymQuery.safeParse(req.query);
      if (!parsed.success) throw new ValidationError("query: competencyMonth YYYY-MM obrigatório; view opcional occurrence|payment");
      const { competencyMonth } = parsed.data;
      const view: CompetencyView = parsed.data.view ?? "occurrence";

      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });

      const [summary, categoryBreakdown, entries] = await Promise.all([
        dashboardQueries.monthlySummary(req.userId, competencyMonth, view),
        dashboardQueries.expensesByCategory(req.userId, competencyMonth, view),
        prisma.monthlyEntry.findMany({
          where: { userId: req.userId, competencyMonth },
          include: { category: true },
          orderBy: { date: "asc" },
        }),
      ]);

      const data: MonthlyReportData = {
        userName: user.name,
        competencyMonth,
        view,
        summary,
        categoryBreakdown,
        entries: entries.map((e) => ({
          description: e.description,
          amountCents: e.amountCents,
          date: e.date,
          sourceType: e.sourceType,
          paymentMethod: e.paymentMethod,
          category: e.category ? { name: e.category.name } : null,
        })),
      };

      const doc = buildMonthlyReportDoc(data);
      await generateAndSend(res, doc, `relatorio-mensal-${competencyMonth}.pdf`);
    }),
  );

  router.get(
    "/reports/statement/:statementId",
    asyncHandler(async (req, res) => {
      const statement = await prisma.statement.findUnique({
        where: { id: req.params.statementId },
        include: { creditCard: true },
      });
      if (!statement) throw new NotFoundError("Statement", req.params.statementId);
      if (statement.creditCard.userId !== req.userId) throw new NotFoundError("Statement", req.params.statementId);

      const installments = await prisma.purchaseInstallment.findMany({
        where: { statementId: statement.id },
        include: { purchase: { include: { category: true } } },
        orderBy: { purchase: { purchaseDate: "asc" } },
      });

      const totalCents = installments.reduce((sum, inst) => sum + inst.amountCents, 0);

      const data: StatementReportData = {
        creditCard: {
          name: statement.creditCard.name,
          brand: statement.creditCard.brand,
          limitCents: statement.creditCard.limitCents,
        },
        statement: {
          referenceMonth: statement.referenceMonth,
          periodStart: statement.periodStart,
          periodEnd: statement.periodEnd,
          closingDate: statement.closingDate,
          dueDate: statement.dueDate,
          status: statement.status,
        },
        installments: installments.map((inst) => ({
          installmentNumber: inst.installmentNumber,
          totalInstallments: inst.totalInstallments,
          amountCents: inst.amountCents,
          status: inst.status,
          purchase: {
            description: inst.purchase.description,
            purchaseDate: inst.purchase.purchaseDate,
            category: inst.purchase.category ? { name: inst.purchase.category.name } : null,
          },
        })),
        totalCents,
      };

      const doc = buildStatementReportDoc(data);
      await generateAndSend(res, doc, `fatura-${statement.creditCard.name.replace(/\s+/g, "-").toLowerCase()}-${statement.referenceMonth}.pdf`);
    }),
  );

  router.get(
    "/reports/budget",
    asyncHandler(async (req, res) => {
      const parsed = ymQuery.safeParse(req.query);
      if (!parsed.success) throw new ValidationError("query: competencyMonth YYYY-MM obrigatório; view opcional");
      const { competencyMonth } = parsed.data;
      const view: CompetencyView = parsed.data.view ?? "payment";

      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });

      const [plan, savings, incomeReceipts, summary] = await Promise.all([
        prisma.monthlyIncomePlan.findFirst({
          where: { userId: req.userId, competencyMonth },
        }),
        prisma.savingsDeposit.findMany({
          where: { userId: req.userId, competencyMonth },
          orderBy: { createdAt: "desc" },
        }),
        prisma.incomeReceipt.findMany({
          where: { userId: req.userId, competencyMonth },
          orderBy: { createdAt: "desc" },
        }),
        dashboardQueries.monthlySummary(req.userId, competencyMonth, view),
      ]);

      const salaryCents = plan?.salaryCents ?? null;
      const incomeReceiptsTotalCents = incomeReceipts.reduce((s, r) => s + r.amountCents, 0);
      const totalReceivedCents = (salaryCents ?? 0) + incomeReceiptsTotalCents;
      const hasIncomeConfigured = salaryCents != null || incomeReceipts.length > 0;
      const surplusCents = hasIncomeConfigured ? totalReceivedCents - summary.totalSpentCents : null;
      const savingsTotalCents = savings.reduce((s, d) => s + d.amountCents, 0);

      const data: BudgetReportData = {
        userName: user.name,
        competencyMonth,
        view,
        salaryCents,
        incomeReceipts: incomeReceipts.map((r) => ({
          amountCents: r.amountCents,
          note: r.note,
        })),
        incomeReceiptsTotalCents,
        totalReceivedCents,
        savingsDeposits: savings.map((s) => ({
          amountCents: s.amountCents,
          note: s.note,
        })),
        savingsTotalCents,
        monthlySummary: summary,
        surplusCents,
      };

      const doc = buildBudgetReportDoc(data);
      await generateAndSend(res, doc, `orcamento-${competencyMonth}.pdf`);
    }),
  );

  router.get(
    "/reports/entries",
    asyncHandler(async (req, res) => {
      const parsed = z.object({
        competencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      }).safeParse(req.query);
      if (!parsed.success) throw new ValidationError("query: competencyMonth YYYY-MM obrigatório");
      const { competencyMonth } = parsed.data;

      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });

      const entries = await prisma.monthlyEntry.findMany({
        where: { userId: req.userId, competencyMonth },
        include: { category: true },
        orderBy: { date: "asc" },
      });

      let fixedTotalCents = 0;
      let variableTotalCents = 0;
      for (const e of entries) {
        if (e.sourceType === "fixed_expense") fixedTotalCents += e.amountCents;
        else variableTotalCents += e.amountCents;
      }

      const data: EntriesReportData = {
        userName: user.name,
        competencyMonth,
        entries: entries.map((e) => ({
          description: e.description,
          amountCents: e.amountCents,
          date: e.date,
          sourceType: e.sourceType,
          paymentMethod: e.paymentMethod,
          category: e.category ? { name: e.category.name } : null,
        })),
        fixedTotalCents,
        variableTotalCents,
        totalCents: fixedTotalCents + variableTotalCents,
      };

      const doc = buildEntriesReportDoc(data);
      await generateAndSend(res, doc, `extrato-lancamentos-${competencyMonth}.pdf`);
    }),
  );

  return router;
}
