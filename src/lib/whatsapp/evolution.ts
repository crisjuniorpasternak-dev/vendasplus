import type { MessageStatus, MessageType } from "@prisma/client";
import { env } from "../env";
import { normalizePhone } from "../phone";
import type { ConnectResult, ConnectionState, InboundEvent, OutgoingMedia, SendResult, WhatsAppProvider } from "./types";

/**
 * Evolution API v2 — https://doc.evolution-api.com
 * URL e API key vêm de EVOLUTION_API_URL / EVOLUTION_API_KEY. A instância vem da conexão
 * cadastrada (ou EVOLUTION_INSTANCE para a conexão padrão).
 */
export class EvolutionProvider implements WhatsAppProvider {
  readonly name = "evolution";
  constructor(private instance: string) {}

  private async call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    if (!env.evolution.url || !env.evolution.apiKey) {
      throw new Error("Evolution API não configurada: defina EVOLUTION_API_URL e EVOLUTION_API_KEY");
    }
    const res = await fetch(`${env.evolution.url}${path}`, {
      method,
      headers: { "Content-Type": "application/json", apikey: env.evolution.apiKey },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    let data: any = text;
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!res.ok) {
      const msg = data?.response?.message ?? data?.message ?? data?.error ?? text;
      throw new Error(`Evolution ${res.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
    }
    return data as T;
  }

  private inst() { return encodeURIComponent(this.instance); }

  async sendText(to: string, text: string): Promise<SendResult> {
    const r = await this.call("POST", `/message/sendText/${this.inst()}`, { number: to, text });
    return { externalId: r?.key?.id ?? null, raw: r };
  }

  async sendMedia(to: string, m: OutgoingMedia): Promise<SendResult> {
    if (m.kind === "audio") return this.sendAudio(to, m.data, m.mime);
    const r = await this.call("POST", `/message/sendMedia/${this.inst()}`, {
      number: to,
      mediatype: m.kind,
      mimetype: m.mime,
      caption: m.caption ?? "",
      media: m.data.toString("base64"),
      fileName: m.fileName ?? `arquivo`,
    });
    return { externalId: r?.key?.id ?? null, raw: r };
  }

  async sendAudio(to: string, data: Buffer, _mime?: string): Promise<SendResult> {
    // A Evolution converte para ogg/opus (nota de voz) internamente.
    const r = await this.call("POST", `/message/sendWhatsAppAudio/${this.inst()}`, {
      number: to,
      audio: data.toString("base64"),
    });
    return { externalId: r?.key?.id ?? null, raw: r };
  }

  async sendTemplate(to: string, name: string, lang: string, bodyParams: string[] = []): Promise<SendResult> {
    // Apenas para instâncias Evolution com integração WHATSAPP-BUSINESS (Cloud API via Evolution)
    const r = await this.call("POST", `/message/sendTemplate/${this.inst()}`, {
      number: to,
      name,
      language: lang,
      components: bodyParams.length
        ? [{ type: "body", parameters: bodyParams.map((t) => ({ type: "text", text: t })) }]
        : [],
    });
    return { externalId: r?.key?.id ?? null, raw: r };
  }

  async markRead({ externalId, phone, fromMe }: { externalId: string; phone: string; fromMe?: boolean }) {
    await this.call("POST", `/chat/markMessageAsRead/${this.inst()}`, {
      readMessages: [{ remoteJid: `${phone}@s.whatsapp.net`, fromMe: !!fromMe, id: externalId }],
    });
  }

  async getState(): Promise<ConnectionState> {
    const r = await this.call("GET", `/instance/connectionState/${this.inst()}`);
    return { state: r?.instance?.state ?? r?.state ?? "unknown", detail: r };
  }

  async connect(): Promise<ConnectResult> {
    const r = await this.call("GET", `/instance/connect/${this.inst()}`);
    const qr: string | undefined = r?.base64 ?? r?.qrcode?.base64;
    return {
      qrcode: qr ? (qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`) : null,
      pairingCode: r?.pairingCode ?? null,
      message: r?.instance?.state === "open" ? "Instância já conectada" : undefined,
    };
  }

  async logout() {
    await this.call("DELETE", `/instance/logout/${this.inst()}`);
  }

  async setWebhook(url: string) {
    return this.call("POST", `/webhook/set/${this.inst()}`, {
      webhook: {
        enabled: true,
        url,
        webhookByEvents: false,
        webhookBase64: true,
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_DELETE", "CONNECTION_UPDATE", "QRCODE_UPDATED", "SEND_MESSAGE"],
      },
    });
  }

  /** Baixa mídia de uma mensagem recebida (quando o webhook não trouxe base64). */
  async downloadMedia(messageId: string): Promise<{ data: Buffer; mime?: string } | null> {
    const r = await this.call("POST", `/chat/getBase64FromMediaMessage/${this.inst()}`, {
      message: { key: { id: messageId } },
      convertToMp4: false,
    });
    if (!r?.base64) return null;
    return { data: Buffer.from(r.base64, "base64"), mime: r.mimetype };
  }
}

// ---------- Parser de webhook ----------

const STATUS_MAP: Record<string, MessageStatus> = {
  PENDING: "PENDING",
  SERVER_ACK: "SENT",
  DELIVERY_ACK: "DELIVERED",
  READ: "READ",
  PLAYED: "READ",
  ERROR: "FAILED",
};

function unwrap(message: any): any {
  // mensagens efêmeras / view once embrulham o conteúdo real
  let m = message ?? {};
  for (let i = 0; i < 3; i++) {
    const inner = m.ephemeralMessage?.message ?? m.viewOnceMessage?.message ?? m.viewOnceMessageV2?.message ?? m.documentWithCaptionMessage?.message;
    if (!inner) break;
    m = inner;
  }
  return m;
}

export function parseEvolutionContent(rawMessage: any): { type: MessageType; body: string | null; mime?: string; fileName?: string } {
  const m = unwrap(rawMessage);
  if (m.conversation) return { type: "TEXT", body: m.conversation };
  if (m.extendedTextMessage) return { type: "TEXT", body: m.extendedTextMessage.text ?? "" };
  if (m.imageMessage) return { type: "IMAGE", body: m.imageMessage.caption ?? null, mime: m.imageMessage.mimetype };
  if (m.videoMessage) return { type: "VIDEO", body: m.videoMessage.caption ?? null, mime: m.videoMessage.mimetype };
  if (m.audioMessage) return { type: "AUDIO", body: null, mime: m.audioMessage.mimetype };
  if (m.documentMessage)
    return { type: "DOCUMENT", body: m.documentMessage.caption ?? null, mime: m.documentMessage.mimetype, fileName: m.documentMessage.fileName ?? m.documentMessage.title };
  if (m.stickerMessage) return { type: "STICKER", body: null, mime: m.stickerMessage.mimetype ?? "image/webp" };
  if (m.locationMessage) {
    const l = m.locationMessage;
    return { type: "LOCATION", body: `📍 ${l.name ?? "Localização"} https://maps.google.com/?q=${l.degreesLatitude},${l.degreesLongitude}` };
  }
  if (m.contactMessage) return { type: "CONTACT", body: `👤 ${m.contactMessage.displayName ?? "Contato"}` };
  if (m.buttonsResponseMessage) return { type: "TEXT", body: m.buttonsResponseMessage.selectedDisplayText ?? "" };
  if (m.listResponseMessage) return { type: "TEXT", body: m.listResponseMessage.title ?? "" };
  if (m.templateButtonReplyMessage) return { type: "TEXT", body: m.templateButtonReplyMessage.selectedDisplayText ?? "" };
  if (m.reactionMessage) return { type: "UNKNOWN", body: null };
  return { type: "UNKNOWN", body: null };
}

export function parseEvolutionWebhook(payload: any): InboundEvent[] {
  const event = String(payload?.event ?? "").toLowerCase().replace(/_/g, ".");
  const instance: string = payload?.instance ?? payload?.instanceName ?? "";
  const data = payload?.data;
  const out: InboundEvent[] = [];

  if (event === "messages.upsert" || event === "send.message") {
    const items = Array.isArray(data) ? data : data?.messages ?? [data];
    for (const d of items) {
      const key = d?.key;
      if (!key?.id || !key?.remoteJid) continue;
      const jid: string = key.remoteJidAlt && String(key.remoteJid).endsWith("@lid") ? key.remoteJidAlt : key.remoteJid;
      // ignora grupos, status e newsletters
      if (jid.endsWith("@g.us") || jid === "status@broadcast" || jid.endsWith("@newsletter") || jid.endsWith("@lid")) continue;
      const content = parseEvolutionContent(d.message);
      if (d.message?.reactionMessage || d.message?.protocolMessage) continue;
      const ts = Number(d.messageTimestamp);
      out.push({
        kind: "message",
        instance,
        externalId: key.id,
        phone: normalizePhone(jid),
        pushName: key.fromMe ? null : d.pushName ?? null,
        fromMe: !!key.fromMe,
        type: content.type,
        body: content.body,
        mime: content.mime ?? null,
        fileName: content.fileName ?? null,
        timestamp: ts ? new Date(ts * 1000) : new Date(),
        mediaBase64: d.message?.base64 ?? d.base64 ?? null,
        mediaRef: { messageId: key.id },
      });
    }
  } else if (event === "messages.update") {
    const items = Array.isArray(data) ? data : [data];
    for (const d of items) {
      const id = d?.keyId ?? d?.key?.id ?? d?.messageId;
      const st = STATUS_MAP[String(d?.status ?? d?.update?.status ?? "")];
      if (id && st) out.push({ kind: "status", instance, externalId: id, status: st });
    }
  } else if (event === "messages.delete") {
    const id = data?.id ?? data?.key?.id;
    if (id) out.push({ kind: "delete", instance, externalId: id });
  } else if (event === "connection.update") {
    out.push({ kind: "connection", instance, state: data?.state ?? "unknown", phone: data?.wuid ? normalizePhone(data.wuid) : null });
  } else if (event === "qrcode.updated") {
    const qr = data?.qrcode?.base64 ?? data?.base64;
    if (qr) out.push({ kind: "qrcode", instance, qrcode: qr });
  }
  return out;
}
