import { route, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/whatsapp";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;
  const conv = await prisma.conversation.update({
    where: { id },
    data: { unreadCount: 0 },
    include: { contact: true, connection: true },
  });
  const unread = await prisma.message.findMany({
    where: { conversationId: id, direction: "IN", status: "RECEIVED", externalId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (unread.length) {
    await prisma.message.updateMany({ where: { id: { in: unread.map((m) => m.id) } }, data: { status: "READ" } });
    const provider = getProvider(conv.connection);
    // confirma leitura no WhatsApp (melhor esforço; não falha se a conexão estiver fora)
    Promise.allSettled(unread.map((m) => provider.markRead({ externalId: m.externalId!, phone: conv.contact.phone, fromMe: false }))).catch(() => {});
  }
  return json({ ok: true });
});
