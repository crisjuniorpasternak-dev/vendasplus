import type { MessageStatus } from "@prisma/client";
import { prisma } from "./db";
import { findOrCreateContact, findOrCreateConversation, logHistory, previewOf } from "./messaging";
import { saveMedia } from "./storage";
import { downloadInboundMedia, type InboundEvent } from "./whatsapp";

const STATUS_RANK: Record<MessageStatus, number> = { PENDING: 0, FAILED: 1, SENT: 2, DELIVERED: 3, READ: 4, RECEIVED: 4 };
const OPT_OUT = new Set(["sair", "parar", "pare", "stop", "descadastrar", "cancelar inscrição", "não quero receber"]);

async function connectionFor(instance: string, provider: "EVOLUTION" | "CLOUD_API") {
  const found = await prisma.connection.findFirst({ where: { instanceName: instance, provider } });
  if (found) return found;
  if (!instance) return null;
  // Instância nova enviando webhook: cadastra automaticamente
  const count = await prisma.connection.count();
  return prisma.connection.create({
    data: { name: instance, instanceName: instance, provider, isDefault: count === 0 },
  });
}

export async function processInbound(events: InboundEvent[], provider: "EVOLUTION" | "CLOUD_API") {
  for (const ev of events) {
    try {
      await handle(ev, provider);
    } catch (e) {
      console.error("[webhook] falha ao processar evento", ev.kind, e);
    }
  }
}

async function handle(ev: InboundEvent, provider: "EVOLUTION" | "CLOUD_API") {
  if (ev.kind === "status") {
    const msg = await prisma.message.findUnique({ where: { externalId: ev.externalId } });
    if (msg && STATUS_RANK[ev.status] > STATUS_RANK[msg.status]) {
      await prisma.message.update({ where: { id: msg.id }, data: { status: ev.status } });
    }
    return;
  }
  if (ev.kind === "delete") {
    await prisma.message.updateMany({ where: { externalId: ev.externalId }, data: { deleted: true } });
    return;
  }
  const conn = await connectionFor(ev.instance, provider);
  if (!conn) return;

  if (ev.kind === "connection") {
    await prisma.connection.update({ where: { id: conn.id }, data: { status: ev.state, phone: ev.phone ?? conn.phone } });
    return;
  }
  if (ev.kind === "qrcode") {
    await prisma.connection.update({ where: { id: conn.id }, data: { status: "qrcode" } });
    return;
  }

  // kind === "message"
  if (await prisma.message.findUnique({ where: { externalId: ev.externalId }, select: { id: true } })) return; // duplicado / eco do nosso envio

  const contact = await findOrCreateContact(ev.phone, ev.pushName);
  const { conversation } = await findOrCreateConversation(contact.id, conn.id, ev.fromMe ? "CLOSED" : "PENDING");

  let mediaPath: string | null = null;
  let mime = ev.mime ?? null;
  if (["IMAGE", "AUDIO", "VIDEO", "DOCUMENT", "STICKER"].includes(ev.type)) {
    try {
      if (ev.mediaBase64) {
        mediaPath = await saveMedia(Buffer.from(ev.mediaBase64, "base64"), mime, ev.fileName);
      } else {
        const dl = await downloadInboundMedia(conn, ev.mediaRef);
        if (dl) {
          mime = mime ?? dl.mime ?? null;
          mediaPath = await saveMedia(dl.data, mime, ev.fileName);
        }
      }
    } catch (e) {
      console.warn("[webhook] não foi possível baixar mídia", e);
    }
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      externalId: ev.externalId,
      direction: ev.fromMe ? "OUT" : "IN",
      type: ev.type,
      body: ev.body ?? null,
      mediaPath,
      mediaMime: mime,
      fileName: ev.fileName ?? null,
      status: ev.fromMe ? "SENT" : "RECEIVED",
      source: ev.fromMe ? "phone" : "agent",
      createdAt: ev.timestamp,
    },
  });

  const reopen = !ev.fromMe && conversation.status === "CLOSED";
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: ev.timestamp,
      lastMessagePreview: previewOf(ev.type, ev.body),
      lastMessageDirection: ev.fromMe ? "OUT" : "IN",
      unreadCount: ev.fromMe ? 0 : { increment: 1 },
      ...(reopen ? { status: "PENDING", closedAt: null, assignedToId: null } : {}),
    },
  });
  if (reopen) {
    await logHistory({ contactId: contact.id, conversationId: conversation.id, type: "conversation_reopened", description: "Conversa reaberta por nova mensagem do contato" });
  }

  if (!ev.fromMe && ev.body && OPT_OUT.has(ev.body.trim().toLowerCase()) && !contact.optOut) {
    await prisma.contact.update({ where: { id: contact.id }, data: { optOut: true } });
    await logHistory({ contactId: contact.id, conversationId: conversation.id, type: "opt_out", description: `Contato pediu para não receber campanhas ("${ev.body.trim()}")` });
  }
}
