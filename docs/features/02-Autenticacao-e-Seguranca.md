# Autenticação e Segurança

## Visão geral

Sistema completo de autenticação JWT com registro, login, redefinição de senha, auditoria de acessos e integração com envio de emails via Resend.

## Model User

```prisma
model User {
  id            String   @id @default(uuid())
  name          String
  email         String   @unique
  passwordHash  String
  themeMode     String   @default("light")
  themePrimary  String   @default("#1f4b46")
  themeAccent   String   @default("#dceae7")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

Senha hasheada com **Argon2** (vencedor da Password Hashing Competition).

## Endpoints

### Públicos (sem JWT)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/register` | Cria usuário, retorna JWT + envia email de boas-vindas |
| POST | `/auth/login` | Autentica, retorna JWT, registra histórico de login |
| POST | `/auth/forgot-password` | Gera token de reset, envia email (sempre retorna 200) |
| POST | `/auth/reset-password` | Valida token, atualiza senha |

### Protegidos (JWT obrigatório)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/auth/me` | Retorna dados do usuário logado (sem passwordHash) |
| GET | `/auth/login-history` | Últimos 50 acessos com IP, geo, device |
| PUT | `/auth/theme` | Atualiza preferências de tema (mode, primary, accent) |

## Critérios de senha

- Mínimo 8 caracteres
- Ao menos 1 letra maiúscula
- Ao menos 1 letra minúscula
- Ao menos 1 número
- Ao menos 1 caractere especial

Validação via Zod com `passwordSchema` reutilizável em register e reset-password.

## JWT

- Secret: `JWT_SECRET` (env var)
- Payload: `{ sub: userId, email }`
- Expiração: 7 dias
- Biblioteca: `jsonwebtoken`

## Middleware de autenticação

**Arquivo:** `src/shared/infrastructure/http/auth-middleware.ts`

- Extrai token do header `Authorization: Bearer <token>`
- Verifica com jsonwebtoken
- Injeta `req.userId` no request
- Retorna 401 se ausente/inválido

**Aplicação no `app.ts`:** rotas auth ficam antes do middleware (públicas), todo o resto fica depois (protegido).

## Multi-tenancy

Todos os models raiz possuem `userId` obrigatório:
- Category, FixedExpense, MonthlyEntry, CreditCard
- MonthlyIncomePlan, IncomeReceipt, SavingsDeposit

Todas as queries filtram por `userId`. O campo `userId` é **omitido das respostas JSON** (via mappers ou `omitUserId()`).

## Sistema de erros

**Arquivo:** `src/shared/domain/errors/domain-error.ts`

| Classe | Código | HTTP |
|--------|--------|------|
| `AuthenticationError` | UNAUTHORIZED | 401 |
| `NotFoundError` | NOT_FOUND | 404 |
| `ValidationError` | VALIDATION | 400 |
| `DomainError` | (genérico) | 422 |

O `errorHandler` em `error-handler.ts` mapeia automaticamente.

## DTO de resposta

```typescript
function toUserResponse(user): UserResponse {
  return { id, name, email, themeMode, themePrimary, themeAccent };
}
```

Nunca expõe `passwordHash`, `createdAt`, `updatedAt`.

## Histórico de logins

**Model:** `LoginHistory` — 15 campos (IP, userAgent, browser, OS, device, city, region, country, countryCode, latitude, longitude, ISP, timezone, success, createdAt).

**Serviço:** `src/shared/infrastructure/auth/login-tracker.ts`
- Extrai IP de `x-forwarded-for` ou `req.ip`
- Para IPs locais (::1, 127.0.0.1), busca IP público via `ip-api.com`
- Parseia User-Agent para browser, OS e tipo de device
- Geolocalização via `ip-api.com` (gratuito, sem chave)
- Fire-and-forget (não bloqueia a response)

## Redefinição de senha

**Model:** `PasswordResetToken` — token UUID, expiração 1h, flag `usedAt`.

**Fluxo:**
1. `POST /auth/forgot-password` → gera token, envia email via Resend
2. Usuário clica no link → `FRONTEND_URL/reset-password?token=xxx`
3. `POST /auth/reset-password` → valida token, atualiza hash, marca como usado

Sempre retorna 200 no forgot-password (não revela se email existe).

## Variáveis de ambiente

```
JWT_SECRET=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=onboarding@resend.dev
FRONTEND_URL=http://localhost:3000
OPENROUTER_API_KEY=...
```
