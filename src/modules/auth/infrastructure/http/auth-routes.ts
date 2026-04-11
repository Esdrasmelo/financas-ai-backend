import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../../../../shared/infrastructure/http/error-handler.js";
import { AuthenticationError, ValidationError } from "../../../../shared/domain/errors/domain-error.js";
import { authMiddleware } from "../../../../shared/infrastructure/http/auth-middleware.js";
import { sendEmail } from "../../../../shared/infrastructure/email/resend-client.js";
import { welcomeEmail, passwordResetEmail } from "../../../../shared/infrastructure/email/templates.js";
import { trackLogin } from "../../../../shared/infrastructure/auth/login-tracker.js";

const passwordSchema = z
  .string()
  .min(8, "Senha deve ter no mínimo 8 caracteres")
  .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiúscula")
  .regex(/[a-z]/, "Senha deve conter ao menos uma letra minúscula")
  .regex(/[0-9]/, "Senha deve conter ao menos um número")
  .regex(/[^A-Za-z0-9]/, "Senha deve conter ao menos um caractere especial");

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
  password: passwordSchema,
});

interface UserResponse {
  id: string;
  name: string;
  email: string;
  themeMode: string;
  themePrimary: string;
  themeAccent: string;
}

function toUserResponse(user: {
  id: string;
  name: string;
  email: string;
  themeMode: string;
  themePrimary: string;
  themeAccent: string;
}): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    themeMode: user.themeMode,
    themePrimary: user.themePrimary,
    themeAccent: user.themeAccent,
  };
}

function signToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado");
  return jwt.sign({ sub: userId, email }, secret, { expiresIn: "7d" });
}

export function createAuthRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post(
    "/auth/register",
    asyncHandler(async (req, res) => {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors[0].message);
      }

      const { name, email, password } = parsed.data;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new ValidationError("Email já cadastrado");
      }

      const passwordHash = await argon2.hash(password);
      const user = await prisma.user.create({
        data: { name, email, passwordHash },
      });

      void sendEmail(email, "Bem-vindo ao Prisma | Finanças", welcomeEmail(name));

      const token = signToken(user.id, user.email);
      res.status(201).json({ token, user: toUserResponse(user) });
    }),
  );

  router.post(
    "/auth/login",
    asyncHandler(async (req, res) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors[0].message);
      }

      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new AuthenticationError();
      }

      const valid = await argon2.verify(user.passwordHash, password);
      if (!valid) {
        void trackLogin(prisma, user.id, req, false);
        throw new AuthenticationError();
      }

      void trackLogin(prisma, user.id, req, true);

      const token = signToken(user.id, user.email);
      res.json({ token, user: toUserResponse(user) });
    }),
  );

  router.post(
    "/auth/forgot-password",
    asyncHandler(async (req, res) => {
      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors[0].message);
      }

      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

      if (user) {
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await prisma.passwordResetToken.create({
          data: { userId: user.id, token, expiresAt },
        });

        const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
        const resetLink = `${frontendUrl}/reset-password?token=${token}`;

        void sendEmail(
          user.email,
          "Redefinir senha — Prisma | Finanças",
          passwordResetEmail(user.name, resetLink),
        );
      }

      res.json({ message: "Se o email estiver cadastrado, você receberá instruções para redefinir sua senha." });
    }),
  );

  router.post(
    "/auth/reset-password",
    asyncHandler(async (req, res) => {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors[0].message);
      }

      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { token: parsed.data.token },
      });

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
        res.status(400).json({ error: "INVALID_TOKEN", message: "Link inválido ou expirado. Solicite um novo." });
        return;
      }

      const passwordHash = await argon2.hash(parsed.data.password);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: resetToken.userId },
          data: { passwordHash },
        }),
        prisma.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        }),
      ]);

      res.json({ message: "Senha redefinida com sucesso." });
    }),
  );

  router.get(
    "/auth/me",
    authMiddleware,
    asyncHandler(async (req, res) => {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) {
        throw new AuthenticationError("Usuário não encontrado");
      }
      res.json(toUserResponse(user));
    }),
  );

  router.get(
    "/auth/login-history",
    authMiddleware,
    asyncHandler(async (req, res) => {
      const limitParam = z.coerce.number().int().min(1).max(100).optional().safeParse(req.query.limit);
      const limit = limitParam.success && limitParam.data ? limitParam.data : 50;

      const history = await prisma.loginHistory.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          success: true,
          ip: true,
          browser: true,
          os: true,
          device: true,
          city: true,
          region: true,
          country: true,
          countryCode: true,
          isp: true,
          timezone: true,
          createdAt: true,
        },
      });

      res.json(history);
    }),
  );

  const themeSchema = z.object({
    themeMode: z.enum(["light", "dark"]).optional(),
    themePrimary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    themeAccent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  });

  router.put(
    "/auth/theme",
    authMiddleware,
    asyncHandler(async (req, res) => {
      const parsed = themeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Dados de tema inválidos");
      }

      const data: Record<string, string> = {};
      if (parsed.data.themeMode) data.themeMode = parsed.data.themeMode;
      if (parsed.data.themePrimary) data.themePrimary = parsed.data.themePrimary;
      if (parsed.data.themeAccent) data.themeAccent = parsed.data.themeAccent;

      const user = await prisma.user.update({
        where: { id: req.userId },
        data,
      });

      res.json(toUserResponse(user));
    }),
  );

  return router;
}
