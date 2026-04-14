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

interface InstallmentRow {
  installmentNumber: number;
  totalInstallments: number;
  amountCents: number;
  status: string;
  purchase: {
    description: string;
    purchaseDate: Date;
    category: { name: string } | null;
  };
}

export interface StatementReportData {
  creditCard: {
    name: string;
    brand: string | null;
    limitCents: number | null;
  };
  statement: {
    referenceMonth: string;
    periodStart: Date;
    periodEnd: Date;
    closingDate: Date;
    dueDate: Date;
    status: string;
  };
  installments: InstallmentRow[];
  totalCents: number;
}

const statusLabels: Record<string, string> = {
  open: "Aberta",
  closed: "Fechada",
  paid: "Paga",
  overdue: "Vencida",
  pending: "Pendente",
};

export function buildStatementReportDoc(data: StatementReportData): TDocumentDefinitions {
  const content: Content[] = [];

  content.push(pageHeader(
    `Fatura — ${data.creditCard.name}`,
    formatMonth(data.statement.referenceMonth),
  ));

  content.push(kpiRow([
    { label: "Bandeira", value: data.creditCard.brand?.toUpperCase() ?? "—" },
    { label: "Limite", value: data.creditCard.limitCents != null ? formatCents(data.creditCard.limitCents) : "—" },
    { label: "Status", value: statusLabels[data.statement.status] ?? data.statement.status },
  ]));

  content.push({ text: "Dados da Fatura", style: "subtitle" });
  content.push(simpleTable(
    ["Período Início", "Período Fim", "Fechamento", "Vencimento"],
    [[
      formatDate(data.statement.periodStart),
      formatDate(data.statement.periodEnd),
      formatDate(data.statement.closingDate),
      formatDate(data.statement.dueDate),
    ]],
    ["*", "*", "*", "*"],
  ));

  if (data.installments.length > 0) {
    content.push({ text: `Parcelas (${data.installments.length})`, style: "subtitle" });

    const rows: CellValue[][] = data.installments.map((inst) => [
      formatDate(inst.purchase.purchaseDate),
      inst.purchase.description,
      inst.purchase.category?.name ?? "—",
      `${inst.installmentNumber}/${inst.totalInstallments}`,
      statusLabels[inst.status] ?? inst.status,
      { text: formatCents(inst.amountCents), alignment: "right" },
    ]);

    content.push(simpleTable(
      ["Data Compra", "Descrição", "Categoria", "Parcela", "Status", "Valor"],
      rows,
      [60, "*", 70, 45, 50, 70],
    ));
  }

  content.push({
    columns: [
      { text: "", style: "tableCell" },
      {
        stack: [
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 1, lineColor: "#333333" }], margin: [0, 0, 0, 0] },
          {
            columns: [
              { text: "Total da Fatura", bold: true, fontSize: 11 },
              { text: formatCents(data.totalCents), bold: true, fontSize: 11, alignment: "right" },
            ],
            margin: [0, 4, 0, 0],
          },
        ],
      },
    ],
    margin: [0, 8, 0, 0],
  } as Content);

  return buildDocDefinition(content);
}
