# Finanças AI — API

API REST em **Node.js** + **Express** + **Prisma** (PostgreSQL) para controle de despesas, cartões, faturas e planejamento mensal. Valores monetários são sempre em **centavos** (`amountCents`, `totalCents`, etc.) no JSON.

---

## Stack

| Camada        | Tecnologia                          |
| ------------- | ----------------------------------- |
| Runtime       | Node.js ≥ 20                        |
| HTTP          | Express 4                           |
| Validação     | Zod                                 |
| Persistência  | Prisma 6 + PostgreSQL (`DATABASE_URL`) |
| Linguagem     | TypeScript (ESM)                    |

---

## Requisitos

- [pnpm](https://pnpm.io/) 9.x (recomendado) ou npm
- Node.js ≥ 20
- [Docker](https://www.docker.com/) (para PostgreSQL local)

---

## Configuração

1. Clone o repositório e instale dependências:

   ```bash
   pnpm install
   ```

2. Suba o PostgreSQL via Docker:

   ```bash
   docker compose up -d
   ```

3. Defina o ficheiro `.env` na raiz do backend (exemplo):

   ```env
   DATABASE_URL="postgresql://financas:financas123@localhost:5433/prisma_financas?schema=public"
   PORT=3001
   ```

4. Aplicar migrations e gerar o cliente Prisma:

   ```bash
   pnpm db:migrate
   pnpm build
   ```

5. Arrancar em desenvolvimento:

   ```bash
   pnpm dev
   ```

   A API fica em `http://localhost:3001` (ou na porta definida por `PORT`). Health check: `GET /health`.

---

## Scripts

| Comando          | Descrição                          |
| ---------------- | ---------------------------------- |
| `pnpm dev`       | Servidor com reload (`tsx watch`)  |
| `pnpm build`     | `prisma generate` + compilação TS  |
| `pnpm start`     | Executa `dist/index.js`            |
| `pnpm typecheck` | TypeScript sem emitir ficheiros    |
| `pnpm test`      | Vitest                             |
| `pnpm lint`      | ESLint em `src/`                   |
| `pnpm db:migrate`| Cria/aplica migrations Prisma      |
| `pnpm db:push`   | Sincroniza schema Prisma → PostgreSQL |
| `pnpm db:studio` | Prisma Studio                      |

---

## Módulos da API

- **Financial** — categorias, contas fixas, lançamentos mensais (`/categories`, `/fixed-expenses`, `/entries`, …)
- **Credit cards** — cartões, compras, parcelas, faturas (`/credit-cards`, `/statements`, …)
- **Dashboard** — agregações para o painel (`/dashboard/*`)
- **Budget** — renda, recebimentos, poupança e resumo alinhado ao dashboard (`/budget/*`)

CORS está configurado para origens `localhost` e `127.0.0.1` em qualquer porta (útil com Next.js noutra porta).

---

## Documentação adicional

Na pasta `docs/` existem guias internos (nomenclatura, índice de funcionalidades, etc.).

---

# Dashboard: como os números são calculados

Toda a lógica de agregação do dashboard está em `src/modules/dashboard/infrastructure/queries/dashboard-queries.ts` (classe `DashboardQueries`). Os endpoints expõem esses métodos.

### Competência (`competencyMonth`)

O parâmetro é sempre uma string **`YYYY-MM`** (mês civil de competência usado nos lançamentos e nas parcelas).

### Duas visões: `occurrence` vs `payment`

Quase todos os endpoints de dashboard aceitam `?view=occurrence` ou `?view=payment` (query `view` opcional; o **default da API de dashboard** é `occurrence` quando omitido).

| Visão            | Significado no código | O que entra na parte “cartão” dos totais                                                                 |
| ---------------- | -------------------- | -------------------------------------------------------------------------------------------------------- |
| **Ocorrência**   | `occurrence`         | Compras cujo **`purchaseDate`** cai dentro do mês civil `YYYY-MM` (soma de `totalAmountCents` por compra). |
| **Pagamento**    | `payment`            | Parcelas (`PurchaseInstallment`) cuja **`competencyMonth`** é exatamente o mês pedido (soma de `amountCents`). |

**Lançamentos mensais** (`MonthlyEntry`) em ambas as visões usam sempre o campo **`competencyMonth`** do lançamento — não mudam com `view`.

Em resumo:

- **Fixos + variáveis** = soma de entradas na tabela `MonthlyEntry` para aquele `competencyMonth`.
- **Parte cartão** depende da visão (compras no mês calendário **ou** parcelas competindo naquele mês).

---

### `GET /dashboard/monthly-summary`

Para um `competencyMonth` e uma `view`:

1. **Contas fixas + variáveis**  
   - Percorre todos os `MonthlyEntry` com aquele `competencyMonth`.  
   - `fixedExpensesCents`: soma onde `sourceType === "fixed_expense"`.  
   - `variableExpensesCents`: soma onde `sourceType === "variable"`.  

2. **Parte cartão (`creditCardPortionCents`)**  
   - Se `view === "payment"`: soma `amountCents` de todas as `PurchaseInstallment` com `competencyMonth` igual ao pedido.  
   - Se `view === "occurrence"`: soma `totalAmountCents` de `CreditCardPurchase` com `purchaseDate` entre o 1.º dia e o último dia do mês (UTC).  

3. **Totais**  
   - `entryCount` = número de `MonthlyEntry` naquele mês.  
   - `totalSpentCents` = `(fixed + variable) + creditCardPortionCents`.

---

### `GET /dashboard/category-breakdown`

Agrupa gastos **por `categoryId`** no mesmo mês:

- Soma todos os `MonthlyEntry` da competência (por categoria).
- Depois soma, por categoria:
  - **Pagamento:** valores das parcelas naquele mês (categoria vem da compra associada).
  - **Ocorrência:** valor total de cada compra cuja data cai no mês (categoria da compra).

Devolve linhas com `categoryId`, `categoryName` e `amountCents`.

---

### `GET /dashboard/kpis`

Compõe o `monthly-summary` do mês pedido (mesma `view`), o mês anterior para comparação, e totais adicionais:

| Campo | Origem / fórmula |
| ----- | ---------------- |
| `totalSpentCents` | Igual ao `monthly-summary`: **contas fixas + variáveis + parte cartão** (`creditCardPortionCents`), conforme a `view`. |
| `entriesTotalCents` | `fixedExpensesCents + variableExpensesCents` (só `MonthlyEntry` na competência). |
| `creditCardPortionCents` | Igual ao `monthly-summary` (parcelas no mês se `payment`; compras no calendário se `occurrence`). |
| `statementsDueInMonthTotalCents` | Soma `amountCents` de **todas** as parcelas cujo `Statement.dueDate` cai no mês de competência (UTC); independe da `view`. |
| `fixedExpensesCents`, `variableExpensesCents` | Igual ao `monthly-summary`. |
| `previousMonthTotalCents` | `totalSpentCents` do **mês anterior** (mesma `view`). |
| `monthOverMonthDiffCents` | `totalSpentCents (atual) − totalSpentCents (anterior)`. |
| `monthOverMonthDiffPercent` | `(diff / anterior) × 100`, arredondado a 2 casas; `null` se o mês anterior for 0. |

> **Consistência:** `totalSpentCents` = `entriesTotalCents` + `creditCardPortionCents` (validado no servidor).

---

### `GET /dashboard/credit-cards-overview`

Por cada cartão:

- Considera faturas com status `open`, `closed` ou `overdue` (ordenadas por `dueDate`).
- **`usedCents`:** soma das parcelas pendentes em **todas** essas faturas do cartão.
- **`nextStatementCents`:** se existir a próxima fatura com `dueDate ≥ hoje` e não paga, soma das parcelas pendentes **só dessa** fatura; senão `null`.
- **`utilizationPercent`:** se `limitCents > 0`, `100 × usedCents / limitCents` (2 casas decimais); senão `null`.

---

### `GET /dashboard/upcoming-statements`

Lista faturas com `dueDate ≥ hoje`, status diferente de `paid`, ordenadas por vencimento. Para cada uma, `totalPendingCents` = soma de parcelas pendentes dessa fatura. Limite default `6` (`?limit=` opcional, 1–24).

---

### `GET /dashboard/future-commitments?fromCompetencyMonth=YYYY-MM`

- `futureInstallmentsCents`: soma de `amountCents` das parcelas com `competencyMonth >= fromCompetencyMonth` e `status: "pending"`.
- `installmentRowCount`: quantidade dessas linhas.
- `activeInstallmentPurchasesCount`: compras parceladas ativas (definição acima).

---

### Gráficos no detalhe do cartão

Métodos `creditCardMonthlySeries` e `creditCardCategoryBreakdownInRange` repetem a mesma regra **pagamento vs ocorrência**, filtrando pelo `creditCardId` e intervalo de meses (`expandCompetencyMonthRange`, máximo 36 meses).

- **Pagamento:** agrega parcelas por `competencyMonth` (e por categoria no breakdown).
- **Ocorrência:** aloca cada compra ao `competencyMonth` derivado da `purchaseDate` (`competencyMonthFromDate`).

---

## Planejamento (`/budget`) e alinhamento com o dashboard

`GET /budget/month/:competencyMonth` chama o mesmo `monthlySummary(mês, view)` do dashboard (`view` na query, default **`payment`** neste endpoint).

- `totalReceivedCents` = salário do mês (`MonthlyIncomePlan.salaryCents`, se existir) + soma dos `IncomeReceipt` da competência.
- `surplusCents` = `totalReceivedCents - monthlySummary.totalSpentCents`, **apenas** se houver pelo menos salário ou algum recebimento; caso contrário `null`.

Ou seja, a “sobra” usa exatamente o mesmo `totalSpentCents` documentado acima, para a `view` escolhida.

---

## Licença

Projeto privado / uso pessoal — ajustar conforme a tua política de repositório.
