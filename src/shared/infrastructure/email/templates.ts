const PRIMARY = "#1f3d37";
const PRIMARY_BTN = "#22c55e";
const SURFACE = "#f9fafb";
const CARD = "#ffffff";
const TEXT = "#111827";
const SECONDARY = "#4b5563";
const MUTED = "#6b7280";
const LIGHT = "#9ca3af";
const FAINT = "#e5e7eb";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function siteUrl(): string {
  return process.env.FRONTEND_URL ?? "http://localhost:3000";
}

function emailShell(body: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Prisma Finanças</title>
</head>
<body style="margin:0;padding:0;background-color:${SURFACE};font-family:${FONT};-webkit-font-smoothing:antialiased">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${preheader}${"&zwnj;&nbsp;".repeat(30)}</div>` : ""}

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${SURFACE}">
    <tr><td align="center" style="padding:40px 16px">

      <!-- Logo -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px">
        <tr><td style="padding-bottom:24px;text-align:center">
          <div style="display:inline-block;width:44px;height:44px;border-radius:12px;background-color:${PRIMARY};text-align:center;line-height:44px;font-size:20px;color:#ffffff;font-weight:800;font-family:Georgia,serif">P</div>
        </td></tr>
      </table>

      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background-color:${CARD};border-radius:16px;border:1px solid ${FAINT}">
        <tr><td style="padding:48px 40px">
          ${body}
        </td></tr>
      </table>

      <!-- Footer -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px">
        <tr><td style="padding:32px 16px;text-align:center">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:${SECONDARY}">Prisma Finanças</p>
          <p style="margin:0 0 16px;font-size:12px;color:${LIGHT}">Clareza e controle para sua vida financeira</p>
          <p style="margin:0;font-size:11px;color:${LIGHT};line-height:1.7">
            Este email foi enviado automaticamente.<br>
            Se não reconhece esta ação, ignore com segurança.
          </p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

function greenButton(href: string, label: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
  <tr><td align="center" style="padding:8px 0">
    <a href="${href}" target="_blank" style="display:inline-block;background-color:${PRIMARY_BTN};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 52px;border-radius:50px;letter-spacing:0.2px">${label}</a>
  </td></tr>
</table>`;
}

function spacer(h = 28): string {
  return `<div style="height:${h}px;line-height:${h}px;font-size:1px">&nbsp;</div>`;
}

function line(): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="border-top:1px solid ${FAINT}">&nbsp;</td></tr></table>`;
}

function featureRow(emoji: string, title: string, desc: string): string {
  return `<tr>
    <td style="vertical-align:top;width:44px;padding:10px 0">
      <div style="width:36px;height:36px;border-radius:10px;background-color:${SURFACE};text-align:center;line-height:36px;font-size:17px">${emoji}</div>
    </td>
    <td style="vertical-align:top;padding:10px 0 10px 14px">
      <p style="margin:0;font-size:14px;font-weight:700;color:${TEXT}">${title}</p>
      <p style="margin:3px 0 0;font-size:13px;color:${MUTED};line-height:1.5">${desc}</p>
    </td>
  </tr>`;
}

// ─── WELCOME ─────────────────────────────────

export function welcomeEmail(name: string): string {
  const firstName = name.split(" ")[0];

  return emailShell(`
    <p style="margin:0;text-align:center;font-size:28px;font-weight:800;color:${TEXT};letter-spacing:-0.5px">
      Bem-vindo, ${firstName}!
    </p>
    <p style="margin:12px 0 0;text-align:center;font-size:15px;color:${SECONDARY};line-height:1.7">
      Sua conta foi criada com sucesso. Estamos prontos<br>para organizar suas finanças.
    </p>

    ${spacer(32)}
    ${greenButton(`${siteUrl()}/login`, "Acessar minha conta")}
    ${spacer(36)}
    ${line()}
    ${spacer(28)}

    <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:${LIGHT};letter-spacing:1.5px;text-transform:uppercase">O que você pode fazer</p>

    <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
      ${featureRow("📊", "Dashboard", "KPIs, evolução e gastos por categoria")}
      ${featureRow("💳", "Cartões", "Limite, parcelas e vencimentos")}
      ${featureRow("📋", "Planejamento", "Renda, sobra e poupança mensal")}
      ${featureRow("🤖", "Assistente IA", "Insights financeiros em tempo real")}
    </table>

    ${spacer(28)}
    ${line()}
    ${spacer(20)}

    <p style="margin:0;text-align:center;font-size:13px;color:${MUTED}">
      Precisa de ajuda? <a href="${siteUrl()}/guia" style="color:${PRIMARY};text-decoration:none;font-weight:600">Acesse o guia</a>
    </p>
  `, `Bem-vindo ao Prisma Finanças, ${firstName}! Sua conta está pronta.`);
}

// ─── PASSWORD RESET ──────────────────────────

export function passwordResetEmail(name: string, resetLink: string): string {
  const firstName = name.split(" ")[0];

  return emailShell(`
    <p style="margin:0;text-align:center;font-size:40px;line-height:1">&#x1F512;</p>

    ${spacer(20)}

    <p style="margin:0;text-align:center;font-size:28px;font-weight:800;color:${TEXT};letter-spacing:-0.5px">
      Redefinir sua senha
    </p>
    <p style="margin:12px 0 0;text-align:center;font-size:15px;color:${SECONDARY};line-height:1.7">
      Olá, ${firstName}. Recebemos um pedido para<br>redefinir a senha da sua conta.
    </p>

    ${spacer(32)}
    ${greenButton(resetLink, "Criar nova senha")}
    ${spacer(24)}

    <p style="margin:0;text-align:center;font-size:12px;color:${LIGHT}">
      Este link expira em <strong style="color:${SECONDARY}">1 hora</strong>
    </p>

    ${spacer(36)}
    ${line()}
    ${spacer(24)}

    <p style="margin:0 0 16px;font-size:14px;color:${SECONDARY};line-height:1.7">
      <strong>Não foi você?</strong> Ignore este email. Sua senha continuará segura e nenhuma alteração será feita.
    </p>

    <p style="margin:0 0 8px;font-size:12px;color:${MUTED}">
      Se o botão não funcionar, copie e cole este link:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${SURFACE};border-radius:10px">
      <tr><td style="padding:14px 16px">
        <p style="margin:0;font-size:11px;color:${LIGHT};word-break:break-all;line-height:1.7;font-family:'Courier New',Courier,monospace">
          ${resetLink}
        </p>
      </td></tr>
    </table>
  `, `Redefina sua senha no Prisma Finanças. O link expira em 1 hora.`);
}
