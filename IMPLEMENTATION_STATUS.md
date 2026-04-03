# Status de implementação — Finanças AI

Este documento resume o que foi implementado em relação à [financial_app_spec.md](./financial_app_spec.md) e o que ainda pode evoluir.

## Backend (`financas-ai-backend`)

### Implementado

- **Stack**: Node.js, TypeScript, Express, Prisma, SQLite, validação HTTP com Zod nos controllers.
- **Arquitetura**: Módulos `financial`, `credit-cards`, `dashboard` com camadas `domain` / `application` / `infrastructure`; Prisma e HTTP só na infraestrutura; mapeadores entre registros Prisma e entidades de domínio.
- **Shared**: `DomainError`, `NotFoundError`, `ValidationError`, cliente Prisma singleton, `createApp` com CORS para localhost e `errorHandler`.
- **Financial**: categorias CRUD; contas fixas CRUD; desativar conta fixa (`PATCH`); geração idempotente de lançamentos mensais a partir de contas fixas ativas/recorrentes; lançamentos (gastos variáveis) CRUD; resumo mensal.
- **Cartões**: CRUD de cartões (via `POST`/`PUT`); estimativa de ciclo (`POST /credit-cards/estimate-cycle`); registro de compras com associação a faturas e **parcelas persistidas**; preview de parcelas (`POST /credit-card-purchases/preview`); listagem de compras e faturas; detalhe de fatura com parcelas; marcar fatura como paga; parcelas futuras (`GET /installments/future`).
- **Dashboard**: KPIs, resumo mensal, breakdown por categoria, visão de cartões, compromissos futuros — com parâmetro `view=occurrence|payment` onde aplicável.
- **Regras centrais**: cálculo de mês de fechamento da fatura a partir da data da compra e do dia de fechamento; geração de parcelas e distribuição de centavos; vencimento no mês seguinte ao fechamento (modelo simplificado).

### Parcial / simplificações

- **Status de fatura**: não há job que marque automaticamente `overdue` ou `closed` pelo calendário; transições são sobretudo manuais (`paid`) ou permanecem `open`.
- **Totais de fatura**: calculados sob demanda (agregações), não materializados em coluna (alinhado ao MVP da spec).
- **Competência**: o backend expõe as duas visões nos endpoints de dashboard; o modelo de dados guarda `competencyMonth` em lançamentos e parcelas e data real nas compras.
- **Autenticação / multiusuário**: fora de escopo MVP (não implementado).

### Não implementado (melhorias futuras)

- Testes de integração com Prisma (banco de teste) e suíte ampla de casos de uso.
- Endpoint `GET /categories/:id` (não obrigatório na spec; listagem cobre o fluxo atual).
- Edição completa de cartões/compras no frontend (API de update de cartão existe; UI mínima só criação/lista em algumas telas).
- Importação bancária, nuvem, notificações (fora do escopo inicial da spec).

## Frontend (`financas-ai-frontend`)

### Implementado

- **Stack**: Next.js (App Router), TypeScript, Tailwind CSS v4, componentes no estilo **shadcn** (Radix + CVA + `tailwind-merge`), **Recharts** no dashboard, **Sonner** para toasts.
- **Navegação**: layout com `AppShell` e links para todas as áreas principais.
- **Telas**: Dashboard (KPIs + pizza por categoria + troca ocorrência/pagamento); Categorias; Contas fixas (criação, lista, desativar, gerar lançamentos); Lançamentos (mês, criar, excluir variável); Cartões (criar, lista); Compras (registro, preview, “em qual fatura”); Faturas (lista por cartão, detalhe, marcar paga).
- **API**: `NEXT_PUBLIC_API_URL` (padrão `http://localhost:3001`); fetch direto nas páginas cliente.

### Parcial

- **shadcn CLI**: `components.json` existe de tentativa de init; componentes foram adicionados manualmente de forma compatível, não necessariamente via registry completo.
- **UX avançada** da spec (atalhos, calendário popover dedicado, skeletons em tudo): não coberto em profundidade.

### Não implementado

- Páginas de edição rica (ex.: editar cartão, editar conta fixa pelo UI — a API backend em parte já suporta).
- Testes E2E ou de componentes.

## Como executar localmente

1. **Backend**: `pnpm install` → `pnpm exec prisma db push` → `pnpm dev` (porta 3001). Garantir `.env` com `DATABASE_URL="file:./dev.db"` (já na pasta `prisma` por convenção do Prisma).
2. **Frontend**: copiar `.env.local.example` para `.env.local` se necessário → `pnpm dev` (porta 3000).

## Testes automatizados (backend)

- Vitest com testes unitários em: `statement-cycle` (ciclo de fatura e parcelas) e `competency-month`.

---

Última atualização: implementação inicial completa do MVP descrito no plano (API + UI principal + testes unitários pontuais).
