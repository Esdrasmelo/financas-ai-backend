import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SQLITE_PATH = path.resolve(__dirname, "dev.db");

const TABLES_IN_ORDER = [
  "User",
  "Category",
  "FixedExpense",
  "MonthlyEntry",
  "CreditCard",
  "Statement",
  "CreditCardPurchase",
  "PurchaseInstallment",
  "MonthlyIncomePlan",
  "IncomeReceipt",
  "SavingsDeposit",
  "PasswordResetToken",
  "LoginHistory",
  "AiConversation",
  "AiMessage",
] as const;

type TableName = (typeof TABLES_IN_ORDER)[number];

const DATETIME_FIELDS: Record<TableName, string[]> = {
  User: ["createdAt", "updatedAt"],
  Category: ["createdAt", "updatedAt"],
  FixedExpense: ["createdAt", "updatedAt"],
  MonthlyEntry: ["date", "createdAt", "updatedAt"],
  CreditCard: ["createdAt", "updatedAt"],
  Statement: ["periodStart", "periodEnd", "closingDate", "dueDate", "createdAt", "updatedAt"],
  CreditCardPurchase: ["purchaseDate", "createdAt", "updatedAt"],
  PurchaseInstallment: ["createdAt", "updatedAt"],
  MonthlyIncomePlan: ["createdAt", "updatedAt"],
  IncomeReceipt: ["createdAt", "updatedAt"],
  SavingsDeposit: ["createdAt", "updatedAt"],
  PasswordResetToken: ["expiresAt", "usedAt", "createdAt"],
  LoginHistory: ["createdAt"],
  AiConversation: ["createdAt", "updatedAt"],
  AiMessage: ["createdAt"],
};

const BOOLEAN_FIELDS: Record<TableName, string[]> = {
  User: [],
  Category: [],
  FixedExpense: ["isVariableAmount", "isActive", "isRecurringMonthly"],
  MonthlyEntry: [],
  CreditCard: ["isActive"],
  Statement: [],
  CreditCardPurchase: ["isInstallmentPurchase"],
  PurchaseInstallment: [],
  MonthlyIncomePlan: [],
  IncomeReceipt: [],
  SavingsDeposit: [],
  PasswordResetToken: [],
  LoginHistory: ["success"],
  AiConversation: [],
  AiMessage: [],
};

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") return new Date(value);
  if (value instanceof Date) return value;
  return null;
}

function convertRow(row: Record<string, unknown>, table: TableName): Record<string, unknown> {
  const converted = { ...row };

  for (const field of DATETIME_FIELDS[table]) {
    if (converted[field] != null) {
      converted[field] = toDate(converted[field]);
    }
  }

  for (const field of BOOLEAN_FIELDS[table]) {
    if (converted[field] != null) {
      converted[field] = converted[field] === 1 || converted[field] === true;
    }
  }

  return converted;
}

async function main() {
  console.log(`\nLendo SQLite em: ${SQLITE_PATH}\n`);

  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pg = new PrismaClient();

  try {
    const exported: Record<string, Record<string, unknown>[]> = {};

    for (const table of TABLES_IN_ORDER) {
      const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
      exported[table] = rows.map((r) => convertRow(r, table));
      console.log(`  [export] ${table}: ${rows.length} registros`);
    }

    console.log("\nInserindo dados no PostgreSQL...\n");

    for (const table of TABLES_IN_ORDER) {
      const rows = exported[table];
      if (rows.length === 0) {
        console.log(`  [import] ${table}: 0 registros (vazio)`);
        continue;
      }

      const model = (pg as Record<string, unknown>)[
        table.charAt(0).toLowerCase() + table.slice(1)
      ] as { createMany: (args: { data: Record<string, unknown>[] }) => Promise<{ count: number }> };

      const result = await model.createMany({ data: rows });
      console.log(`  [import] ${table}: ${result.count} registros inseridos`);
    }

    console.log("\nValidando contagens...\n");
    let ok = true;
    for (const table of TABLES_IN_ORDER) {
      const sqliteCount = exported[table].length;
      const model = (pg as Record<string, unknown>)[
        table.charAt(0).toLowerCase() + table.slice(1)
      ] as { count: () => Promise<number> };
      const pgCount = await model.count();

      const status = sqliteCount === pgCount ? "OK" : "DIVERGENCIA";
      if (sqliteCount !== pgCount) ok = false;
      console.log(`  ${table}: SQLite=${sqliteCount} PostgreSQL=${pgCount} [${status}]`);
    }

    if (ok) {
      console.log("\nMigracao concluida com sucesso! Todos os dados foram transferidos.\n");
    } else {
      console.error("\nATENCAO: Algumas tabelas tem contagens divergentes. Verifique os logs acima.\n");
      process.exit(1);
    }
  } finally {
    sqlite.close();
    await pg.$disconnect();
  }
}

main().catch((e) => {
  console.error("Erro na migracao:", e);
  process.exit(1);
});
