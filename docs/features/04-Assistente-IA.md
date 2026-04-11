# Assistente IA

## Visão geral

Chat com inteligência artificial integrado aos dados financeiros do usuário. Usa OpenRouter (modelo gratuito) como LLM.

## Configuração

- **Env vars:** `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (opcional, default `openrouter/free`)
- **Sem dependências extras** — usa `fetch` nativo para a API OpenRouter

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/ai/chat` | Envia mensagem, retorna resposta da IA |
| GET | `/ai/conversations` | Lista últimas 30 conversas do usuário |
| GET | `/ai/conversations/:id` | Retorna conversa com todas as mensagens |
| DELETE | `/ai/conversations/:id` | Exclui conversa (cascade nas mensagens) |

## Models

```prisma
model AiConversation {
  id        String      @id @default(uuid())
  userId    String
  title     String?
  messages  AiMessage[]
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
}

model AiMessage {
  id             String         @id @default(uuid())
  conversationId String
  role           String         // "user" | "assistant"
  content        String
  model          String?        // modelo LLM usado
  createdAt      DateTime       @default(now())
}
```

## Contexto financeiro

A cada mensagem, o backend monta automaticamente um contexto com:
- Mês de referência atual
- Renda cadastrada
- Total gasto (fixas + variáveis + cartão)
- Top 6 categorias de gasto
- Cartões de crédito (nome, aberto, limite, % uso)
- Próximas 4 faturas (cartão, valor, vencimento)

Este contexto é injetado no system prompt como `DADOS FINANCEIROS DO USUÁRIO`.

## System prompt

- Respostas em português brasileiro
- Curtas, diretas e práticas
- Valores em R$ com duas casas decimais
- Nunca inventa dados
- Nunca revela informações técnicas
- Pode sugerir economias e alertar sobre gastos altos
- Redireciona perguntas fora do tema financeiro

## Fluxo de persistência

1. Frontend envia `{ message, conversationId? }`
2. Se sem `conversationId`, cria nova conversa (título = primeiros 80 chars)
3. Salva mensagem do usuário no banco
4. Carrega histórico da conversa (até 40 mensagens)
5. Envia para OpenRouter com contexto financeiro + histórico
6. Salva resposta da IA no banco (inclui nome do modelo usado)
7. Retorna `{ reply, model, conversationId }`

## Parâmetros do LLM

- `max_tokens: 800`
- `temperature: 0.4` (respostas consistentes)
- Headers: `HTTP-Referer`, `X-Title` para ranking no OpenRouter
