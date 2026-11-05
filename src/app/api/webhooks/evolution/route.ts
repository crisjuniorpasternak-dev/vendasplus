import { NextResponse } from "next/server";
import { webhookSecret } from "@/lib/settings";
import { processInbound } from "@/lib/inbound";
import { parseEvolutionWebhook } from "@/lib/whatsapp/evolution";

/**
 * Configure na Evolution: <APP_URL>/api/webhooks/evolution?token=<WEBHOOK_SECRET>
 * (ou use o botão "Configurar webhook" na tela de Conexões).
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (token !== (await webhookSecret())) return NextResponse.json({ error: "token inválido" }, { status: 401 });
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  await processInbound(parseEvolutionWebhook(payload), "EVOLUTION");
  return NextResponse.json({ ok: true });
}

// A Evolution também pode enviar com webhookByEvents=true (ex.: /messages-upsert)
export const PUT = POST;
