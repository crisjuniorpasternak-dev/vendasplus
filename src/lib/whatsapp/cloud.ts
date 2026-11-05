import type { MessageStatus, MessageType } from "@prisma/client";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "../env";
import type { ConnectionState, InboundEvent, OutgoingMedia, SendResult, WhatsAppProvider } from "./types";

/**
 * WhatsApp Cloud API oficial (Meta) — https://developers.facebook.com/docs/whatsapp/cloud-api
 * Token em WHATSAPP_CLOUD_TOKEN. O phone_number_id é o "instanceName" da conexão.
 */
export class CloudApiProvider implements WhatsAppProvider {
  readonly name = "cloud";
  constructor(private phoneNumberId: string) {}

  private base() { return `https://graph.facebook.com/${env.cloud.apiVersion}`; }

  private async call<T = any>(path: string, init: RequestInit = {}): Promise<T> {
    if (!env.cloud.token) throw new Error("Cloud API não configurada: defina WHATSAPP_CLOUD_TOKEN");
    const res = await fetch(`${this.base()}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${env.cloud.token}`, ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
      cache: "no-store",
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Cloud API ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`);
    return data as T;
  }

  private send(payload: Record<string, unknown>) {
    return this.call(`/${this.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
    }).then((r: any) => ({ externalId: r?.messages?.[0]?.id ?? null, raw: r }));
  }

  private async upload(data: Buffer, mime: string, fileName = "arquivo") {
    const fd = new FormData();
    fd.append("messaging_product", "whatsapp");
    fd.append("type", mime);
    fd.append("file", new Blob([new Uint8Array(data)], { type: mime }), fileName);
    const r: any = await this.call(`/${this.phoneNumberId}/media`, { method: "POST", body: fd });
    return r.id as string;
  }

  sendText(to: string, text: string): Promise<SendResult> {
    return this.send({ to, type: "text", text: { body: text, preview_url: true } });
  }

  async sendMedia(to: string, m: OutgoingMedia): Promise<SendResult> {
    const id = await this.upload(m.data, m.mime, m.fileName);
    const obj: Record<string, unknown> = { id };
    if (m.caption && m.kind !== "audio") obj.caption = m.caption;
    if (m.kind === "document") obj.filename = m.fileName ?? "arquivo";
    return this.send({ to, type: m.kind, [m.kind]: obj });
  }

  sendAudio(to: string, data: Buffer, mime: string): Promise<SendResult> {
    // A Cloud API aceita audio/ogg (opus), mpeg, mp4, aac, amr. webm não é aceito.
    return this.sendMedia(to, { kind: "audio", data, mime: mime.split(";")[0], fileName: "audio.ogg" });
  }

  sendTemplate(to: string, name: string, lang: string, bodyParams: string[] = []): Promise<SendResult> {
    return this.send({
      to,
      type: "template",
      template: {
        name,
        language: { code: lang },
        components: bodyParams.length ? [{ type: "body", parameters: bodyParams.map((t) => ({ type: "text", text: t })) }] : undefined,
      },
    });
  }

  async markRead({ externalId }: { externalId: string }) {
    await this.call(`/${this.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: externalId }),
    });
  }

  async getState(): Promise<ConnectionState> {
    const r: any = await this.call(`/${this.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,status`);
    return { state: "open", phone: r?.display_phone_number?.replace(/\D/g, "") ?? null, detail: r };
  }

  async downloadMedia(mediaId: string): Promise<{ data: Buffer; mime?: string } | null> {
    const meta: any = await this.call(`/${mediaId}`);
    if (!meta?.url) return null;
    const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${env.cloud.token}` } });
    if (!res.ok) return null;
    return { data: Buffer.from(await res.arrayBuffer()), mime: meta.mime_type };
  }
}

export function verifyCloudSignature(rawBody: string, header: string | null) {
  if (!env.cloud.appSecret) return true; // verificação opcional
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", env.cloud.appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const CLOUD_STATUS: Record<string, MessageStatus> = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };
const CLOUD_TYPE: Record<string, MessageType> = {
  text: "TEXT", image: "IMAGE", audio: "AUDIO", video: "VIDEO", document: "DOCUMENT", sticker: "STICKER",
  location: "LOCATION", contacts: "CONTACT", button: "TEXT", interactive: "TEXT",
};

export function parseCloudWebhook(payload: any): InboundEvent[] {
  const out: InboundEvent[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const v = change?.value;
      const instance: string = v?.metadata?.phone_number_id ?? "";
      const names = new Map<string, string>((v?.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name]));
      for (const m of v?.messages ?? []) {
        const type = CLOUD_TYPE[m.type] ?? "UNKNOWN";
        const media = m[m.type] ?? {};
        let body: string | null = null;
        if (m.type === "text") body = m.text?.body ?? "";
        else if (m.type === "button") body = m.button?.text ?? "";
        else if (m.type === "interactive") body = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
        else if (m.type === "location") body = `📍 https://maps.google.com/?q=${m.location?.latitude},${m.location?.longitude}`;
        else if (m.type === "contacts") body = `👤 ${m.contacts?.[0]?.name?.formatted_name ?? "Contato"}`;
        else body = media.caption ?? null;
        out.push({
          kind: "message",
          instance,
          externalId: m.id,
          phone: String(m.from).replace(/\D/g, ""),
          pushName: names.get(m.from) ?? null,
          fromMe: false,
          type,
          body,
          mime: media.mime_type ?? null,
          fileName: media.filename ?? null,
          timestamp: new Date(Number(m.timestamp) * 1000),
          mediaRef: media.id ? { mediaId: media.id } : undefined,
        });
      }
      for (const s of v?.statuses ?? []) {
        const st = CLOUD_STATUS[s.status];
        if (st) out.push({ kind: "status", instance, externalId: s.id, status: st });
      }
    }
  }
  return out;
}
