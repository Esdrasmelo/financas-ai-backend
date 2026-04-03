import type { PrismaClient } from "@prisma/client";
import { addMonthsToCompetencyMonth } from "../../../financial/domain/value-objects/competency-month.js";

export type CompetencyView = "occurrence" | "payment";

export class DashboardQueries {
  constructor(private readonly db: PrismaClient) {}

  async monthlySummary(month: string, view: CompetencyView) {
    const entries = await this.db.monthlyEntry.findMany({
      where: { competencyMonth: month },
    });
    let fixedCents = 0;
    let variableCents = 0;
    for (const e of entries) {
      if (e.sourceType === "fixed_expense") fixedCents += e.amountCents;
      else variableCents += e.amountCents;
    }

    let cardPortionCents = 0;
    if (view === "payment") {
      const inst = await this.db.purchaseInstallment.aggregate({
        where: { competencyMonth: month },
        _sum: { amountCents: true },
      });
      cardPortionCents = inst._sum.amountCents ?? 0;
    } else {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const [y, m] = month.split("-").map(Number);
      const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      const purAgg = await this.db.creditCardPurchase.aggregate({
        where: { purchaseDate: { gte: start, lte: end } },
        _sum: { totalAmountCents: true },
      });
      cardPortionCents = purAgg._sum.totalAmountCents ?? 0;
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

    const entries = await this.db.monthlyEntry.findMany({
      where: { competencyMonth: month },
      include: { category: true },
    });
    for (const e of entries) {
      const k = e.categoryId;
      map.set(k, (map.get(k) ?? 0) + e.amountCents);
    }

    if (view === "payment") {
      const rows = await this.db.purchaseInstallment.findMany({
        where: { competencyMonth: month },
        include: { purchase: true },
      });
      for (const r of rows) {
        const k = r.purchase.categoryId;
        map.set(k, (map.get(k) ?? 0) + r.amountCents);
      }
    } else {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const [y, m] = month.split("-").map(Number);
      const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      const purchases = await this.db.creditCardPurchase.findMany({
        where: { purchaseDate: { gte: start, lte: end } },
      });
      for (const p of purchases) {
        map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + p.totalAmountCents);
      }
    }

    const categories = await this.db.category.findMany({
      where: { id: { in: [...map.keys()] } },
    });
    const byId = new Map(categories.map((c) => [c.id, c]));

    return [...map.entries()].map(([categoryId, amountCents]) => ({
      categoryId,
      categoryName: byId.get(categoryId)?.name ?? categoryId,
      amountCents,
    }));
  }

  async creditCardsOverview() {
    const cards = await this.db.creditCard.findMany();
    const out: {
      creditCardId: string;
      name: string;
      limitCents: number | null;
      usedCents: number;
      utilizationPercent: number | null;
      nextStatementCents: number | null;
    }[] = [];

    const today = new Date();
    for (const c of cards) {
      const openStmts = await this.db.statement.findMany({
        where: {
          creditCardId: c.id,
          status: { in: ["open", "closed", "overdue"] },
        },
        orderBy: { dueDate: "asc" },
      });
      let usedCents = 0;
      for (const s of openStmts) {
        const sum = await this.db.purchaseInstallment.aggregate({
          where: { statementId: s.id, status: "pending" },
          _sum: { amountCents: true },
        });
        usedCents += sum._sum.amountCents ?? 0;
      }

      const nextOpen = openStmts.find((s) => s.dueDate >= today && s.status !== "paid");
      let nextStatementCents: number | null = null;
      if (nextOpen) {
        const sum = await this.db.purchaseInstallment.aggregate({
          where: { statementId: nextOpen.id, status: "pending" },
          _sum: { amountCents: true },
        });
        nextStatementCents = sum._sum.amountCents ?? 0;
      }

      const utilizationPercent =
        c.limitCents && c.limitCents > 0 ? Math.round((usedCents / c.limitCents) * 10000) / 100 : null;

      out.push({
        creditCardId: c.id,
        name: c.name,
        limitCents: c.limitCents,
        usedCents,
        utilizationPercent,
        nextStatementCents,
      });
    }
    return out;
  }

  async upcomingStatements(limit = 6) {
    const today = new Date();
    const stmts = await this.db.statement.findMany({
      where: { dueDate: { gte: today }, status: { not: "paid" } },
      orderBy: { dueDate: "asc" },
      take: limit,
      include: { creditCard: true },
    });
    const result = [];
    for (const s of stmts) {
      const sum = await this.db.purchaseInstallment.aggregate({
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
    const rows = await this.db.purchaseInstallment.findMany({
      where: { competencyMonth: { gte: fromCompetencyMonth }, status: "pending" },
    });
    const totalCents = rows.reduce((a, r) => a + r.amountCents, 0);
    const activePurchases = await this.db.creditCardPurchase.findMany({
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
    const stmts = await this.db.statement.findMany({
      where: { status: { in: ["open", "closed", "overdue"] } },
    });
    let totalCents = 0;
    for (const s of stmts) {
      if (s.status === "paid") continue;
      const sum = await this.db.purchaseInstallment.aggregate({
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
