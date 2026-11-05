import { route, json } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appUrl, webhookSecret } from "@/lib/settings";
import { getProvider } from "@/lib/whatsapp";

/** Aponta o webhook da instância Evolution para este sistema. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  await requireAdmin();
  const conn = await prisma.connection.findUniqueOrThrow({ where: { id: (await params).id } });
  const p = getProvider(conn);
  if (!p.setWebhook) throw new HttpError(400, "Na Cloud API o webhook é configurado no painel da Meta");
  const secret = await webhookSecret();
  const url = `${appUrl(req)}/api/webhooks/evolution?token=${encodeURIComponent(secret)}`;
  try {
    await p.setWebhook(url);
    return json({ ok: true, url: url.replace(secret, "***") });
  } catch (e) {
    throw new HttpError(502, e instanceof Error ? e.message : "Falha ao configurar webhook");
  }
});
