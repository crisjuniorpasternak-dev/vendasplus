import { route, json } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/messaging";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  await requireUser();
  const { id } = await params;
  const p = new URL(req.url).searchParams;
  const before = p.get("before");
  const take = Math.min(Number(p.get("take") ?? 80), 200);
  const msgs = await prisma.message.findMany({
    where: { conversationId: id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: "desc" },
    take,
    include: { sender: { select: { id: true, name: true } } },
  });
  const events = await prisma.historyEvent.findMany({
    where: { conversationId: id, type: { in: ["conversation_assign", "conversation_accept", "conversation_close", "conversation_reopen", "conversation_reopened", "conversation_pending"] }, ...(msgs.length ? { createdAt: { gte: msgs[msgs.length - 1].createdAt } } : {}) },
    orderBy: { createdAt: "asc" },
  });
  return json({ messages: msgs.reverse(), events, hasMore: msgs.length === take });
});

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const form = await req.formData();
  const text = (form.get("text") as string | null) ?? "";
  const f = form.get("file");
  const voice = form.get("voice") === "1";
  const sign = form.get("sign") === "1";
  let file;
  if (f && typeof f !== "string") {
    if (f.size > 64 * 1024 * 1024) throw new HttpError(413, "Arquivo maior que 64 MB");
    file = { data: Buffer.from(await f.arrayBuffer()), mime: f.type || "application/octet-stream", fileName: f.name };
  }
  if (!text.trim() && !file) throw new HttpError(400, "Mensagem vazia");

  const conv = await prisma.conversation.findUniqueOrThrow({ where: { id } });
  // responder assume o atendimento se estiver na fila
  if (conv.status !== "OPEN" || !conv.assignedToId) {
    await prisma.conversation.update({ where: { id }, data: { status: "OPEN", assignedToId: conv.assignedToId ?? user.id, closedAt: null } });
    if (!conv.assignedToId) {
      await prisma.historyEvent.create({ data: { contactId: conv.contactId, conversationId: id, userId: user.id, type: "conversation_accept", description: `${user.name} assumiu o atendimento` } });
    }
  }
  try {
    const msg = await sendMessage({ conversationId: id, text, file, voice, userId: user.id, source: "agent", signature: sign ? user.name : null });
    return json(msg, { status: 201 });
  } catch (e) {
    throw new HttpError(502, e instanceof Error ? e.message : "Falha no envio");
  }
});
