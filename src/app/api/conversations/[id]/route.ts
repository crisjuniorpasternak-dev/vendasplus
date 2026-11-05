import { z } from "zod";
import { route, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logHistory } from "@/lib/messaging";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;
  const conv = await prisma.conversation.findUniqueOrThrow({
    where: { id },
    include: {
      connection: { select: { id: true, name: true, provider: true, status: true } },
      assignedTo: { select: { id: true, name: true } },
      contact: {
        include: {
          tags: { include: { tag: true } },
          lists: { include: { list: true } },
          deals: { include: { stage: true, owner: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
          history: { orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } } } },
        },
      },
    },
  });
  return json(conv);
});

const patchSchema = z.object({
  action: z.enum(["close", "reopen", "assign", "accept", "pending"]),
  userId: z.string().nullable().optional(),
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { action, userId } = patchSchema.parse(await req.json());
  const conv = await prisma.conversation.findUniqueOrThrow({ where: { id } });
  let description = "";
  let data = {};
  switch (action) {
    case "close":
      data = { status: "CLOSED", closedAt: new Date(), unreadCount: 0 };
      description = `Conversa #${conv.number} finalizada por ${user.name}`;
      break;
    case "reopen":
      data = { status: "OPEN", closedAt: null, assignedToId: conv.assignedToId ?? user.id };
      description = `Conversa #${conv.number} reaberta por ${user.name}`;
      break;
    case "accept":
      data = { status: "OPEN", assignedToId: user.id };
      description = `${user.name} assumiu o atendimento`;
      break;
    case "pending":
      data = { status: "PENDING", assignedToId: null };
      description = `Conversa devolvida para a fila por ${user.name}`;
      break;
    case "assign": {
      const target = userId ? await prisma.user.findUniqueOrThrow({ where: { id: userId } }) : null;
      data = { assignedToId: target?.id ?? null, status: target ? "OPEN" : "PENDING" };
      description = target ? `Atendente da conversa alterado para ${target.name}` : "Atendente removido da conversa";
      break;
    }
  }
  const updated = await prisma.conversation.update({ where: { id }, data });
  await logHistory({ contactId: conv.contactId, conversationId: id, userId: user.id, type: `conversation_${action}`, description });
  return json(updated);
});
