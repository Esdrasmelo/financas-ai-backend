# Integração com Resend (Email)

## Visão geral

Envio de emails transacionais via API do Resend. Usado para boas-vindas no registro e redefinição de senha.

## Configuração

- **Dependência:** `resend` (SDK oficial)
- **Env vars:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- **Remetente padrão:** `onboarding@resend.dev` (testes)

## Serviço de email

**Arquivo:** `src/shared/infrastructure/email/resend-client.ts`

```typescript
export async function sendEmail(to: string, subject: string, html: string): Promise<void>
```

- Inicialização lazy (evita crash se API key não está configurada no import)
- Erros são logados mas não propagados (fire-and-forget)

## Templates

**Arquivo:** `src/shared/infrastructure/email/templates.ts`

### `welcomeEmail(name: string): string`

Email de boas-vindas enviado após registro:
- Monograma "P" como logo (puro HTML, sem imagem externa)
- Título "Bem-vindo, {nome}"
- 4 features listadas com emojis (Dashboard, Cartões, Planejamento, IA)
- Botão CTA verde pill "Acessar minha conta"
- Link para o guia de uso

### `passwordResetEmail(name: string, resetLink: string): string`

Email de redefinição de senha:
- Emoji de cadeado centralizado
- Título "Redefinir sua senha"
- Nota de expiração "Este link expira em 1 hora"
- Botão CTA "Criar nova senha"
- Bloco warning "Não foi você?"
- Link fallback em bloco monospace

## Design dos templates

- Layout centralizado, max-width 520px
- Card branco com border-radius 16px e borda sutil
- Logo como monograma "P" em div estilizado (sem dependência de imagem)
- Botão pill verde (#22c55e) com border-radius 50px
- Footer com nome, tagline e disclaimer
- Inline styles para compatibilidade com clientes de email
- Preheader text para preview no Gmail

## Integração

- **Registro:** `POST /auth/register` → `void sendEmail(...)` fire-and-forget
- **Forgot password:** `POST /auth/forgot-password` → `void sendEmail(...)` fire-and-forget
