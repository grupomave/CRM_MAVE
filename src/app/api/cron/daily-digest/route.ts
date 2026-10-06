import { NextResponse, type NextRequest } from "next/server";
import { runDailyDigest } from "@/lib/digest";

// Resumo diário de atividades por e-mail. Agendado em vercel.json para 08:00 de
// Brasília (11:00 UTC). A Vercel envia "Authorization: Bearer <CRON_SECRET>".
//   ?dry=1    só mostra quem receberia o quê, sem enviar
//   ?force=1  reenvia mesmo para quem já recebeu hoje

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const force = request.nextUrl.searchParams.get("force") === "1";

  try {
    const result = await runDailyDigest({ dryRun, force });
    if (!dryRun && !result.mailConfigured && result.planned.length > 0) {
      return NextResponse.json(
        { ...result, error: "Envio de e-mail não configurado (RESEND_API_KEY / MAIL_FROM)" },
        { status: 503 },
      );
    }
    return NextResponse.json(result, { status: result.errors.length > 0 ? 207 : 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao gerar o resumo diário" },
      { status: 500 },
    );
  }
}
