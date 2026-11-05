"use client";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import { Search, SquarePen, Filter, Inbox, Clock, User, MailWarning, CheckCircle2, ChevronDown, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { api, displayName, fetcher, relativeTime } from "@/lib/client";
import type { ConversationItem, Tag } from "./types";

const TABS = [
  { key: "all", label: "Todos", icon: Inbox, tone: "text-brand-600 bg-brand-50" },
  { key: "pending", label: "Aguardando", icon: Clock, tone: "text-amber-600 bg-amber-50" },
  { key: "open", label: "Em atendimento", icon: MessagesIcon, tone: "text-sky-600 bg-sky-50" },
  { key: "mine", label: "Minhas", icon: User, tone: "text-violet-600 bg-violet-50" },
  { key: "unread", label: "Não lidas", icon: MailWarning, tone: "text-rose-600 bg-rose-50" },
  { key: "closed", label: "Finalizadas", icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50" },
] as const;

function MessagesIcon(props: { size?: number }) {
  return <svg width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
}

const fmt = (n?: number) => (n === undefined ? "" : n > 999 ? "999+" : String(n));

export function ConversationList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filters, setFilters] = useState<{ connectionId?: string; tagId?: string; assignedToId?: string }>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showNew, setShowNew] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);

  const qs = new URLSearchParams({ tab, q: debounced, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) as Record<string, string> });
  const { data, mutate } = useSWR<{ items: ConversationItem[]; counts: Record<string, number> }>(`/api/conversations?${qs}`, fetcher, { refreshInterval: 4000, keepPreviousData: true });
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const current = TABS.find((t) => t.key === tab)!;

  // notificação sonora/visual simples para novas mensagens não lidas
  const prevUnread = useRef<number | null>(null);
  useEffect(() => {
    const u = data?.counts?.unread;
    if (u === undefined) return;
    if (prevUnread.current !== null && u > prevUnread.current && document.hidden) {
      document.title = `(${u}) Nova mensagem · ZapDesk`;
    } else if (!document.hidden) document.title = "ZapDesk · Multiatendimento WhatsApp";
    prevUnread.current = u;
  }, [data?.counts?.unread]);

  return (
    <section className="flex w-[370px] shrink-0 flex-col border-r border-gray-100 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
        <div className="relative flex-1">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquise seus contatos" className="w-full rounded-md py-1.5 pl-2 pr-8 text-sm outline-none placeholder:text-gray-400 focus:bg-gray-50" />
          {q ? <button onClick={() => setQ("")} className="absolute right-2 top-2 text-gray-400"><X size={15} /></button> : <Search size={16} className="absolute right-2 top-2 text-gray-400" />}
        </div>
        <button onClick={() => setShowNew(true)} title="Nova conversa" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><SquarePen size={17} /></button>
      </div>

      <div className="flex items-center justify-between px-3 pt-2.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800">{current.label}</span>
          <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-medium text-white">{fmt(data?.counts?.[tab])}</span>
        </div>
        <div className="relative">
          <button onClick={() => setShowFilters((v) => !v)} className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50">
            Filtros <Filter size={12} /> {activeFilters > 0 && <span className="text-brand-600">| {activeFilters} aplicado{activeFilters > 1 ? "s" : ""}</span>}
          </button>
          {showFilters && <FilterPopover value={filters} onChange={setFilters} onClose={() => setShowFilters(false)} />}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto px-3 py-2.5 scroll-thin">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} title={t.label}
            className={clsx("flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] transition",
              tab === t.key ? "border-brand-200 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-500 hover:bg-gray-50")}>
            <span className={clsx("flex h-5 w-5 items-center justify-center rounded", t.tone)}><t.icon size={13} /></span>
            {fmt(data?.counts?.[t.key])}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin">
        {!data && <p className="p-6 text-center text-sm text-gray-400">Carregando...</p>}
        {data?.items.length === 0 && <p className="p-6 text-center text-sm text-gray-400">Nenhuma conversa aqui.</p>}
        {data?.items.map((c) => {
          const name = displayName(c.contact);
          const active = c.id === selectedId;
          return (
            <button key={c.id} onClick={() => onSelect(c.id)}
              className={clsx("flex w-full items-start gap-3 border-b border-gray-100 px-3 py-3.5 text-left transition", active ? "bg-brand-50/70" : "hover:bg-gray-50")}>
              <Avatar name={name} src={c.contact.avatarUrl} size={42} badge />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx("truncate text-[15px]", c.unreadCount ? "font-semibold text-gray-900" : "text-gray-800")}>{name}</span>
                  <span className={clsx("shrink-0 text-xs", c.unreadCount ? "font-medium text-emerald-600" : "text-gray-400")}>{relativeTime(c.lastMessageAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1 text-[13px] text-gray-500">
                    {c.lastMessageDirection === "IN" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />}
                    <span className="truncate">{c.lastMessagePreview || "—"}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {c.contact.tags.slice(0, 1).map(({ tag }) => (
                      <span key={tag.id} className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: tag.color + "22", color: tag.color }}>{tag.name}</span>
                    ))}
                    {c.unreadCount > 0 && <span className="min-w-[18px] rounded-full bg-emerald-500 px-1.5 text-center text-[10px] font-semibold leading-[18px] text-white">{c.unreadCount}</span>}
                    {c.assignedTo && <Avatar name={c.assignedTo.name} size={18} className="opacity-90" />}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <NewConversationModal open={showNew} onClose={() => setShowNew(false)} onCreated={(id) => { setShowNew(false); mutate(); onSelect(id); }} />
    </section>
  );
}

function FilterPopover({ value, onChange, onClose }: { value: { connectionId?: string; tagId?: string; assignedToId?: string }; onChange: (v: typeof value) => void; onClose: () => void }) {
  const { data: conns } = useSWR<{ items: { id: string; name: string }[] }>("/api/connections", fetcher);
  const { data: tags } = useSWR<Tag[]>("/api/tags", fetcher);
  const { data: users } = useSWR<{ id: string; name: string }[]>("/api/users", fetcher);
  const sel = (label: string, key: keyof typeof value, opts?: { id: string; name: string }[]) => (
    <div className="mb-3">
      <label className="label">{label}</label>
      <div className="relative">
        <select className="input appearance-none pr-8" value={value[key] ?? ""} onChange={(e) => onChange({ ...value, [key]: e.target.value || undefined })}>
          <option value="">Todos</option>
          {opts?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
      </div>
    </div>
  );
  return (
    <div className="absolute right-0 top-8 z-30 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
      {sel("Conexão", "connectionId", conns?.items)}
      {sel("Tag", "tagId", tags)}
      {sel("Atendente", "assignedToId", users)}
      <div className="flex justify-between">
        <button className="btn-ghost text-xs" onClick={() => onChange({})}>Limpar</button>
        <button className="btn-primary text-xs" onClick={onClose}>Aplicar</button>
      </div>
    </div>
  );
}

function NewConversationModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [error, setError] = useState("");
  const { data: conns } = useSWR<{ items: { id: string; name: string }[] }>(open ? "/api/connections" : null, fetcher);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const c = await api("/api/conversations", "POST", { phone, name: name || undefined, connectionId: connectionId || undefined });
      setPhone(""); setName("");
      onCreated(c.id);
    } catch (err) { setError(err instanceof Error ? err.message : "Erro"); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Nova conversa">
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">WhatsApp (com DDD)</label><input className="input" placeholder="(47) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
        <div><label className="label">Nome (opcional)</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <label className="label">Conexão</label>
          <select className="input" value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
            <option value="">Padrão</option>
            {conns?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary">Iniciar conversa</button></div>
      </form>
    </Modal>
  );
}
