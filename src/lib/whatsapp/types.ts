import type { MessageStatus, MessageType } from "@prisma/client";

export type MediaKind = "image" | "video" | "document" | "audio";

export interface OutgoingMedia {
  kind: MediaKind;
  data: Buffer;
  mime: string;
  fileName?: string;
  caption?: string;
}

export interface SendResult {
  externalId: string | null;
  raw?: unknown;
}

export interface ConnectionState {
  /** "open" | "connecting" | "close" | "unknown" */
  state: string;
  phone?: string | null;
  detail?: unknown;
}

export interface ConnectResult {
  qrcode?: string | null; // data URL base64
  pairingCode?: string | null;
  message?: string;
}

/**
 * Contrato comum para qualquer integração de WhatsApp.
 * Hoje: Evolution API (Baileys ou Cloud via Evolution) e WhatsApp Cloud API oficial direta.
 */
export interface WhatsAppProvider {
  readonly name: string;
  sendText(to: string, text: string): Promise<SendResult>;
  sendMedia(to: string, media: OutgoingMedia): Promise<SendResult>;
  sendAudio(to: string, data: Buffer, mime: string): Promise<SendResult>;
  /** Envio de template aprovado (obrigatório na Cloud API fora da janela de 24h). */
  sendTemplate?(to: string, name: string, lang: string, bodyParams?: string[]): Promise<SendResult>;
  markRead(input: { externalId: string; phone: string; fromMe?: boolean }): Promise<void>;
  getState(): Promise<ConnectionState>;
  connect?(): Promise<ConnectResult>;
  logout?(): Promise<void>;
  /** Configura o webhook do provedor apontando para este sistema (quando suportado). */
  setWebhook?(url: string): Promise<unknown>;
}

/** Eventos normalizados vindos dos webhooks de qualquer provedor. */
export type InboundEvent =
  | {
      kind: "message";
      instance: string;
      externalId: string;
      phone: string;
      pushName?: string | null;
      fromMe: boolean;
      type: MessageType;
      body?: string | null;
      mime?: string | null;
      fileName?: string | null;
      timestamp: Date;
      /** Como baixar a mídia depois (lazy): payload específico do provedor */
      mediaRef?: unknown;
      mediaBase64?: string | null;
    }
  | { kind: "status"; instance: string; externalId: string; status: MessageStatus }
  | { kind: "connection"; instance: string; state: string; phone?: string | null }
  | { kind: "qrcode"; instance: string; qrcode: string }
  | { kind: "delete"; instance: string; externalId: string };
