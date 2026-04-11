import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  try {
    await getResend().emails.send({ from, to, subject, html });
  } catch (err) {
    console.error("Falha ao enviar email:", err);
  }
}
