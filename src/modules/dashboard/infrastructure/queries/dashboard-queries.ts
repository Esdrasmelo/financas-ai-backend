import type { PrismaClient } from "@prisma/client";
import {
  addMonthsToCompetencyMonth,
  competencyMonthFromDate,
} from "../../../financial/domain/value-objects/competency-month.js";
import { ValidationError } from "../../../../shared/domain/errors/domain-error.js";

export type CompetencyView = "occurrence" | "payment";

function endOfCompetencyMonthUtc(ym: string): Date {
  const [y, mo] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));
}

export function expandCompetencyMonthRange(from: string, to: string): string[] {
  if (from > to) {
    throw new ValidationError("fromCompetencyMonth deve ser menor ou igual a toCompetencyMonth");
  }
  const out: string[] = [];
  let cur = from;
  for (;;) {
    out.push(cur);
    if (cur === to) break;
    if (out.length >= 36) {
      throw new ValidationError("Intervalo máximo de 36 meses");
    }
    cur = addMonthsToCompetencyMonth(cur, 1);
  }
  return out;
}

export class DashboardQueries {
  constructor(private readonly prisma: PrismaClient) {}

  async monthlySummary(month: string, view: CompetencyView) {
    const entries = await this.prisma.monthlyEntry.findMany({
      where: { competencyMonth: month },
    });
    let fixedCents = 0;
    let variableCents = 0;
    for (const entry of entries) {
      if (entry.sourceType === "fixed_expense") fixedCents += entry.amountCents;
      else variableCents += entry.amountCents;
    }

    let cardPortionCents: number;
    if (view === "payment") {
      const installmentSum = await this.prisma.purchaseInstallment.aggregate({
        where: { competencyMonth: month },
        _sum: { amountCents: true },
      });
      cardPortionCents = installmentSum._sum.amountCents ?? 0;
    } else {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const [year, monthNum] = month.split("-").map(Number);
      const end = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));
      const purchaseSum = await this.prisma.creditCardPurchase.aggregate({
        where: { purchaseDate: { gte: start, lte: end } },
        _sum: { totalAmountCents: true },
      });
      cardPortionCents = purchaseSum._sum.totalAmountCents ?? 0;
    }

    const entriesTotalCents = fixedCents + variableCents;
    const totalSpentCents = entriesTotalCents + cardPortionCents;

    return {
      competencyMonth: month,
      view,
      totalSpentCents,
      fixedExpensesCents: fixedCents,
      variableExpensesCents: variableCents,
      creditCardPortionCents: cardPortionCents,
      entryCount: entries.length,
    };
  }

  async expensesByCategory(month: string, view: CompetencyView) {
    const map = new Map<string, number>();

    const entries = await this.prisma.monthlyEntry.findMany({
      where: { competencyMonth: month },
      include: { category: true },
    });
    for (const entry of entries) {
      const categoryId = entry.categoryId;
      map.set(categoryId, (map.get(categoryId) ?? 0) + entry.amountCents);
    }

    if (view === "payment") {
      const installmentRows = await this.prisma.purchaseInstallment.findMany({
        where: { competencyMonth: month },
        include: { purchase: true },
      });
      for (const row of installmentRows) {
        const categoryId = row.purchase.categoryId;
        map.set(categoryId, (map.get(categoryId) ?? 0) + row.amountCents);
      }
    } else {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const [year, monthNum] = month.split("-").map(Number);
      const end = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));
      const purchases = await this.prisma.creditCardPurchase.findMany({
        where: { purchaseDate: { gte: start, lte: end } },
      });
      for (const purchase of purchases) {
        map.set(purchase.categoryId, (map.get(purchase.categoryId) ?? 0) + purchase.totalAmountCents);
      }
    }

    const categories = await this.prisma.category.findMany({
      where: { id: { in: [...map.keys()] } },
    });
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    return [...map.entries()].map(([categoryId, amountCents]) => ({
      categoryId,
      categoryName: categoryById.get(categoryId)?.name ?? categoryId,
      amountCents,
    }));
  }

  async creditCardMonthlySeries(
    creditCardId: string,
    fromCompetencyMonth: string,
    toCompetencyMonth: string,
    view: CompetencyView,
  ) {
    const months = expandCompetencyMonthRange(fromCompetencyMonth, toCompetencyMonth);
    if (view === "payment") {
      const rows = await this.prisma.purchaseInstallment.groupBy({
        by: ["competencyMonth"],
        where: {
          competencyMonth: { gte: fromCompetencyMonth, lte: toCompetencyMonth },
          statement: { creditCardId },
        },
        _sum: { amountCents: true },
      });
      const totalsByMonth = new Map(
        rows.map((row) => [row.competencyMonth, row._sum.amountCents ?? 0]),
      );
      return months.map((monthKey) => ({
        competencyMonth: monthKey,
        totalCents: totalsByMonth.get(monthKey) ?? 0,
      }));
    }
    const purchases = await this.prisma.creditCardPurchase.findMany({
      where: {
        creditCardId,
        purchaseDate: {
          gte: new Date(`${fromCompetencyMonth}-01T00:00:00.000Z`),
          lte: endOfCompetencyMonthUtc(toCompetencyMonth),
        },
      },
      select: { purchaseDate: true, totalAmountCents: true },
    });
    const totalsByCompetencyMonth = new Map<string, number>();
    for (const monthKey of months) totalsByCompetencyMonth.set(monthKey, 0);
    for (const purchase of purchases) {
      const purchaseCompetencyMonth = competencyMonthFromDate(purchase.purchaseDate);
      if (purchaseCompetencyMonth >= fromCompetencyMonth && purchaseCompetencyMonth <= toCompetencyMonth) {
        totalsByCompetencyMonth.set(
          purchaseCompetencyMonth,
          (totalsByCompetencyMonth.get(purchaseCompetencyMonth) ?? 0) + purchase.totalAmountCents,
        );
      }
    }
    return months.map((monthKey) => ({
      competencyMonth: monthKey,
      totalCents: totalsByCompetencyMonth.get(monthKey) ?? 0,
    }));
  }

  async creditCardCategoryBreakdownInRange(
    creditCardId: string,
    fromCompetencyMonth: string,
    toCompetencyMonth: string,
    view: CompetencyView,
  ) {
    const catTotals = new Map<string, number>();
    if (view === "payment") {
      const rows = await this.prisma.purchaseInstallment.findMany({
        where: {
          competencyMonth: { gte: fromCompetencyMonth, lte: toCompetencyMonth },
          statement: { creditCardId },
        },
        include: { purchase: true },
      });
      for (const row of rows) {
        const categoryId = row.purchase.categoryId;
        catTotals.set(categoryId, (catTotals.get(categoryId) ?? 0) + row.amountCents);
      }
    } else {
      const purchases = await this.prisma.creditCardPurchase.findMany({
        where: {
          creditCardId,
          purchaseDate: {
            gte: new Date(`${fromCompetencyMonth}-01T00:00:00.000Z`),
            lte: endOfCompetencyMonthUtc(toCompetencyMonth),
          },
        },
      });
      for (const purchase of purchases) {
        catTotals.set(
          purchase.categoryId,
          (catTotals.get(purchase.categoryId) ?? 0) + purchase.totalAmountCents,
        );
      }
    }
    const categories = await this.prisma.category.findMany({
      where: { id: { in: [...catTotals.keys()] } },
    });
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const total = [...catTotals.values()].reduce((sum, amount) => sum + amount, 0);
    return [...catTotals.entries()].map(([categoryId, amountCents]) => ({
      categoryId,
      categoryName: categoryById.get(categoryId)?.name ?? categoryId,
      amountCents,
      percentOfTotal: total > 0 ? Math.round((amountCents / total) * 10000) / 100 : 0,
    }));
  }

  async creditCardsOverview() {
    const cards = await this.prisma.creditCard.findMany();
    const out: {
      creditCardId: string;
      name: string;
      brand: string | null;
      themeColor: string | null;
      limitCents: number | null;
      usedCents: number;
      utilizationPercent: number | null;
      nextStatementCents: number | null;
    }[] = [];

    const today = new Date();
    for (const card of cards) {
      const openStmts = await this.prisma.statement.findMany({
        where: {
          creditCardId: card.id,
          status: { in: ["open", "closed", "overdue"] },
        },
        orderBy: { dueDate: "asc" },
      });
      let usedCents = 0;
      for (const s of openStmts) {
        const sum = await this.prisma.purchaseInstallment.aggregate({
          where: { statementId: s.id, status: "pending" },
          _sum: { amountCents: true },
        });
        usedCents += sum._sum.amountCents ?? 0;
      }

      const nextOpen = openStmts.find((s) => s.dueDate >= today && s.status !== "paid");
      let nextStatementCents: number | null = null;
      if (nextOpen) {
        const sum = await this.prisma.purchaseInstallment.aggregate({
          where: { statementId: nextOpen.id, status: "pending" },
          _sum: { amountCents: true },
        });
        nextStatementCents = sum._sum.amountCents ?? 0;
      }

      const utilizationPercent =
        card.limitCents && card.limitCents > 0
          ? Math.round((usedCents / card.limitCents) * 10000) / 100
          : null;

      out.push({
        creditCardId: card.id,
        name: card.name,
        brand: card.brand,
        themeColor: card.themeColor,
        limitCents: card.limitCents,
        usedCents,
        utilizationPercent,
        nextStatementCents,
      });
    }
    return out;
  }

  async upcomingStatements(limit = 6) {
    const today = new Date();
    const stmts = await this.prisma.statement.findMany({
      where: { dueDate: { gte: today }, status: { not: "paid" } },
      orderBy: { dueDate: "asc" },
      take: limit,
      include: { creditCard: true },
    });
    const result = [];
    for (const s of stmts) {
      const sum = await this.prisma.purchaseInstallment.aggregate({
        where: { statementId: s.id, status: "pending" },
        _sum: { amountCents: true },
      });
      result.push({
        statementId: s.id,
        creditCardId: s.creditCardId,
        creditCardName: s.creditCard.name,
        referenceMonth: s.referenceMonth,
        dueDate: s.dueDate,
        status: s.status,
        totalPendingCents: sum._sum.amountCents ?? 0,
      });
    }
    return result;
  }

  async futureCommitments(fromCompetencyMonth: string) {
    const rows = await this.prisma.purchaseInstallment.findMany({
      where: { competencyMonth: { gte: fromCompetencyMonth }, status: "pending" },
    });
    const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
    const activePurchases = await this.prisma.creditCardPurchase.findMany({
      where: { isInstallmentPurchase: true, totalInstallments: { gt: 1 } },
    });
    return {
      fromCompetencyMonth,
      futureInstallmentsCents: totalCents,
      installmentRowCount: rows.length,
      activeInstallmentPurchasesCount: activePurchases.length,
    };
  }

  async openStatementsTotals() {
    const stmts = await this.prisma.statement.findMany({
      where: { status: { in: ["open", "closed", "overdue"] } },
    });
    let totalCents = 0;
    for (const s of stmts) {
      if (s.status === "paid") continue;
      const sum = await this.prisma.purchaseInstallment.aggregate({
        where: { statementId: s.id, status: "pending" },
        _sum: { amountCents: true },
      });
      totalCents += sum._sum.amountCents ?? 0;
    }
    return { openStatementsPendingCents: totalCents };
  }

  async kpis(month: string, view: CompetencyView) {
    const summary = await this.monthlySummary(month, view);
    const prevMonth = addMonthsToCompetencyMonth(month, -1);
    const prevSummary = await this.monthlySummary(prevMonth, view);
    const open = await this.openStatementsTotals();
    const upcoming = await this.upcomingStatements(1);
    const commitments = await this.futureCommitments(month);
    const diff = summary.totalSpentCents - prevSummary.totalSpentCents;
    const diffPercent =
      prevSummary.totalSpentCents > 0
        ? Math.round((diff / prevSummary.totalSpentCents) * 10000) / 100
        : null;

    const denom = summary.totalSpentCents + commitments.futureInstallmentsCents;
    const committedPercent =
      denom > 0 ? Math.round((commitments.futureInstallmentsCents / denom) * 10000) / 100 : null;

    return {
      competencyMonth: month,
      view,
      totalSpentCents: summary.totalSpentCents,
      fixedExpensesCents: summary.fixedExpensesCents,
      variableExpensesCents: summary.variableExpensesCents,
      previousMonthTotalCents: prevSummary.totalSpentCents,
      monthOverMonthDiffCents: diff,
      monthOverMonthDiffPercent: diffPercent,
      openStatementsPendingCents: open.openStatementsPendingCents,
      nextStatement: upcoming[0] ?? null,
      futureInstallmentsCents: commitments.futureInstallmentsCents,
      activeInstallmentPurchasesCount: commitments.activeInstallmentPurchasesCount,
      percentCommittedApprox: committedPercent,
    };
  }
}
