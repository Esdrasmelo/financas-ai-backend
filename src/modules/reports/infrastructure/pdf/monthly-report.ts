import type { Content, TDocumentDefinitions, CellValue } from "./pdf-shared.js";
import {
  buildDocDefinition,
  formatCents,
  formatDate,
  formatMonth,
  kpiRow,
  pageHeader,
  simpleTable,
} from "./pdf-shared.js";

interface MonthlySummary {
  totalSpentCents: number;
  fixedExpensesCents: number;
  variableExpensesCents: number;
  creditCardPortionCents: number;
  entryCount: number;
}

interface CategoryBreakdown {
  categoryName: string;
  amountCents: number;
}

interface EntryRow {
  description: string;
  amountCents: number;
  date: Date;
  sourceType: string;
  paymentMethod: string;
  category: { name: string } | null;
}

export interface MonthlyReportData {
  userName: string;
  competencyMonth: string;
  view: string;
  summary: MonthlySummary;
  categoryBreakdown: CategoryBreakdown[];
  entries: EntryRow[];
}

export function buildMonthlyReportDoc(data: MonthlyReportData): TDocumentDefinitions {
  const content: Content[] = [];

  content.push(pageHeader(
    `Relatório Mensal — ${formatMonth(data.competencyMonth)}`,
    `${data.userName} • Visão: ${data.view === "payment" ? "Pagamento" : "Ocorrência"}`,
  ));

  content.push({ text: "Resumo do Mês", style: "subtitle" });
  content.push(kpiRow([
    { label: "Total Gasto", value: formatCents(data.summary.totalSpentCents) },
    { label: "Despesas Fixas", value: formatCents(data.summary.fixedExpensesCents) },
    { label: "Despesas Variáveis", value: formatCents(data.summary.variableExpensesCents) },
    { label: "Cartão de Crédito", value: formatCents(data.summary.creditCardPortionCents) },
  ]));

  if (data.categoryBreakdown.length > 0) {
    content.push({ text: "Gastos por Categoria", style: "subtitle" });

    const sorted = [...data.categoryBreakdown].sort((a, b) => b.amountCents - a.amountCents);
    const total = sorted.reduce((s, c) => s + c.amountCents, 0);

    const catRows: CellValue[][] = sorted.map((cat) => [
      cat.categoryName,
      formatCents(cat.amountCents),
      total > 0 ? `${((cat.amountCents / total) * 100).toFixed(1)}%` : "0%",
    ]);
    catRows.push([
      { text: "Total", bold: true },
      { text: formatCents(total), bold: true },
      { text: "100%", bold: true },
    ]);

    content.push(simpleTable(["Categoria", "Valor", "%"], catRows, ["*", 100, 60]));
  }

  if (data.entries.length > 0) {
    content.push({ text: `Lançamentos (${data.entries.length})`, style: "subtitle" });

    const paymentLabels: Record<string, string> = {
      cash: "Dinheiro", debit: "Débito", pix: "PIX", credit_card: "Cartão",
    };
    const sourceLabels: Record<string, string> = {
      fixed_expense: "Fixa", variable: "Variável",
    };

    const entryRows: CellValue[][] = data.entries.map((e) => [
      formatDate(e.date),
      e.description,
      e.category?.name ?? "—",
      sourceLabels[e.sourceType] ?? e.sourceType,
      paymentLabels[e.paymentMethod] ?? e.paymentMethod,
      { text: formatCents(e.amountCents), alignment: "right" },
    ]);

    content.push(simpleTable(
      ["Data", "Descrição", "Categoria", "Tipo", "Pagamento", "Valor"],
      entryRows,
      [55, "*", 80, 50, 55, 70],
    ));
  }

  return buildDocDefinition(content);
}
