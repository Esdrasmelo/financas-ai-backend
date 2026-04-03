import { Router } from "express";
import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../../shared/infrastructure/http/error-handler.js";
import { ValidationError } from "../../../../shared/domain/errors/domain-error.js";
import type { PrismaClient } from "@prisma/client";
import { PrismaCategoryRepository } from "../prisma/repositories/prisma-category-repository.js";
import { PrismaFixedExpenseRepository } from "../prisma/repositories/prisma-fixed-expense-repository.js";
import { PrismaMonthlyEntryRepository } from "../prisma/repositories/prisma-monthly-entry-repository.js";
import {
  makeCreateCategory,
  makeDeleteCategory,
  makeListCategories,
  makeUpdateCategory,
} from "../../application/use-cases/category-use-cases.js";
import {
  makeCreateFixedExpense,
  makeDeleteMonthlyEntry,
  makeDisableFixedExpense,
  makeGenerateMonthlyEntriesFromFixedExpenses,
  makeGetMonthlyEntriesSummary,
  makeListFixedExpenses,
  makeListMonthlyEntries,
  makeRegisterVariableExpense,
  makeUpdateFixedExpense,
  makeUpdateMonthlyEntry,
} from "../../application/use-cases/fixed-expense-use-cases.js";

const categoryCreateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["expense", "income"]).optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});

const categoryUpdateSchema = categoryCreateSchema.partial();

const fixedExpenseCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  amountCents: z.number().int().nonnegative(),
  isVariableAmount: z.boolean().optional(),
  categoryId: z.string().uuid(),
  dueDay: z.number().int().min(1).max(31),
  isActive: z.boolean().optional(),
  isRecurringMonthly: z.boolean().optional(),
});

const fixedExpenseUpdateSchema = fixedExpenseCreateSchema.partial();

const entryCreateSchema = z.object({
  description: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  date: z.string().datetime(),
  categoryId: z.string().uuid(),
  paymentMethod: z.enum(["cash", "debit", "pix", "credit_card"]),
  competencyMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

const entryUpdateSchema = z.object({
  description: z.string().min(1).optional(),
  amountCents: z.number().int().nonnegative().optional(),
  date: z.string().datetime().optional(),
  categoryId: z.string().uuid().optional(),
  paymentMethod: z.enum(["cash", "debit", "pix", "credit_card"]).optional(),
  competencyMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

function parseBody<T>(schema: z.ZodType<T>, req: Request): T {
  const r = schema.safeParse(req.body);
  if (!r.success) {
    throw new ValidationError(r.error.flatten().formErrors.join("; "));
  }
  return r.data;
}

export function createFinancialRouter(db: PrismaClient): Router {
  const r = Router();
  const catRepo = new PrismaCategoryRepository(db);
  const fixedRepo = new PrismaFixedExpenseRepository(db);
  const entryRepo = new PrismaMonthlyEntryRepository(db);

  const listCategories = makeListCategories(catRepo);
  const createCategory = makeCreateCategory(catRepo);
  const updateCategory = makeUpdateCategory(catRepo);
  const deleteCategory = makeDeleteCategory(catRepo);

  const listFixed = makeListFixedExpenses(fixedRepo);
  const createFixed = makeCreateFixedExpense(fixedRepo, catRepo);
  const updateFixed = makeUpdateFixedExpense(fixedRepo, catRepo);
  const disableFixed = makeDisableFixedExpense(fixedRepo);
  const genMonthly = makeGenerateMonthlyEntriesFromFixedExpenses(fixedRepo, entryRepo);
  const registerVar = makeRegisterVariableExpense(entryRepo, catRepo);
  const listEntries = makeListMonthlyEntries(entryRepo);
  const summaryEntries = makeGetMonthlyEntriesSummary(entryRepo);
  const updateEntry = makeUpdateMonthlyEntry(entryRepo, catRepo);
  const deleteEntry = makeDeleteMonthlyEntry(entryRepo);

  r.get(
    "/categories",
    asyncHandler(async (_req, res) => {
      const data = await listCategories();
      res.json(data);
    }),
  );

  r.post(
    "/categories",
    asyncHandler(async (req, res) => {
      const body = parseBody(categoryCreateSchema, req);
      const data = await createCategory(body);
      res.status(201).json(data);
    }),
  );

  r.put(
    "/categories/:id",
    asyncHandler(async (req, res) => {
      const body = parseBody(categoryUpdateSchema, req);
      const data = await updateCategory(req.params.id, body);
      res.json(data);
    }),
  );

  r.delete(
    "/categories/:id",
    asyncHandler(async (req, res) => {
      await deleteCategory(req.params.id);
      res.status(204).send();
    }),
  );

  r.get(
    "/fixed-expenses",
    asyncHandler(async (_req, res) => {
      res.json(await listFixed());
    }),
  );

  r.post(
    "/fixed-expenses",
    asyncHandler(async (req, res) => {
      const body = parseBody(fixedExpenseCreateSchema, req);
      const data = await createFixed(body);
      res.status(201).json(data);
    }),
  );

  r.put(
    "/fixed-expenses/:id",
    asyncHandler(async (req, res) => {
      const body = parseBody(fixedExpenseUpdateSchema, req);
      const data = await updateFixed(req.params.id, body);
      res.json(data);
    }),
  );

  r.patch(
    "/fixed-expenses/:id/disable",
    asyncHandler(async (req, res) => {
      const data = await disableFixed(req.params.id);
      res.json(data);
    }),
  );

  r.post(
    "/fixed-expenses/generate-monthly-entries",
    asyncHandler(async (req, res) => {
      const schema = z.object({ competencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });
      const body = parseBody(schema, req);
      const data = await genMonthly(body.competencyMonth);
      res.json(data);
    }),
  );

  r.get(
    "/entries",
    asyncHandler(async (req, res) => {
      const q = z
        .object({ competencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })
        .safeParse(req.query);
      if (!q.success) throw new ValidationError("query competencyMonth YYYY-MM obrigatório");
      res.json(await listEntries(q.data.competencyMonth));
    }),
  );

  r.get(
    "/entries/monthly-summary",
    asyncHandler(async (req, res) => {
      const q = z
        .object({ competencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })
        .safeParse(req.query);
      if (!q.success) throw new ValidationError("query competencyMonth YYYY-MM obrigatório");
      res.json(await summaryEntries(q.data.competencyMonth));
    }),
  );

  r.post(
    "/entries",
    asyncHandler(async (req, res) => {
      const body = parseBody(entryCreateSchema, req);
      const data = await registerVar({
        ...body,
        date: new Date(body.date),
      });
      res.status(201).json(data);
    }),
  );

  r.put(
    "/entries/:id",
    asyncHandler(async (req, res) => {
      const body = parseBody(entryUpdateSchema, req);
      const data = await updateEntry(req.params.id, {
        ...body,
        date: body.date ? new Date(body.date) : undefined,
      });
      res.json(data);
    }),
  );

  r.delete(
    "/entries/:id",
    asyncHandler(async (req, res) => {
      await deleteEntry(req.params.id);
      res.status(204).send();
    }),
  );

  return r;
}
