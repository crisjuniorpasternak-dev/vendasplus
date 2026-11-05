"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { api, brl, displayName, fetcher } from "@/lib/client";

type Stage = { id: string; name: string; color: string };
type Deal = { id: string; number: number; title: string; value: string; stageId: string; status: string; contact: { id: string; name: string | null; pushName: string | null; phone: string }; owner: { name: string } | null };

export default function NegociosPage() {
  const [status, setStatus] = useState("OPEN");
  const { data: stages } = useSWR<Stage[]>("/api/stages", fetcher);
  const { data: deals, mutate } = useSWR<Deal[]>(`/api/deals?status=${status}`, fetcher, { refreshInterval: 10000 });
  const [drag, setDrag] = useState<string | null>(null);

  async function move(dealId: string, stageId: string) {
    mutate(deals?.map((d) => (d.id === dealId ? { ...d, stageId } : d)), false);
    await api(`/api/deals/${dealId}`, "PATCH", { stageId });
    mutate();
  }
  async function openChat(phone: string) {
    const c = await api("/api/conversations", "POST", { phone });
    window.location.href = `/chat?c=${c.id}`;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50/60">
      <PageHeader title="Negócios" subtitle="Funil de vendas — arraste os cards entre as etapas">
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="OPEN">Em aberto</option><option value="WON">Ganhos</option><option value="LOST">Perdidos</option><option value="ALL">Todos</option>
        </select>
      </PageHeader>
      <div className="flex flex-1 gap-4 overflow-x-auto p-6 scroll-thin">
        {stages?.map((s) => {
          const items = deals?.filter((d) => d.stageId === s.id) ?? [];
          const total = items.reduce((a, d) => a + Number(d.value), 0);
          return (
            <div key={s.id} className="flex w-72 shrink-0 flex-col rounded-lg bg-gray-100/70" onDragOver={(e) => e.preventDefault()} onDrop={() => drag && move(drag, s.id)}>
              <div className="border-t-4 px-3 py-2.5" style={{ borderColor: s.color }}>
                <div className="flex items-center justify-between text-sm font-medium text-gray-800">{s.name}<span className="text-xs text-gray-500">{items.length}</span></div>
                <div className="text-xs text-gray-500">{brl(total)}</div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-2 scroll-thin">
                {items.map((d) => (
                  <div key={d.id} draggable onDragStart={() => setDrag(d.id)} onDragEnd={() => setDrag(null)} className="cursor-grab rounded-md border border-gray-200 bg-white p-3 shadow-sm active:cursor-grabbing">
                    <div className="mb-1 flex items-center gap-2">
                      <Avatar name={displayName(d.contact)} size={24} />
                      <span className="truncate text-sm font-medium text-gray-800">{d.title}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>#{d.number} · {d.owner?.name ?? "—"}</span>
                      <span className="font-medium text-gray-700">{brl(d.value)}</span>
                    </div>
                    <button onClick={() => openChat(d.contact.phone)} className="mt-2 text-xs text-brand-600 hover:underline">Abrir conversa</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="px-6 pb-3 text-xs text-gray-400">Negócios são criados pelo painel do contato no <Link href="/chat" className="underline">Multiatendimento</Link>.</p>
    </div>
  );
}
