import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { route, json } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { findOrCreateContact, findOrCreateConversation, getDefaultConnection, logHistory } from "@/lib/messaging";

export const GET = route(async (req) => {
  const user = await requireUser();
  const p = new URL(req.url).searchParams;
  const tab = p.get("tab") ?? "all";
  const q = p.get("q")?.trim();
  const connectionId = p.get("connectionId") || undefined;
  const tagId = p.get("tagId") || undefined;
  const assignedToId = p.get("assignedToId") || undefined;
  const take = Math.min(Number(p.get("take") ?? 60), 200);

  const base: Prisma.ConversationWhereInput = {
    ...(connectionId ? { connectionId } : {}),
    ...(assignedToId ? { assignedToId } : {}),
    ...(tagId ? { contact: { tags: { some: { tagId } } } } : {}),
    ...(q
      ? {
          OR: [
            { contact: { name: { contains: q, mode: "insensitive" } } },
            { contact: { pushName: { contains: q, mode: "insensitive" } } },
            { contact: { phone: { contains: q.replace(/\D/g, "") || q } } },
            { contact: { email: { contains: q, mode: "insensitive" } } },
            ...(Number.isFinite(Number(q.replace("#", ""))) ? [{ number: Number(q.replace("#", "")) }] : []),
          ],
        }
      : {}),
  };
  const tabs: Record<string, Prisma.ConversationWhereInput> = {
    all: { status: { not: "CLOSED" } },
    pending: { status: "PENDING" },
    open: { status: "OPEN" },
    mine: { status: { not: "CLOSED" }, assignedToId: user.id },
    unread: { unreadCount: { gt: 0 } },
    closed: { status: "CLOSED" },
  };
  const where = { ...base, ...(tabs[tab] ?? tabs.all) };

  const [items, ...counts] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      take,
      include: {
        contact: { select: { id: true, name: true, pushName: true, phone: true, avatarUrl: true, tags: { include: { tag: true } } } },
        connection: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    ...Object.keys(tabs).map((k) => prisma.conversation.count({ where: { ...base, ...tabs[k] } })),
  ]);
  const countMap = Object.fromEntries(Object.keys(tabs).map((k, i) => [k, counts[i]]));
  return json({ items, counts: countMap });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = z.object({ phone: z.string().min(8), name: z.string().optional(), connectionId: z.string().optional() }).parse(await req.json());
  const conn = body.connectionId ? await prisma.connection.findUnique({ where: { id: body.connectionId } }) : await getDefaultConnection();
  if (!conn) throw new HttpError(400, "Nenhuma conexão cadastrada. Cadastre uma em Conexões.");
  const contact = await findOrCreateContact(body.phone);
  if (body.name && !contact.name) await prisma.contact.update({ where: { id: contact.id }, data: { name: body.name } });
  const { conversation, created } = await findOrCreateConversation(contact.id, conn.id, "OPEN");
  const conv = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { status: "OPEN", assignedToId: user.id, closedAt: null },
  });
  if (created) await logHistory({ contactId: contact.id, conversationId: conv.id, userId: user.id, type: "conversation_started", description: `Conversa iniciada por ${user.name}` });
  return json(conv, { status: 201 });
});
