import { route, json } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getProvider } from "@/lib/whatsapp";

/** Aponta o webhook da instância Evolution para este sistema. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  await requireAdmin();
  const conn = await prisma.connection.findUniqueOrThrow({ where: { id: (await params).id } });
  const p = getProvider(conn);
  if (!p.setWebhook) throw new HttpError(400, "Na Cloud API o webhook é configurado no painel da Meta");
  const url = `${env.appUrl}/api/webhooks/evolution${env.webhookSecret ? `?token=${encodeURIComponent(env.webhookSecret)}` : ""}`;
  try {
    await p.setWebhook(url);
    return json({ ok: true, url: url.replace(env.webhookSecret || "\u0000", "***") });
  } catch (e) {
    throw new HttpError(502, e instanceof Error ? e.message : "Falha ao configurar webhook");
  }
});
