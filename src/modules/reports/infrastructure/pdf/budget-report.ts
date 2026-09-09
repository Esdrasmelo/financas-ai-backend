import type { Content, TDocumentDefinitions, CellValue } from "./pdf-shared.js";
import {
  buildDocDefinition,
  formatCents,
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
}

interface IncomeReceipt {
  amountCents: number;
  note: string | null;
}

interface SavingsDeposit {
  amountCents: number;
  note: string | null;
}

export interface BudgetReportData {
  userName: string;
  competencyMonth: string;
  view: string;
  salaryCents: number | null;
  incomeReceipts: IncomeReceipt[];
  incomeReceiptsTotalCents: number;
  totalReceivedCents: number;
  savingsDeposits: SavingsDeposit[];
  savingsTotalCents: number;
  monthlySummary: MonthlySummary;
  surplusCents: number | null;
}

export function buildBudgetReportDoc(data: BudgetReportData): TDocumentDefinitions {
  const content: Content[] = [];

  content.push(pageHeader(
    `Orçamento — ${formatMonth(data.competencyMonth)}`,
    `${data.userName} • Visão: ${data.view === "payment" ? "Pagamento" : "Ocorrência"}`,
  ));

  content.push({ text: "Receitas", style: "subtitle" });
  content.push(kpiRow([
    { label: "Salário", value: data.salaryCents != null ? formatCents(data.salaryCents) : "Não informado" },
    { label: "Receitas Extras", value: formatCents(data.incomeReceiptsTotalCents) },
    { label: "Total Recebido", value: formatCents(data.totalReceivedCents) },
  ]));

  if (data.incomeReceipts.length > 0) {
    content.push({ text: "Receitas Extras (detalhe)", style: "sectionTitle" });
    const rows: CellValue[][] = data.incomeReceipts.map((r) => [
      r.note ?? "—",
      { text: formatCents(r.amountCents), alignment: "right" },
    ]);
    rows.push([
      { text: "Total", bold: true },
      { text: formatCents(data.incomeReceiptsTotalCents), bold: true, alignment: "right" },
    ]);
    content.push(simpleTable(["Descrição", "Valor"], rows, ["*", 100]));
  }

  content.push({ text: "Despesas do Mês", style: "subtitle" });
  content.push(kpiRow([
    { label: "Fixas", value: formatCents(data.monthlySummary.fixedExpensesCents) },
    { label: "Variáveis", value: formatCents(data.monthlySummary.variableExpensesCents) },
    { label: "Cartão", value: formatCents(data.monthlySummary.creditCardPortionCents) },
    { label: "Total Gasto", value: formatCents(data.monthlySummary.totalSpentCents) },
  ]));

  if (data.savingsDeposits.length > 0) {
    content.push({ text: "Poupança / Guardados", style: "subtitle" });
    const savRows: CellValue[][] = data.savingsDeposits.map((s) => [
      s.note ?? "—",
      { text: formatCents(s.amountCents), alignment: "right" },
    ]);
    savRows.push([
      { text: "Total Guardado", bold: true },
      { text: formatCents(data.savingsTotalCents), bold: true, alignment: "right" },
    ]);
    content.push(simpleTable(["Descrição", "Valor"], savRows, ["*", 100]));
  }

  content.push({ text: "Resultado do Mês", style: "subtitle" });

  const surplusLabel = data.surplusCents != null
    ? (data.surplusCents >= 0 ? "Superávit" : "Déficit")
    : "—";
  const surplusValue = data.surplusCents != null ? formatCents(data.surplusCents) : "Sem renda configurada";
  const surplusColor = data.surplusCents != null
    ? (data.surplusCents >= 0 ? "#1a7a3a" : "#cc3333")
    : "#666666";

  content.push({
    table: {
      widths: ["*", "*", "*"],
      body: [
        [
          { text: "Total Recebido", fontSize: 9, color: "#666666" },
          { text: "Total Gasto", fontSize: 9, color: "#666666" },
          { text: surplusLabel, fontSize: 9, color: "#666666" },
        ],
        [
          { text: formatCents(data.totalReceivedCents), fontSize: 14, bold: true },
          { text: formatCents(data.monthlySummary.totalSpentCents), fontSize: 14, bold: true },
          { text: surplusValue, fontSize: 14, bold: true, color: surplusColor },
        ],
      ],
    },
    layout: "noBorders",
    margin: [0, 4, 0, 0],
  });

  return buildDocDefinition(content);
}
