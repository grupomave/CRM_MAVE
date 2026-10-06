import "server-only";

// Envio de e-mail transacional (Resend, via API REST — sem dependência extra).
// Variáveis de ambiente:
//   RESEND_API_KEY  chave da conta Resend
//   MAIL_FROM       remetente com domínio verificado, ex.: "CRM Grupo Mave <crm@grupomave.com.br>"

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function isMailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(message: MailMessage): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) return { ok: false, error: "RESEND_API_KEY / MAIL_FROM não configurados" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha de rede ao enviar e-mail" };
  }
}
