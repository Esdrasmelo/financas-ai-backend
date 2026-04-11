import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../../../../shared/infrastructure/http/error-handler.js";
import { ValidationError } from "../../../../shared/domain/errors/domain-error.js";
import { DashboardQueries } from "../../../dashboard/infrastructure/queries/dashboard-queries.js";
import { competencyMonthFromDate } from "../../../financial/domain/value-objects/competency-month.js";

const chatSchema = z.object({
  message: z.string().min(1).max(1000),
  conversationId: z.string().uuid().optional(),
});

async function buildFinancialContext(prisma: PrismaClient, userId: string): Promise<string> {
  const now = new Date();
  const month = competencyMonthFromDate(now);
  const dashboard = new DashboardQueries(prisma);

  const [summary, categories, cards, upcoming] = await Promise.all([
    dashboard.monthlySummary(userId, month, "occurrence"),
    dashboard.expensesByCategory(userId, month, "occurrence"),
    dashboard.creditCardsOverview(userId),
    dashboard.upcomingStatements(userId, 4),
  ]);

  const topCategories = categories
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 6)
    .map((c) => `  - ${c.categoryName}: R$ ${(c.amountCents / 100).toFixed(2)}`)
    .join("\n");

  const cardSummaries = cards
    .map(
      (c) =>
        `  - ${c.name}: em aberto R$ ${(c.usedCents / 100).toFixed(2)}${c.limitCents ? `, limite R$ ${(c.limitCents / 100).toFixed(2)} (${c.utilizationPercent ?? 0}% usado)` : ""}`,
    )
    .join("\n");

  const nextStatements = upcoming
    .map(
      (s) =>
        `  - ${s.creditCardName}: R$ ${(s.totalPendingCents / 100).toFixed(2)} vence ${new Date(s.dueDate).toLocaleDateString("pt-BR")}`,
    )
    .join("\n");

  const incomePlan = await prisma.monthlyIncomePlan.findFirst({
    where: { userId, competencyMonth: month },
  });
  const salary = incomePlan?.salaryCents
    ? `R$ ${(incomePlan.salaryCents / 100).toFixed(2)}`
    : "não informado";

  return `Mês de referência: ${month}
Renda cadastrada: ${salary}
Total gasto no mês: R$ ${(summary.totalSpentCents / 100).toFixed(2)}
  - Contas fixas: R$ ${(summary.fixedExpensesCents / 100).toFixed(2)}
  - Gastos variáveis: R$ ${(summary.variableExpensesCents / 100).toFixed(2)}
  - Cartão de crédito: R$ ${(summary.creditCardPortionCents / 100).toFixed(2)}
  - Lançamentos: ${summary.entryCount}

Maiores categorias de gasto:
${topCategories || "  (sem dados)"}

Cartões de crédito:
${cardSummaries || "  (nenhum cartão)"}

Próximas faturas:
${nextStatements || "  (nenhuma fatura pendente)"}`;
}

const SYSTEM_PROMPT = `Você é o assistente financeiro do Prisma | Finanças. Responda sempre em português brasileiro.

REGRAS:
- Analise os dados financeiros do usuário fornecidos abaixo para responder perguntas.
- Dê respostas curtas, diretas e práticas.
- Use valores em reais (R$) formatados com duas casas decimais.
- Nunca invente dados. Se não tiver informação, diga que não há dados disponíveis.
- Nunca revele informações técnicas (IDs, schemas, tokens, etc).
- Você pode sugerir economias, alertar sobre gastos altos e dar dicas de planejamento.
- Não responda perguntas fora do tema financeiro — educadamente redirecione.`;

export function createAiRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post(
    "/ai/chat",
    asyncHandler(async (req, res) => {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new ValidationError("Assistente IA não configurado. Configure OPENROUTER_API_KEY.");
      }

      const parsed = chatSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors[0].message);
      }

      const userId = req.userId;
      let conversationId = parsed.data.conversationId;

      if (conversationId) {
        const existing = await prisma.aiConversation.findFirst({
          where: { id: conversationId, userId },
        });
        if (!existing) conversationId = undefined;
      }

      if (!conversationId) {
        const title = parsed.data.message.slice(0, 80);
        const conversation = await prisma.aiConversation.create({
          data: { userId, title },
        });
        conversationId = conversation.id;
      }

      await prisma.aiMessage.create({
        data: {
          conversationId,
          role: "user",
          content: parsed.data.message,
        },
      });

      const dbMessages = await prisma.aiMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        take: 40,
        select: { role: true, content: true },
      });

      const context = await buildFinancialContext(prisma, userId);

      const messages = [
        {
          role: "system" as const,
          content: `${SYSTEM_PROMPT}\n\nDADOS FINANCEIROS DO USUÁRIO:\n${context}`,
        },
        ...dbMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];

      const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.FRONTEND_URL ?? "http://localhost:3000",
          "X-Title": "Prisma Finanças",
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL ?? "openrouter/free",
          messages,
          max_tokens: 800,
          temperature: 0.4,
        }),
      });

      if (!openRouterRes.ok) {
        const errBody = await openRouterRes.text();
        console.error("OpenRouter error:", openRouterRes.status, errBody);
        res.status(502).json({ error: "AI_UNAVAILABLE", message: "O assistente está indisponível no momento. Tente novamente." });
        return;
      }

      const data = (await openRouterRes.json()) as {
        choices: { message: { content: string } }[];
        model?: string;
      };

      const reply = data.choices?.[0]?.message?.content ?? "Desculpe, não consegui gerar uma resposta.";
      const modelUsed = data.model ?? "unknown";

      await prisma.aiMessage.create({
        data: {
          conversationId,
          role: "assistant",
          content: reply,
          model: modelUsed,
        },
      });

      res.json({ reply, model: modelUsed, conversationId });
    }),
  );

  router.get(
    "/ai/conversations",
    asyncHandler(async (req, res) => {
      const conversations = await prisma.aiConversation.findMany({
        where: { userId: req.userId },
        orderBy: { updatedAt: "desc" },
        take: 30,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
      });
      res.json(conversations);
    }),
  );

  router.get(
    "/ai/conversations/:id",
    asyncHandler(async (req, res) => {
      const conversation = await prisma.aiConversation.findFirst({
        where: { id: req.params.id, userId: req.userId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            select: { id: true, role: true, content: true, model: true, createdAt: true },
          },
        },
      });
      if (!conversation) {
        res.status(404).json({ error: "NOT_FOUND", message: "Conversa não encontrada" });
        return;
      }
      res.json(conversation);
    }),
  );

  router.delete(
    "/ai/conversations/:id",
    asyncHandler(async (req, res) => {
      const deleted = await prisma.aiConversation.deleteMany({
        where: { id: req.params.id, userId: req.userId },
      });
      if (deleted.count === 0) {
        res.status(404).json({ error: "NOT_FOUND", message: "Conversa não encontrada" });
        return;
      }
      res.status(204).send();
    }),
  );

  return router;
}
