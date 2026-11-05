import { z } from "zod";
import { route, json } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveMedia } from "@/lib/storage";

export const GET = route(async () => {
  await requireUser();
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { list: { select: { name: true } }, connection: { select: { name: true, provider: true } } },
  });
  const stats = await prisma.campaignRecipient.groupBy({ by: ["campaignId", "status"], _count: true });
  return json(
    campaigns.map((c) => {
      const s = Object.fromEntries(stats.filter((x) => x.campaignId === c.id).map((x) => [x.status, x._count]));
      return { ...c, stats: { PENDING: s.PENDING ?? 0, SENT: s.SENT ?? 0, FAILED: s.FAILED ?? 0, SKIPPED: s.SKIPPED ?? 0 } };
    }),
  );
});

const schema = z.object({
  name: z.string().min(1),
  message: z.string().default(""),
  listId: z.string().min(1),
  connectionId: z.string().min(1),
  minDelaySec: z.coerce.number().int().min(5).default(20),
  maxDelaySec: z.coerce.number().int().min(5).default(45),
  windowStart: z.coerce.number().int().min(0).max(23).default(8),
  windowEnd: z.coerce.number().int().min(0).max(24).default(20),
  batchSize: z.coerce.number().int().min(0).default(50),
  batchPauseSec: z.coerce.number().int().min(0).default(600),
  templateName: z.string().optional(),
  templateLang: z.string().optional(),
  scheduledAt: z.string().optional(),
  start: z.string().optional(),
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const form = await req.formData();
  const raw = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string" && v !== ""));
  const b = schema.parse(raw);
  if (!b.message.trim() && !b.templateName) throw new HttpError(400, "Escreva a mensagem ou informe um template");
  if (b.maxDelaySec < b.minDelaySec) throw new HttpError(400, "Intervalo máximo deve ser maior ou igual ao mínimo");
  const members = await prisma.contactListMember.findMany({ where: { listId: b.listId, contact: { optOut: false } }, select: { contactId: true } });
  if (!members.length) throw new HttpError(400, "A lista selecionada não tem contatos válidos");

  let media: { mediaPath: string; mediaMime: string; mediaFileName: string } | undefined;
  const f = form.get("file");
  if (f && typeof f !== "string" && f.size > 0) {
    media = { mediaPath: await saveMedia(Buffer.from(await f.arrayBuffer()), f.type, f.name), mediaMime: f.type || "application/octet-stream", mediaFileName: f.name };
  }

  const start = b.start === "1";
  const campaign = await prisma.campaign.create({
    data: {
      name: b.name, message: b.message, listId: b.listId, connectionId: b.connectionId, createdById: user.id,
      minDelaySec: b.minDelaySec, maxDelaySec: b.maxDelaySec, windowStart: b.windowStart, windowEnd: b.windowEnd,
      batchSize: b.batchSize, batchPauseSec: b.batchPauseSec,
      templateName: b.templateName || null, templateLang: b.templateLang || "pt_BR",
      scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : null,
      status: start ? "RUNNING" : "DRAFT",
      startedAt: start ? new Date() : null,
      ...media,
      recipients: { createMany: { data: members.map((m) => ({ contactId: m.contactId })) } },
    },
  });
  return json(campaign, { status: 201 });
});
