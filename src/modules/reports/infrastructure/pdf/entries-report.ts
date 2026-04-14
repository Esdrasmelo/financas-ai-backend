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

interface EntryRow {
  description: string;
  amountCents: number;
  date: Date;
  sourceType: string;
  paymentMethod: string;
  category: { name: string } | null;
}

export interface EntriesReportData {
  userName: string;
  competencyMonth: string;
  entries: EntryRow[];
  fixedTotalCents: number;
  variableTotalCents: number;
  totalCents: number;
}

const paymentLabels: Record<string, string> = {
  cash: "Dinheiro", debit: "Débito", pix: "PIX", credit_card: "Cartão",
};
const sourceLabels: Record<string, string> = {
  fixed_expense: "Fixa", variable: "Variável",
};

export function buildEntriesReportDoc(data: EntriesReportData): TDocumentDefinitions {
  const content: Content[] = [];

  content.push(pageHeader(
    `Extrato de Lançamentos — ${formatMonth(data.competencyMonth)}`,
    data.userName,
  ));

  content.push({ text: "Resumo", style: "subtitle" });
  content.push(kpiRow([
    { label: "Despesas Fixas", value: formatCents(data.fixedTotalCents) },
    { label: "Despesas Variáveis", value: formatCents(data.variableTotalCents) },
    { label: "Total", value: formatCents(data.totalCents) },
    { label: "Lançamentos", value: String(data.entries.length) },
  ]));

  if (data.entries.length > 0) {
    content.push({ text: "Lançamentos", style: "subtitle" });

    const rows: CellValue[][] = data.entries.map((e) => [
      formatDate(e.date),
      e.description,
      e.category?.name ?? "—",
      sourceLabels[e.sourceType] ?? e.sourceType,
      paymentLabels[e.paymentMethod] ?? e.paymentMethod,
      { text: formatCents(e.amountCents), alignment: "right" },
    ]);

    rows.push([
      { text: "", colSpan: 5 }, "", "", "", "",
      { text: formatCents(data.totalCents), bold: true, alignment: "right" },
    ]);

    content.push(simpleTable(
      ["Data", "Descrição", "Categoria", "Tipo", "Pagamento", "Valor"],
      rows,
      [55, "*", 80, 50, 55, 70],
    ));
  } else {
    content.push({ text: "Nenhum lançamento encontrado para este mês.", italics: true, color: "#999999", margin: [0, 8, 0, 0] });
  }

  return buildDocDefinition(content);
}
