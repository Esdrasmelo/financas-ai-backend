import type { Category as PrismaCategory } from "@prisma/client";
import type { FixedExpense as PrismaFixedExpense } from "@prisma/client";
import type { MonthlyEntry as PrismaMonthlyEntry } from "@prisma/client";
import type { Category } from "../../../domain/entities/category.js";
import type { FixedExpense } from "../../../domain/entities/fixed-expense.js";
import type { MonthlyEntry } from "../../../domain/entities/monthly-entry.js";

export function toCategoryDomain(row: PrismaCategory): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type === "income" ? "income" : "expense",
    color: row.color,
    icon: row.icon,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toFixedExpenseDomain(row: PrismaFixedExpense): FixedExpense {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    amountCents: row.amountCents,
    isVariableAmount: row.isVariableAmount,
    categoryId: row.categoryId,
    dueDay: row.dueDay,
    isActive: row.isActive,
    isRecurringMonthly: row.isRecurringMonthly,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toMonthlyEntryDomain(row: PrismaMonthlyEntry): MonthlyEntry {
  return {
    id: row.id,
    description: row.description,
    amountCents: row.amountCents,
    date: row.date,
    competencyMonth: row.competencyMonth,
    categoryId: row.categoryId,
    paymentMethod: row.paymentMethod as MonthlyEntry["paymentMethod"],
    sourceType: row.sourceType as MonthlyEntry["sourceType"],
    fixedExpenseId: row.fixedExpenseId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
