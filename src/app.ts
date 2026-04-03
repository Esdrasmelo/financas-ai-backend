import express, { type Express } from "express";
import cors from "cors";
import type { PrismaClient } from "@prisma/client";
import { createFinancialRouter } from "./modules/financial/infrastructure/http/financial-routes.js";
import { createCreditCardRouter } from "./modules/credit-cards/infrastructure/http/credit-card-routes.js";
import { createDashboardRouter } from "./modules/dashboard/infrastructure/http/dashboard-routes.js";
import { errorHandler } from "./shared/infrastructure/http/error-handler.js";

export function createApp(db: PrismaClient): Express {
  const app = express();
  app.use(
    cors({
      origin: [/http:\/\/localhost:\d+/, /http:\/\/127\.0\.0\.1:\d+/],
    }),
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "financasai-backend" });
  });

  app.use(createFinancialRouter(db));
  app.use(createCreditCardRouter(db));
  app.use(createDashboardRouter(db));

  app.use(errorHandler);
  return app;
}
