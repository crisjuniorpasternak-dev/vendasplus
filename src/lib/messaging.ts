import type { Connection, Message, MessageType, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { normalizePhone } from "./phone";
import { saveMedia, readMedia } from "./storage";
import { getProvider, type MediaKind } from "./whatsapp";

export function previewOf(type: MessageType, body?: string | null) {
  const map: Partial<Record<MessageType, string>> = {
    IMAGE: "📷 Imagem", AUDIO: "🎤 Áudio", VIDEO: "🎥 Vídeo", DOCUMENT: "📎 Documento", STICKER: "Figurinha",
    LOCATION: "📍 Localização", CONTACT: "👤 Contato", UNKNOWN: "Mensagem não suportada",
  };
  if (body && type !== "AUDIO") return (map[type] && type !== "TEXT" ? `${map[type]} · ` : "") + body.slice(0, 140);
  return map[type] ?? "";
}

/** Garante que exista ao menos a conexão padrão definida por variáveis de ambiente. */
export async function getDefaultConnection(): Promise<Connection | null> {
  const def = await prisma.connection.findFirst({ where: { isDefault: true } });
  if (def) return def;
  const any = await prisma.connection.findFirst({ orderBy: { createdAt: "asc" } });
  if (any) return any;
  if (env.evolution.instance) {
    return prisma.connection.create({
      data: { name: env.evolution.instance, instanceName: env.evolution.instance, provider: "EVOLUTION", isDefault: true },
    });
  }
  if (env.cloud.phoneNumberId) {
    return prisma.connection.create({
      data: { name: "cloud-api", instanceName: env.cloud.phoneNumberId, provider: "CLOUD_API", isDefault: true },
    });
  }
  return null;
}

export async function findOrCreateContact(phoneRaw: string, pushName?: string | null) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) throw new Error("Telefone inválido");
  const existing = await prisma.contact.findUnique({ where: { phone } });
  if (existing) {
    if (pushName && existing.pushName !== pushName) {
      return prisma.contact.update({ where: { id: existing.id }, data: { pushName } });
    }
    return existing;
  }
  return prisma.contact.create({ data: { phone, pushName: pushName ?? null } });
}

/** Reaproveita a conversa do contato naquela conexão (o histórico fica todo num lugar só). */
export async function findOrCreateConversation(contactId: string, connectionId: string, initialStatus: "OPEN" | "PENDING" | "CLOSED" = "PENDING") {
  const existing = await prisma.conversation.findFirst({
    where: { contactId, connectionId },
    orderBy: { lastMessageAt: "desc" },
  });
  if (existing) return { conversation: existing, created: false };
  const conversation = await prisma.conversation.create({
    data: { contactId, connectionId, status: initialStatus, closedAt: initialStatus === "CLOSED" ? new Date() : null },
  });
  return { conversation, created: true };
}

export async function logHistory(data: Prisma.HistoryEventUncheckedCreateInput) {
  return prisma.historyEvent.create({ data });
}

interface SendInput {
  conversationId: string;
  text?: string;
  file?: { data: Buffer; mime: string; fileName?: string };
  /** true quando for gravação de voz */
  voice?: boolean;
  userId?: string | null;
  source?: "agent" | "campaign" | "api";
  template?: { name: string; lang: string; params?: string[] };
  /** Prefixa a mensagem com o nome do atendente em negrito */
  signature?: string | null;
}

function kindFor(mime: string): MediaKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

const TYPE_FOR_KIND: Record<MediaKind, MessageType> = { image: "IMAGE", video: "VIDEO", audio: "AUDIO", document: "DOCUMENT" };

/** Envia uma mensagem por qualquer provedor, registrando no banco antes e atualizando depois. */
export async function sendMessage(input: SendInput): Promise<Message> {
  const conv = await prisma.conversation.findUniqueOrThrow({
    where: { id: input.conversationId },
    include: { contact: true, connection: true },
  });
  const provider = getProvider(conv.connection);
  const to = conv.contact.phone;

  let type: MessageType = "TEXT";
  let mediaPath: string | null = null;
  let kind: MediaKind | null = null;
  if (input.file) {
    kind = input.voice ? "audio" : kindFor(input.file.mime);
    type = TYPE_FOR_KIND[kind];
    mediaPath = await saveMedia(input.file.data, input.file.mime, input.file.fileName);
  }
  const text = input.text?.trim() ?? "";
  const outgoingText = input.signature && text ? `*${input.signature}:*\n${text}` : text;

  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      direction: "OUT",
      type,
      body: text || (input.template ? `[template] ${input.template.name}` : null),
      mediaPath,
      mediaMime: input.file?.mime ?? null,
      fileName: input.file?.fileName ?? null,
      status: "PENDING",
      senderUserId: input.userId ?? null,
      source: input.source ?? "agent",
    },
  });

  try {
    let result;
    if (input.template && provider.sendTemplate) {
      result = await provider.sendTemplate(to, input.template.name, input.template.lang, input.template.params);
    } else if (input.file && kind === "audio") {
      result = await provider.sendAudio(to, input.file.data, input.file.mime);
    } else if (input.file && kind) {
      result = await provider.sendMedia(to, { kind, data: input.file.data, mime: input.file.mime, fileName: input.file.fileName, caption: outgoingText || undefined });
    } else {
      if (!text) throw new Error("Mensagem vazia");
      result = await provider.sendText(to, outgoingText);
    }
    const updated = await prisma.message.update({
      where: { id: msg.id },
      data: { status: "SENT", externalId: result.externalId ?? undefined },
    });
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: new Date(), lastMessagePreview: previewOf(type, text || msg.body), lastMessageDirection: "OUT" },
    });
    return updated;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED", error } });
    throw e;
  }
}

/** Reenvia uma mensagem que falhou. */
export async function retryMessage(messageId: string) {
  const m = await prisma.message.findUniqueOrThrow({ where: { id: messageId } });
  if (m.status !== "FAILED" || m.direction !== "OUT") throw new Error("Só é possível reenviar mensagens com falha");
  const file = m.mediaPath ? { data: await readMedia(m.mediaPath), mime: m.mediaMime ?? "application/octet-stream", fileName: m.fileName ?? undefined } : undefined;
  await prisma.message.delete({ where: { id: m.id } });
  return sendMessage({ conversationId: m.conversationId, text: m.body ?? undefined, file, voice: m.type === "AUDIO", userId: m.senderUserId, source: m.source as "agent" });
}
