/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRequire } from "node:module";
import type { Response } from "express";

const require = createRequire(import.meta.url);

// pdfmake 0.3.x – CJS singleton + Roboto font descriptor
const pdfmake: PdfMakeInstance = require("pdfmake");
const robotoFonts: Record<string, FontDescriptor> = require("pdfmake/fonts/Roboto.js");

pdfmake.fonts = robotoFonts;

// ── Minimal type surface for pdfmake 0.3.x ────────────────────────

interface FontDescriptor {
  normal: string;
  bold: string;
  italics: string;
  bolditalics: string;
}

interface PdfMakeInstance {
  fonts: Record<string, FontDescriptor>;
  createPdf(doc: TDocumentDefinitions): OutputDocument;
}

interface OutputDocument {
  getBuffer(): Promise<Buffer>;
  getStream(): Promise<NodeJS.ReadableStream>;
}

export interface TableCell {
  text?: string | number;
  style?: string;
  bold?: boolean;
  alignment?: "left" | "center" | "right";
  fillColor?: string;
  color?: string;
  fontSize?: number;
  colSpan?: number;
  border?: [boolean, boolean, boolean, boolean];
}

export type CellValue = string | number | TableCell;

interface ContentCanvas {
  canvas: { type: string; x1: number; y1: number; x2: number; y2: number; lineWidth: number; lineColor: string }[];
  margin?: number[];
}

export type Content =
  | { text: string; style?: string; fontSize?: number; color?: string; bold?: boolean; italics?: boolean; alignment?: string; margin?: number[] }
  | { stack: Content[]; margin?: number[] }
  | { columns: Content[]; width?: string | number; margin?: number[] }
  | { table: { headerRows?: number; widths?: (string | number)[]; body: CellValue[][] }; layout?: string; margin?: number[] }
  | ContentCanvas
  | Content[];

export interface StyleDictionary {
  [name: string]: { fontSize?: number; bold?: boolean; margin?: number[]; color?: string; fillColor?: string };
}

export interface TDocumentDefinitions {
  content: Content[];
  styles?: StyleDictionary;
  defaultStyle?: { font?: string; fontSize?: number };
  pageMargins?: number[];
  footer?: (currentPage: number, pageCount: number) => Content;
}

// ── Styles ─────────────────────────────────────────────────────────

export const pdfStyles: StyleDictionary = {
  title: { fontSize: 18, bold: true, margin: [0, 0, 0, 8] },
  subtitle: { fontSize: 13, bold: true, margin: [0, 16, 0, 6] },
  sectionTitle: { fontSize: 11, bold: true, margin: [0, 12, 0, 4] },
  tableHeader: { fontSize: 9, bold: true, fillColor: "#e8e8e8" },
  tableCell: { fontSize: 9 },
  kpiLabel: { fontSize: 9, color: "#666666" },
  kpiValue: { fontSize: 14, bold: true },
  footerText: { fontSize: 7, color: "#999999" },
};

// ── Helpers ────────────────────────────────────────────────────────

export function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  return `${sign}R$ ${reais.toLocaleString("pt-BR")},${String(centavos).padStart(2, "0")}`;
}

export function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${months[Number(month) - 1]} ${year}`;
}

export function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// ── Building blocks ────────────────────────────────────────────────

export function pageHeader(title: string, subtitle?: string): Content {
  const items: Content[] = [
    { text: "Prisma | Finanças", style: "footerText", margin: [0, 0, 0, 2] },
    { text: title, style: "title" },
  ];
  if (subtitle) {
    items.push({ text: subtitle, fontSize: 10, color: "#666666", margin: [0, 0, 0, 4] });
  }
  items.push({ canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#cccccc" }], margin: [0, 4, 0, 8] });
  return { stack: items };
}

export function kpiRow(items: { label: string; value: string }[]): Content {
  return {
    columns: items.map((item) => ({
      stack: [
        { text: item.label, style: "kpiLabel" },
        { text: item.value, style: "kpiValue" },
      ],
    })) as any,
    margin: [0, 4, 0, 8],
  };
}

export function simpleTable(
  headers: string[],
  rows: CellValue[][],
  widths?: (string | number)[],
): Content {
  return {
    table: {
      headerRows: 1,
      widths: widths ?? headers.map(() => "*"),
      body: [
        headers.map((h): CellValue => ({ text: h, style: "tableHeader" })),
        ...rows,
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 4, 0, 8],
  };
}

// ── Document builder ───────────────────────────────────────────────

export function buildDocDefinition(content: Content[]): TDocumentDefinitions {
  return {
    content,
    styles: pdfStyles,
    defaultStyle: { font: "Roboto", fontSize: 9 },
    pageMargins: [40, 40, 40, 50],
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, style: "footerText", margin: [40, 0, 0, 0] },
        { text: `Página ${currentPage}/${pageCount}`, style: "footerText", alignment: "right", margin: [0, 0, 40, 0] },
      ],
    }),
  };
}

// ── PDF generation & response ──────────────────────────────────────

export async function generateAndSend(
  res: Response,
  docDefinition: TDocumentDefinitions,
  filename: string,
): Promise<void> {
  const doc = pdfmake.createPdf(docDefinition as any);
  const buffer = await doc.getBuffer();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", buffer.length);
  res.send(buffer);
}
