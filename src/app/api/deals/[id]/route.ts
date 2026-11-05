import { z } from "zod";
import { route, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logHistory } from "@/lib/messaging";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const b = z.object({
    title: z.string().optional(), value: z.coerce.number().optional(), stageId: z.string().optional(),
    status: z.enum(["OPEN", "WON", "LOST"]).optional(), ownerId: z.string().nullable().optional(), product: z.string().nullable().optional(),
  }).parse(await req.json());
  const before = await prisma.deal.findUniqueOrThrow({ where: { id }, include: { stage: true } });
  const deal = await prisma.deal.update({ where: { id }, data: b, include: { stage: true } });
  if (b.stageId && b.stageId !== before.stageId) {
    await logHistory({ contactId: deal.contactId, userId: user.id, type: "deal_stage", description: `Negócio #${deal.number} movido de "${before.stage.name}" para "${deal.stage.name}"` });
  }
  if (b.status && b.status !== before.status) {
    const label = { OPEN: "reaberto", WON: "ganho 🎉", LOST: "perdido" }[b.status];
    await logHistory({ contactId: deal.contactId, userId: user.id, type: "deal_status", description: `Negócio #${deal.number} marcado como ${label}` });
  }
  return json(deal);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  await requireUser();
  await prisma.deal.delete({ where: { id: (await params).id } });
  return json({ ok: true });
});
