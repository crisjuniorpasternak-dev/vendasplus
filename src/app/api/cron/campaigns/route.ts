import { NextResponse } from "next/server";
import { campaignTick } from "@/lib/campaign-runner";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Worker de campanhas para ambientes serverless (Vercel).
 * Chame a cada minuto (Vercel Cron no plano Pro, ou um serviço externo como cron-job.org).
 * Cada chamada processa envios durante ~50s respeitando os intervalos de cada campanha.
 * Autenticação: header "Authorization: Bearer <CRON_SECRET>" (padrão da Vercel) ou ?secret=<CRON_SECRET>.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Defina CRON_SECRET" }, { status: 503 });
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("secret");
  if (given !== secret) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const until = Date.now() + 50_000;
  let ticks = 0;
  while (Date.now() < until) {
    await campaignTick();
    ticks++;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return NextResponse.json({ ok: true, ticks });
}
