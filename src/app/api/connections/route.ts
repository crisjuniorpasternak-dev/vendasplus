import { z } from "zod";
import { route, json } from "@/lib/api";
import { requireAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getDefaultConnection } from "@/lib/messaging";

export const GET = route(async () => {
  await requireUser();
  await getDefaultConnection(); // cria a conexão padrão a partir do .env se ainda não existir
  const items = await prisma.connection.findMany({ orderBy: { createdAt: "asc" } });
  return json({
    items,
    config: {
      evolutionConfigured: !!(env.evolution.url && env.evolution.apiKey),
      evolutionUrl: env.evolution.url || null,
      cloudConfigured: !!env.cloud.token,
      webhookEvolution: `${env.appUrl}/api/webhooks/evolution?token=${env.webhookSecret ? "<WEBHOOK_SECRET>" : ""}`,
      webhookCloud: `${env.appUrl}/api/webhooks/cloud`,
    },
  });
});

export const POST = route(async (req) => {
  await requireAdmin();
  const b = z.object({ name: z.string().min(1), provider: z.enum(["EVOLUTION", "CLOUD_API"]), instanceName: z.string().min(1), isDefault: z.boolean().optional() }).parse(await req.json());
  if (b.isDefault) await prisma.connection.updateMany({ data: { isDefault: false } });
  return json(await prisma.connection.create({ data: b }), { status: 201 });
});
