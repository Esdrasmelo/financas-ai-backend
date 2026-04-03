# Especificação Completa da Aplicação de Gestão Financeira Pessoal

## 1. Objetivo do Projeto

Construir uma aplicação **local-first** para gestão financeira pessoal, com foco em reduzir o trabalho manual atualmente feito em Excel e oferecer uma experiência mais eficiente para:

- cadastro de contas fixas
- cadastro de gastos variáveis ao longo do mês
- cadastro e gestão de cartões de crédito
- cadastro de compras feitas no cartão de crédito
- cálculo e organização por faturas
- suporte a compras parceladas
- consolidação de dados em dashboards com KPIs

A aplicação deve ser construída com:

- **TypeScript**
- **Next.js** (frontend)
- **Express** (backend)
- **Prisma ORM**
- **SQLite**
- **DDD (Domain-Driven Design)**

---

## 2. Premissas Gerais

1. A aplicação rodará localmente.
2. Não haverá necessidade inicial de cloud, multi-tenant ou deploy distribuído.
3. O foco do sistema é uso pessoal, mas a arquitetura deve ser organizada e escalável.
4. O domínio deve ser modelado antes da persistência.
5. O Prisma não deve definir o domínio; ele deve apenas persistir o que o domínio modelar.
6. O frontend deve ser desacoplado da regra de negócio crítica.
7. O backend será o responsável por regras de competência, parcelamento, fatura, projeções e consolidação.

---

## 3. Visão do Domínio

A aplicação pertence ao domínio de **Gestão Financeira Pessoal**, com ênfase em:

- despesas recorrentes
- despesas variáveis
- controle de compras no cartão
- gestão de faturas
- projeção de compromissos futuros
- indicadores financeiros mensais

### 3.1 Subdomínios

#### Core Domain
- Controle financeiro mensal
- Gestão de cartões de crédito e faturas
- Geração e projeção de parcelas
- Consolidação de gastos e KPIs

#### Supporting Subdomains
- Categorias e classificação de gastos
- Geração de lançamentos recorrentes
- Dashboard e analytics

#### Generic Subdomains
- Configurações locais
- Persistência
- Logging
- Validações de interface

---

## 4. Linguagem Ubíqua

Os seguintes termos devem ser usados de forma consistente no código, backend, frontend e documentação:

- Conta Fixa
- Gasto Variável
- Lançamento
- Categoria
- Cartão de Crédito
- Compra no Cartão
- Compra Parcelada
- Parcela
- Fatura
- Fechamento da Fatura
- Vencimento da Fatura
- Competência
- Dashboard
- KPI
- Próxima Fatura
- Total Comprometido
- Limite do Cartão
- Status da Fatura

---

## 5. Regras de Negócio

### 5.1 Contas Fixas

1. O sistema deve permitir cadastrar contas fixas.
2. Cada conta fixa deve possuir pelo menos:
   - nome
   - descrição opcional
   - valor
   - categoria
   - dia de vencimento ou referência no mês
   - status ativa/inativa
3. Uma conta fixa pode ser recorrente mensalmente.
4. Contas fixas recorrentes devem gerar lançamentos mensais automaticamente.
5. Alterações em uma conta fixa não devem reescrever lançamentos históricos já gerados, a menos que exista regra explícita para isso.
6. Contas fixas inativas não devem gerar novos lançamentos mensais.

### 5.2 Gastos Variáveis

1. O sistema deve permitir cadastrar gastos que acontecem ao longo do mês.
2. Cada gasto variável deve possuir:
   - descrição
   - valor
   - data do gasto
   - categoria
   - forma de pagamento
3. Formas de pagamento iniciais:
   - dinheiro
   - débito
   - PIX
   - cartão de crédito
4. Gastos não pagos via cartão não devem gerar faturas.

### 5.3 Cartões de Crédito

1. O sistema deve permitir cadastrar um ou mais cartões de crédito.
2. Cada cartão deve possuir:
   - nome/apelido
   - bandeira opcional
   - limite opcional
   - dia de vencimento da fatura
   - dia de fechamento da fatura ou regra de estimativa
3. O sistema deve considerar o ciclo do cartão para definir em qual fatura uma compra entra.
4. Caso a compra seja feita após o fechamento, ela deve entrar na próxima fatura.
5. O sistema deve permitir estimar a data de fechamento quando necessário.

### 5.4 Faturas

1. O sistema deve representar faturas explicitamente.
2. Cada fatura deve estar vinculada a um cartão.
3. Cada fatura deve possuir:
   - período de referência
   - data de fechamento
   - data de vencimento
   - status
   - total consolidado
4. Status sugeridos para fatura:
   - aberta
   - fechada
   - paga
   - vencida
5. O sistema deve permitir listar faturas passadas, atual e futuras previstas.
6. O total da fatura deve ser calculado com base nas compras/parcela associadas a ela.

### 5.5 Compras no Cartão

1. O sistema deve permitir cadastrar compras feitas no cartão de crédito.
2. Cada compra deve possuir:
   - cartão
   - descrição
   - valor total
   - data da compra
   - categoria
   - indicação se é parcelada ou não
3. Cada compra deve ser associada a uma fatura com base na data da compra e nas regras do cartão.

### 5.6 Compras Parceladas

1. Ao cadastrar uma compra no cartão, o sistema deve permitir informar se ela é parcelada.
2. Se for parcelada, o sistema deve permitir informar:
   - quantidade total de parcelas
   - parcela atual
3. O sistema deve validar:
   - total de parcelas > 0
   - parcela atual >= 1
   - parcela atual <= total de parcelas
4. A parcela atual deve ser lançada na fatura calculada pela data da compra.
5. As parcelas futuras devem ser replicadas automaticamente mês a mês.
6. A replicação deve continuar até completar a quantidade total de parcelas cadastradas para aquela compra.
7. Se a compra for cadastrada já em andamento, o sistema deve gerar apenas da parcela atual em diante.
8. Parcelas anteriores à parcela atual não precisam ser geradas no MVP.
9. Cada parcela deve possuir:
   - número da parcela
   - total de parcelas
   - valor da parcela
   - fatura associada
   - status
10. Compras não parceladas devem gerar apenas 1 parcela lógica/financeira.

### 5.7 Competência Financeira

O sistema deve considerar duas possíveis visões analíticas:

1. **Competência por ocorrência**: o gasto entra no mês em que foi realizado.
2. **Competência por pagamento**: o gasto entra no mês da fatura ou do vencimento.

Regra de implementação:
- armazenar a data real do evento (compra/gasto)
- armazenar a fatura associada quando existir
- permitir ao dashboard filtrar ou agregar por uma das visões

### 5.8 Dashboard e KPIs

O sistema deve disponibilizar um dashboard com indicadores relevantes.

KPIs mínimos recomendados:
- total gasto no mês
- total de contas fixas do mês
- total de gastos variáveis do mês
- total gasto por cartão
- total da próxima fatura
- total em faturas abertas
- gasto por categoria
- comparação com mês anterior
- percentual comprometido do mês
- percentual de uso do limite por cartão
- total comprometido em parcelas futuras
- quantidade de compras parceladas ativas

---

## 6. Modelagem Conceitual do Domínio

### 6.1 Bounded Contexts

#### Financial Entries Context
Responsável por:
- contas fixas
- gastos variáveis
- lançamentos financeiros mensais
- categorias

#### Credit Cards Context
Responsável por:
- cartões de crédito
- faturas
- compras no cartão
- parcelas
- cálculo de ciclo de fatura

#### Dashboard Context
Responsável por:
- consolidação de dados
- KPIs
- comparativos mensais
- visões analíticas

### 6.2 Entidades Principais

#### FixedExpense
Representa uma conta fixa/recorrente.

Campos conceituais:
- id
- name
- description
- amount
- categoryId
- dueDay
- isActive
- isRecurringMonthly
- createdAt
- updatedAt

#### MonthlyEntry
Representa um lançamento financeiro do mês.

Campos conceituais:
- id
- description
- amount
- date
- competencyMonth
- categoryId
- paymentMethod
- sourceType
- fixedExpenseId opcional
- createdAt
- updatedAt

#### Category
Representa a categoria de classificação.

Campos conceituais:
- id
- name
- type (expense / income futuramente)
- color opcional
- icon opcional

#### CreditCard
Representa um cartão de crédito.

Campos conceituais:
- id
- name
- brand opcional
- limitAmount opcional
- closingDay
- dueDay
- isActive
- createdAt
- updatedAt

#### Statement
Representa a fatura.

Campos conceituais:
- id
- creditCardId
- referenceMonth
- periodStart
- periodEnd
- closingDate
- dueDate
- status
- totalAmount
- createdAt
- updatedAt

#### CreditCardPurchase
Representa a compra original feita no cartão.

Campos conceituais:
- id
- creditCardId
- categoryId
- description
- purchaseDate
- totalAmount
- isInstallmentPurchase
- totalInstallments
- currentInstallment
- installmentAmount
- createdAt
- updatedAt

#### PurchaseInstallment
Representa cada parcela derivada da compra.

Campos conceituais:
- id
- purchaseId
- statementId
- installmentNumber
- totalInstallments
- amount
- competencyMonth
- status
- createdAt
- updatedAt

### 6.3 Value Objects

Criar Value Objects sempre que fizer sentido para encapsular validações e invariantes.

Sugestões:
- Money
- DueDay
- ClosingDay
- CompetencyMonth
- StatementPeriod
- InstallmentInfo
- PurchaseDate
- ExpenseDescription

### 6.4 Agregados

Sugestão principal:

#### Aggregate Root: FixedExpense
Responsável pelas regras da conta fixa e recorrência.

#### Aggregate Root: CreditCardPurchase
Responsável por:
- validar parcelamento
- gerar parcelas
- manter consistência entre compra e parcelas

#### Aggregate Root: Statement
Responsável por:
- consolidar parcelas e compras
- controlar status da fatura

---

## 7. Casos de Uso

### 7.1 Financial Entries Context
- CreateFixedExpense
- UpdateFixedExpense
- DisableFixedExpense
- GenerateMonthlyEntriesFromFixedExpenses
- RegisterVariableExpense
- ListMonthlyEntries
- GetMonthlyEntriesSummary

### 7.2 Credit Cards Context
- CreateCreditCard
- UpdateCreditCard
- EstimateStatementCycle
- RegisterCreditCardPurchase
- RegisterInstallmentPurchase
- RegisterSinglePaymentPurchase
- GeneratePurchaseInstallments
- AssignInstallmentsToStatements
- ListStatementsByCard
- GetStatementDetails
- MarkStatementAsPaid
- ListFutureInstallments

### 7.3 Dashboard Context
- GetMonthlyFinancialSummary
- GetExpensesByCategory
- GetCreditCardOverview
- GetUpcomingStatements
- GetInstallmentCommitments
- GetDashboardKPIs

---

## 8. Arquitetura Obrigatória: DDD

A aplicação deve seguir DDD com separação clara entre domínio, aplicação, infraestrutura e apresentação.

### 8.1 Regras de Dependência

1. O domínio não depende de Express, Prisma, SQLite ou Next.js.
2. A camada de aplicação depende do domínio.
3. A infraestrutura depende da aplicação e do domínio.
4. A camada HTTP/controladores depende da aplicação.
5. O frontend consome a API do backend.
6. Regras de negócio não devem ficar em controllers nem em componentes React.

### 8.2 Estrutura de Pastas Sugerida

```txt
backend/
  src/
    modules/
      financial/
        domain/
          entities/
          value-objects/
          repositories/
          services/
          errors/
        application/
          use-cases/
          dto/
        infrastructure/
          prisma/
            repositories/
            mappers/
          http/
            controllers/
            routes/
      credit-cards/
        domain/
          entities/
          value-objects/
          repositories/
          services/
          errors/
        application/
          use-cases/
          dto/
        infrastructure/
          prisma/
            repositories/
            mappers/
          http/
            controllers/
            routes/
      dashboard/
        application/
          use-cases/
          dto/
        infrastructure/
          queries/
          http/
            controllers/
            routes/
    shared/
      domain/
        entities/
        value-objects/
        errors/
      infrastructure/
        prisma/
        http/
      utils/
```

---

## 9. Especificação do Back-end

### 9.1 Stack do Back-end
- Node.js
- TypeScript
- Express
- Prisma
- SQLite

### 9.2 Responsabilidades do Back-end

O backend deve ser a fonte da verdade para:
- regras de negócio
- validações do domínio
- geração de parcelas
- associação de compras às faturas
- geração de lançamentos mensais recorrentes
- cálculo dos KPIs

### 9.3 Camadas

#### Domain
Deve conter:
- entidades ricas
- value objects
- interfaces de repositório
- serviços de domínio
- erros de domínio
- invariantes

#### Application
Deve conter:
- casos de uso
- DTOs de entrada e saída
- orquestração do domínio

#### Infrastructure
Deve conter:
- implementação de repositórios com Prisma
- mapeadores entre domínio e banco
- configuração do Prisma
- controllers HTTP do Express
- rotas

### 9.4 Regras de Implementação

1. Controllers devem ser finos.
2. Controllers não devem conter regra de negócio.
3. Cada rota deve delegar para um caso de uso.
4. O Prisma deve ser usado apenas na infraestrutura.
5. Deve haver mappers entre entidades de domínio e modelos do Prisma.
6. O backend deve expor rotas REST claras para o frontend.

### 9.5 Sugestão de Rotas REST

#### Categorias
- `GET /categories`
- `POST /categories`
- `PUT /categories/:id`
- `DELETE /categories/:id`

#### Contas Fixas
- `GET /fixed-expenses`
- `POST /fixed-expenses`
- `PUT /fixed-expenses/:id`
- `PATCH /fixed-expenses/:id/disable`
- `POST /fixed-expenses/generate-monthly-entries`

#### Lançamentos / Gastos Variáveis
- `GET /entries`
- `GET /entries/monthly-summary`
- `POST /entries`
- `PUT /entries/:id`
- `DELETE /entries/:id`

#### Cartões de Crédito
- `GET /credit-cards`
- `POST /credit-cards`
- `PUT /credit-cards/:id`
- `GET /credit-cards/:id/statements`

#### Compras no Cartão
- `GET /credit-card-purchases`
- `POST /credit-card-purchases`
- `GET /credit-card-purchases/:id`

#### Faturas
- `GET /statements`
- `GET /statements/:id`
- `PATCH /statements/:id/pay`

#### Dashboard
- `GET /dashboard/kpis`
- `GET /dashboard/monthly-summary`
- `GET /dashboard/category-breakdown`
- `GET /dashboard/credit-cards-overview`
- `GET /dashboard/future-commitments`

### 9.6 Fluxos Críticos do Back-end

#### Fluxo: criar compra parcelada
1. Receber request.
2. Validar DTO.
3. Criar entidade de domínio da compra.
4. Validar regras de parcelamento.
5. Calcular fatura da parcela atual.
6. Gerar parcelas futuras.
7. Criar ou localizar faturas necessárias.
8. Persistir compra e parcelas.
9. Retornar resposta consolidada.

#### Fluxo: gerar lançamentos mensais das contas fixas
1. Receber mês de referência.
2. Buscar contas fixas ativas.
3. Gerar lançamentos do mês para as recorrentes.
4. Evitar duplicidade.
5. Persistir lançamentos.
6. Retornar resumo do que foi gerado.

---

## 10. Especificação do Front-end

### 10.1 Stack do Front-end
- Next.js
- TypeScript
- React
- consumo da API Express
- shadcn/ui para componentes
- Tailwind CSS

### 10.2 Observação sobre shadcn/ui

O uso de **shadcn/ui é viável e recomendado** para esta aplicação.

Motivos:
- integra muito bem com Next.js
- oferece componentes modernos e acessíveis
- permite personalização total porque os componentes ficam no projeto
- combina muito bem com dashboards, forms, dialogs, sheets, tables e cards
- é uma boa base para um sistema administrativo/local-first

### 10.3 Padrão de Front-end

O frontend deve ser responsável por:
- exibir dados
- capturar entrada do usuário
- organizar navegação
- aplicar feedback visual
- consumir a API do backend

O frontend **não deve centralizar regras de negócio críticas**, como:
- geração de parcelas
- cálculo de faturas
- cálculo de ciclo do cartão
- lógica principal de dashboard

### 10.4 Estrutura Sugerida do Front-end

```txt
frontend/
  src/
    app/
      dashboard/
      fixed-expenses/
      entries/
      credit-cards/
      statements/
      purchases/
      categories/
    components/
      ui/
      forms/
      cards/
      charts/
      layout/
      tables/
    features/
      fixed-expenses/
      entries/
      credit-cards/
      dashboard/
    services/
      api/
    hooks/
    lib/
    types/
    validators/
```

### 10.5 Telas Principais

#### Dashboard
Deve mostrar:
- total gasto no mês
- contas fixas do mês
- gastos variáveis
- total por cartão
- próxima fatura
- gráficos por categoria
- comparação mensal
- compromissos futuros

#### Contas Fixas
- listagem
- cadastro
- edição
- ativar/inativar
- geração mensal manual

#### Gastos Variáveis / Lançamentos
- listagem do mês
- cadastro
- filtros por período/categoria
- edição/exclusão

#### Cartões de Crédito
- listagem
- cadastro
- edição
- resumo do cartão
- limite utilizado

#### Compras no Cartão
- cadastro
- seleção do cartão
- categoria
- valor total
- compra parcelada ou não
- total de parcelas
- parcela atual
- preview da distribuição em faturas

#### Faturas
- listagem por cartão
- detalhe da fatura
- lista de compras/parcela
- total
- status
- marcar como paga

#### Categorias
- CRUD simples

### 10.6 Componentes de UI sugeridos com shadcn/ui

- Button
- Card
- Input
- Form
- Select
- Dialog
- Sheet
- Tabs
- Table
- Badge
- Calendar
- Popover
- Dropdown Menu
- Tooltip
- Separator
- Skeleton
- Alert Dialog
- Toast / Sonner
- Progress

### 10.7 Gráficos

Sugestão:
- Recharts para gráficos

Gráficos úteis:
- gastos por categoria
- comparação mensal
- distribuição por forma de pagamento
- uso do limite por cartão
- evolução mensal de gastos

---

## 11. Experiência de Usuário Desejada

### 11.1 Objetivos de UX

A aplicação deve ser mais rápida, agradável e simples do que o Excel para o mesmo trabalho.

### 11.2 Requisitos de UX

1. Cadastro rápido de gastos.
2. Fluxo simples para compras no cartão.
3. Feedback imediato ao usuário sobre em qual fatura a compra cairá.
4. Preview de parcelas futuras.
5. Dashboard legível e útil.
6. Navegação clara por domínio.
7. Interface limpa, moderna e com boa hierarquia visual.

### 11.3 Funcionalidades de UX recomendadas

- filtros por mês e categoria
- atalhos para criar gastos rapidamente
- preenchimento inteligente de data atual
- visualização resumida do mês atual
- destaque para vencimentos próximos
- destaque para faturas abertas e futuras

---

## 12. Persistência com Prisma e SQLite

### 12.1 Regras

1. O schema Prisma deve refletir a persistência, não o modelo completo do domínio.
2. Deve haver mapper entre modelo Prisma e entidade de domínio.
3. Não usar diretamente objetos do Prisma como entidades de domínio.

### 12.2 Modelos mínimos esperados no banco

Sugestão de modelos de persistência:
- Category
- FixedExpense
- MonthlyEntry
- CreditCard
- Statement
- CreditCardPurchase
- PurchaseInstallment

### 12.3 Relacionamentos mínimos

- Category 1:N FixedExpense
- Category 1:N MonthlyEntry
- Category 1:N CreditCardPurchase
- CreditCard 1:N Statement
- CreditCard 1:N CreditCardPurchase
- CreditCardPurchase 1:N PurchaseInstallment
- Statement 1:N PurchaseInstallment

### 12.4 Observações importantes

1. O cálculo de totais consolidados pode ser materializado ou calculado sob demanda.
2. No MVP, pode ser calculado sob demanda.
3. Para compras parceladas, cada parcela deve ficar persistida explicitamente.
4. Isso facilita dashboard, projeções, listagens e detalhe de fatura.

---

## 13. Regras de Cálculo Importantes

### 13.1 Cálculo da Fatura

Ao cadastrar uma compra no cartão:
1. identificar o cartão
2. ler dia de fechamento
3. ler dia de vencimento
4. verificar a data da compra
5. determinar se a compra entra na fatura atual ou próxima
6. localizar ou criar a fatura correspondente

### 13.2 Cálculo de Parcelas

Para compras parceladas:
1. validar total de parcelas e parcela atual
2. calcular valor da parcela
3. gerar a parcela atual na fatura corrente
4. gerar as próximas parcelas mês a mês
5. parar quando `installmentNumber == totalInstallments`

### 13.3 Geração de Competência

O sistema deve representar `competencyMonth` para permitir agrupamentos temporais consistentes.

Formato sugerido:
- `YYYY-MM`

---

## 14. Não Funcionais

### 14.1 Código
- código limpo e legível
- tipagem forte com TypeScript
- baixo acoplamento
- alta coesão
- separação clara de responsabilidades

### 14.2 Qualidade
- validações no domínio
- tratamento consistente de erros
- DTOs tipados
- organização modular

### 14.3 Testes

Priorizar testes para:
- geração de parcelas
- cálculo de faturas
- recorrência de contas fixas
- cálculos do dashboard
- regras de competência

Tipos sugeridos:
- testes unitários para domínio
- testes de integração para use cases e repositórios

---

## 15. Fora de Escopo Inicial

Não implementar no MVP, salvo se houver tempo:

- autenticação complexa
- múltiplos usuários
- sincronização em nuvem
- importação bancária automática
- conciliação bancária
- integração com APIs externas
- receitas complexas
- investimentos
- metas financeiras avançadas
- notificações em background

---

## 16. Roadmap de Entrega Recomendado

### Fase 1
- categorias
- contas fixas
- gastos variáveis
- listagem mensal

### Fase 2
- cartões de crédito
- faturas
- compras no cartão
- cálculo de fatura

### Fase 3
- compras parceladas
- geração automática de parcelas futuras
- tela detalhada de faturas

### Fase 4
- dashboard completo
- comparativos mensais
- compromissos futuros
- uso do limite por cartão

---

## 17. Instruções Diretas para Implementação no CursorAI

### 17.1 Objetivo de implementação
Construir a aplicação completa com frontend e backend, mantendo rigorosamente:

- TypeScript em toda a stack
- Next.js no frontend
- Express no backend
- Prisma ORM
- SQLite
- DDD
- separação entre camadas
- regras de negócio no backend/domain

### 17.2 Restrições obrigatórias

1. Não colocar regra de negócio importante em componentes React.
2. Não colocar regra de negócio importante diretamente nos controllers.
3. Não usar modelos Prisma como entidades de domínio.
4. Criar entidades, value objects, use cases e repositórios por contexto.
5. Criar a funcionalidade de compras parceladas com geração explícita das parcelas futuras.
6. Criar a lógica de fatura com base em fechamento e vencimento.
7. Criar dashboard consumindo endpoints agregados do backend.
8. Usar shadcn/ui no frontend com Tailwind CSS.

### 17.3 Resultado esperado

O projeto final deve conter:
- frontend funcional em Next.js
- backend funcional em Express
- banco SQLite via Prisma
- CRUDs principais
- geração de faturas
- geração de parcelas
- dashboard com KPIs
- arquitetura organizada e evolutiva

---

## 18. Resumo Executivo Final

Esta aplicação deve substituir um processo manual em Excel por um sistema local organizado, com foco em experiência de uso, automação de lançamentos financeiros e controle inteligente de cartão de crédito.

O ponto mais importante do domínio é tratar corretamente:
- contas fixas recorrentes
- gastos variáveis
- ciclo de cartão de crédito
- faturas
- compras parceladas com projeção futura
- indicadores consolidados

A implementação deve respeitar DDD, manter o domínio isolado da infraestrutura e oferecer uma interface moderna com Next.js + shadcn/ui.
