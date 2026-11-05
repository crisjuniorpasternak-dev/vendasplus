import { z } from "zod";
import { route, json } from "@/lib/api";
import { requireAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getDefaultConnection } from "@/lib/messaging";
import { appUrl, cronSecret, getEvolutionConfig } from "@/lib/settings";

export const GET = route(async (req) => {
  const user = await requireUser();
  await getDefaultConnection(); // cria a conexão padrão a partir do .env se ainda não existir
  const items = await prisma.connection.findMany({ orderBy: { createdAt: "asc" } });
  const evo = await getEvolutionConfig();
  const base = appUrl(req);
  const isAdmin = user.role === "ADMIN";
  return json({
    items,
    config: {
      evolutionConfigured: !!(evo.url && evo.apiKey),
      evolutionUrl: evo.url || null,
      evolutionFromEnv: evo.fromEnv,
      cloudConfigured: !!env.cloud.token,
      webhookEvolution: `${base}/api/webhooks/evolution?token=***`,
      webhookCloud: `${base}/api/webhooks/cloud`,
      // URL para o agendador externo (cron-job.org) — só para administradores
      cronUrl: isAdmin ? `${base}/api/cron/campaigns?secret=${await cronSecret()}` : null,
    },
  });
});

export const POST = route(async (req) => {
  await requireAdmin();
  const b = z.object({ name: z.string().min(1), provider: z.enum(["EVOLUTION", "CLOUD_API"]), instanceName: z.string().min(1), isDefault: z.boolean().optional() }).parse(await req.json());
  if (b.isDefault || (await prisma.connection.count()) === 0) {
    await prisma.connection.updateMany({ data: { isDefault: false } });
    b.isDefault = true;
  }
  return json(await prisma.connection.create({ data: b }), { status: 201 });
});
