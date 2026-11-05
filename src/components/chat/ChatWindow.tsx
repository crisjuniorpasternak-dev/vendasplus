"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Eye, CheckCircle2, MoreVertical, PanelRight, RotateCcw, UserCheck, ArrowLeftRight, Undo2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { api, displayName, fetcher } from "@/lib/client";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";
import type { ConversationDetail, HistoryEvent, Message } from "./types";

function dayLabel(d: Date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - x.getTime()) / 86400000;
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: diff > 300 ? "numeric" : undefined });
}

export function ChatWindow({ conversationId, panelOpen, onTogglePanel }: { conversationId: string; panelOpen: boolean; onTogglePanel: () => void }) {
  const toast = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: conv, mutate: mutateConv } = useSWR<ConversationDetail>(`/api/conversations/${conversationId}`, fetcher, { refreshInterval: 8000 });
  const { data, mutate } = useSWR<{ messages: Message[]; events: HistoryEvent[] }>(`/api/conversations/${conversationId}/messages`, fetcher, { refreshInterval: 3000 });
  const { data: users } = useSWR<{ id: string; name: string }[]>("/api/users", fetcher);
  const [menu, setMenu] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);
  const nearBottom = useRef(true);

  const refreshAll = () => { mutate(); mutateConv(); globalMutate((k) => typeof k === "string" && k.startsWith("/api/conversations?")); };

  // marca como lida ao abrir
  useEffect(() => {
    api(`/api/conversations/${conversationId}/read`).then(() => globalMutate((k) => typeof k === "string" && k.startsWith("/api/conversations?"))).catch(() => {});
  }, [conversationId, globalMutate]);

  const timeline = useMemo(() => {
    const items: ({ kind: "msg"; at: Date; m: Message } | { kind: "evt"; at: Date; e: HistoryEvent })[] = [
      ...(data?.messages ?? []).map((m) => ({ kind: "msg" as const, at: new Date(m.createdAt), m })),
      ...(data?.events ?? []).map((e) => ({ kind: "evt" as const, at: new Date(e.createdAt), e })),
    ];
    return items.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [data]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (timeline.length !== lastCount.current && (nearBottom.current || lastCount.current === 0)) el.scrollTop = el.scrollHeight;
    lastCount.current = timeline.length;
  }, [timeline.length]);

  async function action(a: string, userId?: string | null) {
    try {
      await api(`/api/conversations/${conversationId}`, "PATCH", { action: a, userId });
      setMenu(false); setTransfer(false);
      refreshAll();
      if (a === "close") toast("Conversa finalizada");
    } catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); }
  }

  async function send(p: { text?: string; file?: File; voice?: boolean; sign?: boolean }) {
    const fd = new FormData();
    if (p.text) fd.append("text", p.text);
    if (p.file) fd.append("file", p.file);
    if (p.voice) fd.append("voice", "1");
    if (p.sign) fd.append("sign", "1");
    nearBottom.current = true;
    try { await api(`/api/conversations/${conversationId}/messages`, "POST", fd); }
    catch (e) { toast(e instanceof Error ? e.message : "Falha no envio", "error"); }
    finally { refreshAll(); }
  }

  async function retry(id: string) {
    try { await api(`/api/messages/${id}/retry`); } catch (e) { toast(e instanceof Error ? e.message : "Falha", "error"); }
    mutate();
  }

  if (!conv) return <div className="flex flex-1 items-center justify-center text-sm text-gray-400">Carregando...</div>;
  const name = displayName(conv.contact);
  let lastDay = "";

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-2.5">
        <Avatar name={name} src={conv.contact.avatarUrl} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-gray-900">{name}</div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span className={`h-2 w-2 rounded-full ${conv.connection.status === "open" ? "bg-emerald-500" : "bg-gray-300"}`} />
            {conv.connection.name}
            {conv.assignedTo && <span className="text-gray-400">· {conv.assignedTo.name}</span>}
          </div>
        </div>
        <span className="hidden text-sm text-gray-400 xl:inline">#{conv.number}</span>
        {conv.status === "PENDING" && <button onClick={() => action("accept")} className="btn-primary"><UserCheck size={15} /> Atender</button>}
        <button onClick={() => api(`/api/conversations/${conversationId}/read`).then(refreshAll)} className="btn-outline"><Eye size={15} /> <span className="hidden lg:inline">Marcar como lida</span></button>
        {conv.status === "CLOSED"
          ? <button onClick={() => action("reopen")} className="btn-outline"><RotateCcw size={15} /> Reabrir</button>
          : <button onClick={() => action("close")} className="btn-outline"><CheckCircle2 size={15} /> Finalizar</button>}
        <div className="relative">
          <button onClick={() => setMenu((v) => !v)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100"><MoreVertical size={18} /></button>
          {menu && (
            <div className="absolute right-0 top-9 z-30 w-56 rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
              <button onClick={() => { setTransfer(true); setMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50"><ArrowLeftRight size={15} /> Transferir atendente</button>
              <button onClick={() => action("pending")} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50"><Undo2 size={15} /> Devolver para a fila</button>
            </div>
          )}
          {transfer && (
            <div className="absolute right-0 top-9 z-30 w-56 rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
              <div className="px-3 py-1.5 text-xs text-gray-400">Transferir para</div>
              {users?.map((u) => <button key={u.id} onClick={() => action("assign", u.id)} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50"><Avatar name={u.name} size={20} /> {u.name}</button>)}
              <button onClick={() => setTransfer(false)} className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-50">Cancelar</button>
            </div>
          )}
        </div>
        <button onClick={onTogglePanel} title={panelOpen ? "Ocultar painel" : "Mostrar painel"} className={`rounded p-1.5 hover:bg-gray-100 ${panelOpen ? "text-brand-600" : "text-gray-500"}`}><PanelRight size={18} /></button>
      </header>

      <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }}
        className="flex-1 space-y-4 overflow-y-auto px-6 py-5 scroll-thin">
        {timeline.length === 0 && <p className="pt-10 text-center text-sm text-gray-400">Nenhuma mensagem ainda. Envie a primeira!</p>}
        {timeline.map((it) => {
          const d = dayLabel(it.at);
          const sep = d !== lastDay ? (lastDay = d) : null;
          return (
            <div key={it.kind === "msg" ? it.m.id : it.e.id}>
              {sep && <div className="my-3 flex justify-center"><span className="rounded-full bg-gray-100 px-4 py-1 text-xs text-gray-600">{sep}</span></div>}
              {it.kind === "msg" ? (
                <MessageBubble m={it.m} contactName={name} onRetry={retry} />
              ) : (
                <div className="flex justify-center"><span className="rounded-md bg-gray-50 px-3 py-1.5 text-xs text-gray-600">{it.at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} - {it.e.description}</span></div>
              )}
            </div>
          );
        })}
      </div>
      {conv.contact.optOut && <div className="bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-700">Este contato pediu para não receber campanhas (opt-out).</div>}
      <Composer onSend={send} />
    </section>
  );
}
