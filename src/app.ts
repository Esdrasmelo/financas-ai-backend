import express, { type Express } from "express";
import cors from "cors";
import type { PrismaClient } from "@prisma/client";
import { createAuthRouter } from "./modules/auth/infrastructure/http/auth-routes.js";
import { createFinancialRouter } from "./modules/financial/infrastructure/http/financial-routes.js";
import { createCreditCardRouter } from "./modules/credit-cards/infrastructure/http/credit-card-routes.js";
import { createDashboardRouter } from "./modules/dashboard/infrastructure/http/dashboard-routes.js";
import { createBudgetRouter } from "./modules/budget/infrastructure/http/budget-routes.js";
import { createAiRouter } from "./modules/ai/infrastructure/http/ai-routes.js";
import { createReportRouter } from "./modules/reports/infrastructure/http/report-routes.js";
import { createOnboardingRouter } from "./modules/onboarding/infrastructure/http/onboarding-routes.js";
import { authMiddleware } from "./shared/infrastructure/http/auth-middleware.js";
import { errorHandler } from "./shared/infrastructure/http/error-handler.js";
import { requestLogger } from "./shared/infrastructure/http/request-logger.js";

export function createApp(prisma: PrismaClient): Express {
  const app = express();
  app.set("trust proxy", true);
  app.use(
    cors({
      origin: [/http:\/\/localhost:\d+/, /http:\/\/127\.0\.0\.1:\d+/],
    }),
  );
  app.use(express.json());
  app.use(requestLogger);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "prisma-financas-backend" });
  });

  app.use(createAuthRouter(prisma));

  app.use(authMiddleware);

  app.use(createOnboardingRouter(prisma));
  app.use(createFinancialRouter(prisma));
  app.use(createCreditCardRouter(prisma));
  app.use(createDashboardRouter(prisma));
  app.use(createBudgetRouter(prisma));
  app.use(createAiRouter(prisma));
  app.use(createReportRouter(prisma));

  app.use(errorHandler);
  return app;
}
