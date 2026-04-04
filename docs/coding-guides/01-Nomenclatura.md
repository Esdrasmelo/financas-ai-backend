# Nomenclatura (DDD e Clean Architecture)

Este guia aplica-se ao código TypeScript do back-end (`src/`).

## Linguagem ubíqua

Use os termos do domínio já presentes nos módulos (`budget`, `credit-cards`, `dashboard`, `financial`) e no modelo de dados: `creditCard`, `statement`, `purchase`, `competencyMonth`, `installment`, `category`, etc. Evite variáveis de uma letra (`c`, `r`, `p`) exceto em índices óbvios ou escopos triviais.

## Por camada

- **Domain e application**: nomes explícitos em parâmetros e variáveis locais; funções exportadas em verbo + objeto quando descrevem operações (`parseCompetencyMonth`, `makeGetCreditCard`).
- **Infrastructure (HTTP Express)**: `req` e `res` nos handlers são aceitos por convenção da comunidade. Prefira nomes descritivos para o restante (`bodyParseResult`, `router`, `dashboardQueries`).
- **Infrastructure (Prisma)**: alinhe nomes a entidades e agregados (`purchaseRow`, `categoryId`), não abreviações opacas.

## Convenções gerais

- **Booleans**: prefixos `is`, `has`, `can` quando clarificam (`isActive`).
- **Valores monetários**: sufixo `Cents` quando o valor está em centavos (`amountCents`, `totalPendingCents`).
- **Callbacks**: em `.map` / `.filter`, nomeie o elemento (`category`, `installmentRow`) em vez de `(c)` ou `(x)`.

## O que não renomear sem necessidade

- Propriedades JSON da API e campos do Prisma (contratos externos).
- Parâmetros de bibliotecas de terceiros que exigem assinaturas fixas.

## Ferramentas

- Back-end: `pnpm lint` (ESLint em `src/`; regras podem ser ampliadas de forma gradual).

## Front-end

O projeto `financas-ai-frontend` mantém um guia espelhado em `docs/coding-guides/01-Nomenclatura.md` com padrões para `fetch` (`response`, corpo tipado) e componentes React.
