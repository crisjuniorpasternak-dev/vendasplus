import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processInbound } from "@/lib/inbound";
import { parseCloudWebhook, verifyCloudSignature } from "@/lib/whatsapp/cloud";

/** Verificação do webhook pela Meta (hub.challenge). */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && env.cloud.verifyToken && p.get("hub.verify_token") === env.cloud.verifyToken) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  if (!env.cloud.token) return NextResponse.json({ error: "Cloud API não configurada" }, { status: 503 });
  const raw = await req.text();
  if (!verifyCloudSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "payload inválido" }, { status: 400 }); }
  await processInbound(parseCloudWebhook(payload), "CLOUD_API");
  return NextResponse.json({ ok: true });
}
