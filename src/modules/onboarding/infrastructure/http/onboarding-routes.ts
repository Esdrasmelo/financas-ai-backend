import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../../../../shared/infrastructure/http/error-handler.js";
import { ValidationError } from "../../../../shared/domain/errors/domain-error.js";

export function createOnboardingRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get(
    "/onboarding",
    asyncHandler(async (req, res) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: req.userId },
        select: { onboardingStep: true, onboardingCompletedAt: true },
      });
      res.json({
        step: user.onboardingStep,
        completedAt: user.onboardingCompletedAt?.toISOString() ?? null,
      });
    }),
  );

  router.put(
    "/onboarding/step",
    asyncHandler(async (req, res) => {
      const parsed = z.object({ step: z.number().int().min(0).max(10) }).safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("step inválido");
      }
      await prisma.user.update({
        where: { id: req.userId },
        data: { onboardingStep: parsed.data.step },
      });
      res.json({ step: parsed.data.step });
    }),
  );

  router.post(
    "/onboarding/complete",
    asyncHandler(async (req, res) => {
      const user = await prisma.user.update({
        where: { id: req.userId },
        data: { onboardingCompletedAt: new Date() },
        select: { onboardingCompletedAt: true },
      });
      res.json({ completedAt: user.onboardingCompletedAt?.toISOString() ?? null });
    }),
  );

  return router;
}
