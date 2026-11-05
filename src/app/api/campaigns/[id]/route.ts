import { z } from "zod";
import { route, json } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;
  const c = await prisma.campaign.findUniqueOrThrow({
    where: { id },
    include: {
      list: true, connection: true,
      recipients: { orderBy: [{ sentAt: "desc" }], take: 500, include: { contact: { select: { name: true, pushName: true, phone: true } } } },
    },
  });
  return json(c);
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  await requireUser();
  const { id } = await params;
  const { action } = z.object({ action: z.enum(["start", "pause", "cancel", "retry_failed"]) }).parse(await req.json());
  const c = await prisma.campaign.findUniqueOrThrow({ where: { id } });
  switch (action) {
    case "start":
      if (c.status === "DONE" || c.status === "CANCELED") throw new HttpError(400, "Campanha encerrada");
      return json(await prisma.campaign.update({ where: { id }, data: { status: "RUNNING", startedAt: c.startedAt ?? new Date(), nextSendAt: null } }));
    case "pause":
      return json(await prisma.campaign.update({ where: { id }, data: { status: "PAUSED", nextSendAt: null } }));
    case "cancel":
      await prisma.campaignRecipient.updateMany({ where: { campaignId: id, status: "PENDING" }, data: { status: "SKIPPED", error: "Campanha cancelada" } });
      return json(await prisma.campaign.update({ where: { id }, data: { status: "CANCELED", finishedAt: new Date(), nextSendAt: null } }));
    case "retry_failed":
      await prisma.campaignRecipient.updateMany({ where: { campaignId: id, status: "FAILED" }, data: { status: "PENDING", error: null } });
      return json(await prisma.campaign.update({ where: { id }, data: { status: "RUNNING", finishedAt: null, nextSendAt: null } }));
  }
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;
  const c = await prisma.campaign.findUniqueOrThrow({ where: { id } });
  if (c.status === "RUNNING") throw new HttpError(400, "Pause a campanha antes de excluir");
  await prisma.campaign.delete({ where: { id } });
  return json({ ok: true });
});
