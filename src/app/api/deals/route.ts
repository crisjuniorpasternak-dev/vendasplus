import { z } from "zod";
import { route, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logHistory } from "@/lib/messaging";

export const GET = route(async (req) => {
  await requireUser();
  const status = new URL(req.url).searchParams.get("status") ?? "OPEN";
  return json(
    await prisma.deal.findMany({
      where: status === "ALL" ? {} : { status: status as "OPEN" },
      orderBy: { updatedAt: "desc" },
      include: { contact: { select: { id: true, name: true, pushName: true, phone: true } }, stage: true, owner: { select: { id: true, name: true } } },
    }),
  );
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const b = z.object({ contactId: z.string(), title: z.string().optional(), value: z.coerce.number().optional(), stageId: z.string().optional(), product: z.string().optional() }).parse(await req.json());
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: b.contactId } });
  const stageId = b.stageId ?? (await prisma.pipelineStage.findFirstOrThrow({ orderBy: { order: "asc" } })).id;
  const deal = await prisma.deal.create({
    data: { contactId: contact.id, title: b.title || contact.name || contact.pushName || contact.phone, value: b.value ?? 0, stageId, ownerId: user.id, product: b.product },
  });
  await logHistory({ contactId: contact.id, userId: user.id, type: "deal_created", description: `Negócio #${deal.number} criado` });
  return json(deal, { status: 201 });
});
