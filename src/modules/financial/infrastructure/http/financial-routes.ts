import { Router } from "express";
import { z } from "zod";
import type { Request } from "express";
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
  const bodyParseResult = schema.safeParse(req.body);
  if (!bodyParseResult.success) {
    throw new ValidationError(bodyParseResult.error.flatten().formErrors.join("; "));
  }
  return bodyParseResult.data;
}

export function createFinancialRouter(prisma: PrismaClient): Router {
  const router = Router();
  const categoryRepo = new PrismaCategoryRepository(prisma);
  const fixedRepo = new PrismaFixedExpenseRepository(prisma);
  const entryRepo = new PrismaMonthlyEntryRepository(prisma);

  const listCategories = makeListCategories(categoryRepo);
  const createCategory = makeCreateCategory(categoryRepo);
  const updateCategory = makeUpdateCategory(categoryRepo);
  const deleteCategory = makeDeleteCategory(categoryRepo);

  const listFixed = makeListFixedExpenses(fixedRepo);
  const createFixed = makeCreateFixedExpense(fixedRepo, categoryRepo);
  const updateFixed = makeUpdateFixedExpense(fixedRepo, categoryRepo);
  const disableFixed = makeDisableFixedExpense(fixedRepo);
  const genMonthly = makeGenerateMonthlyEntriesFromFixedExpenses(fixedRepo, entryRepo);
  const registerVar = makeRegisterVariableExpense(entryRepo, categoryRepo);
  const listEntries = makeListMonthlyEntries(entryRepo);
  const summaryEntries = makeGetMonthlyEntriesSummary(entryRepo);
  const updateEntry = makeUpdateMonthlyEntry(entryRepo, categoryRepo);
  const deleteEntry = makeDeleteMonthlyEntry(entryRepo);

  router.get(
    "/categories",
    asyncHandler(async (_req, res) => {
      const data = await listCategories();
      res.json(data);
    }),
  );

  router.post(
    "/categories",
    asyncHandler(async (req, res) => {
      const body = parseBody(categoryCreateSchema, req);
      const data = await createCategory(body);
      res.status(201).json(data);
    }),
  );

  router.put(
    "/categories/:id",
    asyncHandler(async (req, res) => {
      const body = parseBody(categoryUpdateSchema, req);
      const data = await updateCategory(req.params.id, body);
      res.json(data);
    }),
  );

  router.delete(
    "/categories/:id",
    asyncHandler(async (req, res) => {
      await deleteCategory(req.params.id);
      res.status(204).send();
    }),
  );

  router.get(
    "/fixed-expenses",
    asyncHandler(async (_req, res) => {
      res.json(await listFixed());
    }),
  );

  router.post(
    "/fixed-expenses",
    asyncHandler(async (req, res) => {
      const body = parseBody(fixedExpenseCreateSchema, req);
      const data = await createFixed(body);
      res.status(201).json(data);
    }),
  );

  router.put(
    "/fixed-expenses/:id",
    asyncHandler(async (req, res) => {
      const body = parseBody(fixedExpenseUpdateSchema, req);
      const data = await updateFixed(req.params.id, body);
      res.json(data);
    }),
  );

  router.patch(
    "/fixed-expenses/:id/disable",
    asyncHandler(async (req, res) => {
      const data = await disableFixed(req.params.id);
      res.json(data);
    }),
  );

  router.post(
    "/fixed-expenses/generate-monthly-entries",
    asyncHandler(async (req, res) => {
      const schema = z.object({ competencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });
      const body = parseBody(schema, req);
      const data = await genMonthly(body.competencyMonth);
      res.json(data);
    }),
  );

  router.get(
    "/entries",
    asyncHandler(async (req, res) => {
      const queryParseResult = z
        .object({ competencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })
        .safeParse(req.query);
      if (!queryParseResult.success) {
        throw new ValidationError("query competencyMonth YYYY-MM obrigatório");
      }
      res.json(await listEntries(queryParseResult.data.competencyMonth));
    }),
  );

  router.get(
    "/entries/monthly-summary",
    asyncHandler(async (req, res) => {
      const queryParseResult = z
        .object({ competencyMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })
        .safeParse(req.query);
      if (!queryParseResult.success) {
        throw new ValidationError("query competencyMonth YYYY-MM obrigatório");
      }
      res.json(await summaryEntries(queryParseResult.data.competencyMonth));
    }),
  );

  router.post(
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

  router.put(
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

  router.delete(
    "/entries/:id",
    asyncHandler(async (req, res) => {
      await deleteEntry(req.params.id);
      res.status(204).send();
    }),
  );

  return router;
}
