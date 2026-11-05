"use client";
import clsx from "clsx";
import { Ban, Check, CheckCheck, Clock, FileText, AlertCircle, RotateCw, Download, Megaphone, Smartphone } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AudioPlayer } from "./AudioPlayer";
import type { Message } from "./types";

const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) => (/^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer" className="underline break-all">{p}</a> : <span key={i}>{formatWa(p)}</span>));
}

/** Formatação do WhatsApp: *negrito*, _itálico_, ~riscado~ */
function formatWa(text: string) {
  const tokens = text.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return tokens.map((t, i) => {
    if (/^\*[^*]+\*$/.test(t)) return <strong key={i}>{t.slice(1, -1)}</strong>;
    if (/^_[^_]+_$/.test(t)) return <em key={i}>{t.slice(1, -1)}</em>;
    if (/^~[^~]+~$/.test(t)) return <s key={i}>{t.slice(1, -1)}</s>;
    return t;
  });
}

function StatusIcon({ status }: { status: string }) {
  if (status === "PENDING") return <Clock size={12} className="opacity-70" />;
  if (status === "SENT") return <Check size={13} className="opacity-80" />;
  if (status === "DELIVERED") return <CheckCheck size={13} className="opacity-80" />;
  if (status === "READ") return <CheckCheck size={13} className="text-emerald-300" />;
  if (status === "FAILED") return <AlertCircle size={13} className="text-red-200" />;
  return null;
}

export function MessageBubble({ m, contactName, onRetry }: { m: Message; contactName: string; onRetry: (id: string) => void }) {
  const out = m.direction === "OUT";
  const src = m.mediaPath ? `/api/media/${m.mediaPath}` : null;
  const senderLabel = out ? (m.source === "campaign" ? "Campanha" : m.source === "phone" ? "Celular" : m.sender?.name ?? "Sistema") : contactName;

  let content: React.ReactNode;
  if (m.deleted) {
    content = <span className="flex items-center gap-1.5 italic opacity-70"><Ban size={14} /> Mensagem apagada</span>;
  } else if (m.type === "AUDIO" && src) {
    return (
      <Row out={out} label={senderLabel} at={m.createdAt} source={m.source}>
        <AudioPlayer src={src} outgoing={out} trailing={out ? <StatusIcon status={m.status} /> : null} />
        {m.status === "FAILED" && <Failed m={m} onRetry={onRetry} />}
      </Row>
    );
  } else {
    content = (
      <>
        {(m.type === "IMAGE" || m.type === "STICKER") && src && (
          <a href={src} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className={clsx("mb-1 rounded-md object-cover", m.type === "STICKER" ? "h-32 w-32 bg-transparent" : "max-h-72 max-w-xs")} />
          </a>
        )}
        {m.type === "VIDEO" && src && <video src={src} controls className="mb-1 max-h-72 max-w-xs rounded-md" />}
        {m.type === "DOCUMENT" && (
          <a href={src ?? "#"} target="_blank" rel="noreferrer" className={clsx("mb-1 flex items-center gap-2 rounded-md px-3 py-2", out ? "bg-white/15" : "bg-white")}>
            <FileText size={22} /> <span className="max-w-[220px] truncate text-sm">{m.fileName ?? "Documento"}</span> <Download size={15} className="ml-auto opacity-70" />
          </a>
        )}
        {(m.type !== "TEXT" && !src && m.type !== "LOCATION" && m.type !== "CONTACT") && !m.body && <span className="italic opacity-70">{m.type === "UNKNOWN" ? "Mensagem não suportada" : "Mensagem com anexo"}</span>}
        {m.body && <div className="whitespace-pre-wrap break-words">{linkify(m.body)}</div>}
      </>
    );
  }
  return (
    <Row out={out} label={senderLabel} at={m.createdAt} source={m.source}>
      <div className={clsx("relative max-w-[520px] rounded-lg px-3 py-2 text-[14.5px] leading-snug", out ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-800", m.status === "FAILED" && "bg-red-500")}>
        {content}
        {out && <span className="float-right ml-2 mt-1.5 inline-flex translate-y-0.5"><StatusIcon status={m.status} /></span>}
      </div>
      {m.status === "FAILED" && <Failed m={m} onRetry={onRetry} />}
    </Row>
  );
}

function Failed({ m, onRetry }: { m: Message; onRetry: (id: string) => void }) {
  return (
    <div className="mt-1 flex items-center gap-2 text-xs text-red-600">
      <span className="max-w-[360px] truncate" title={m.error ?? ""}>Falha: {m.error}</span>
      <button onClick={() => onRetry(m.id)} className="flex items-center gap-1 font-medium hover:underline"><RotateCw size={12} /> Reenviar</button>
    </div>
  );
}

function Row({ out, label, at, source, children }: { out: boolean; label: string; at: string; source: string; children: React.ReactNode }) {
  return (
    <div className={clsx("flex gap-2.5", out ? "justify-end" : "justify-start")}>
      {!out && <Avatar name={label} size={32} className="mt-5" />}
      <div className={clsx("flex flex-col", out ? "items-end" : "items-start")}>
        <div className="mb-1 text-xs text-gray-500">
          <span className={clsx("font-medium", out ? "text-brand-600" : "text-rose-500")}>{out ? `[${label}]` : label}</span> • {time(at)}
        </div>
        {children}
      </div>
      {out && (
        <div className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          {source === "campaign" ? <Megaphone size={15} /> : source === "phone" ? <Smartphone size={15} /> : <span className="text-xs font-semibold uppercase">{label.charAt(0)}</span>}
        </div>
      )}
    </div>
  );
}
