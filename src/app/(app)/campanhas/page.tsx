"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import clsx from "clsx";
import { Plus, Play, Pause, Rocket, Info } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, fetcher } from "@/lib/client";
import { renderPreview } from "@/lib/preview";

type Campaign = {
  id: string; name: string; status: string; createdAt: string; minDelaySec: number; maxDelaySec: number; windowStart: number; windowEnd: number;
  list: { name: string }; connection: { name: string; provider: string }; stats: { PENDING: number; SENT: number; FAILED: number; SKIPPED: number };
};

const STATUS_LABEL: Record<string, [string, string]> = {
  DRAFT: ["Rascunho", "bg-gray-100 text-gray-600"], RUNNING: ["Enviando", "bg-sky-50 text-sky-700"], PAUSED: ["Pausada", "bg-amber-50 text-amber-700"],
  DONE: ["Concluída", "bg-emerald-50 text-emerald-700"], CANCELED: ["Cancelada", "bg-red-50 text-red-600"],
};

export default function CampanhasPage() {
  const { data, mutate } = useSWR<Campaign[]>("/api/campaigns", fetcher, { refreshInterval: 5000 });
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const act = async (id: string, action: string) => {
    try { await api(`/api/campaigns/${id}`, "PATCH", { action }); mutate(); } catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); }
  };
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50/60">
      <PageHeader title="Campanhas" subtitle="Disparo de mensagens para listas com intervalo entre envios">
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Nova campanha</button>
      </PageHeader>
      <div className="flex-1 overflow-y-auto p-6 scroll-thin">
        {data?.length === 0 && (
          <div className="card mx-auto max-w-md p-10 text-center">
            <Rocket className="mx-auto mb-3 text-brand-500" size={36} />
            <p className="mb-4 text-sm text-gray-600">Nenhuma campanha ainda. Crie uma lista em Contatos e depois dispare por aqui.</p>
            <button className="btn-primary" onClick={() => setOpen(true)}>Criar campanha</button>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((c) => {
            const total = c.stats.PENDING + c.stats.SENT + c.stats.FAILED + c.stats.SKIPPED;
            const done = total - c.stats.PENDING;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const [label, tone] = STATUS_LABEL[c.status];
            return (
              <div key={c.id} className="card p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <Link href={`/campanhas/${c.id}`} className="font-medium text-gray-900 hover:text-brand-600">{c.name}</Link>
                  <span className={clsx("rounded-full px-2 py-0.5 text-xs", tone)}>{label}</span>
                </div>
                <p className="mb-3 text-xs text-gray-500">Lista <b>{c.list.name}</b> · {c.connection.name} · {c.minDelaySec}-{c.maxDelaySec}s · {c.windowStart}h-{c.windowEnd}h</p>
                <div className="mb-1 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} /></div>
                <div className="mb-3 flex justify-between text-xs text-gray-500">
                  <span>{done}/{total} ({pct}%)</span>
                  <span><span className="text-emerald-600">{c.stats.SENT} enviadas</span> · <span className="text-red-500">{c.stats.FAILED} falhas</span>{c.stats.SKIPPED ? ` · ${c.stats.SKIPPED} puladas` : ""}</span>
                </div>
                <div className="flex gap-2">
                  {(c.status === "DRAFT" || c.status === "PAUSED") && <button className="btn-primary text-xs" onClick={() => act(c.id, "start")}><Play size={13} /> {c.status === "DRAFT" ? "Iniciar" : "Retomar"}</button>}
                  {c.status === "RUNNING" && <button className="btn-outline text-xs" onClick={() => act(c.id, "pause")}><Pause size={13} /> Pausar</button>}
                  <Link href={`/campanhas/${c.id}`} className="btn-ghost text-xs">Detalhes</Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <NewCampaignModal open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); mutate(); toast("Campanha criada"); }} />
    </div>
  );
}

function NewCampaignModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { data: lists } = useSWR<{ id: string; name: string; _count: { members: number } }[]>(open ? "/api/lists" : null, fetcher);
  const { data: conns } = useSWR<{ items: { id: string; name: string; provider: string; isDefault: boolean }[] }>(open ? "/api/connections" : null, fetcher);
  const [message, setMessage] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const conn = conns?.items.find((c) => c.id === connectionId) ?? conns?.items.find((c) => c.isDefault) ?? conns?.items[0];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "start") fd.set("start", "1");
    if (!fd.get("connectionId") && conn) fd.set("connectionId", conn.id);
    const sch = fd.get("scheduledAt") as string;
    if (sch) fd.set("scheduledAt", new Date(sch).toISOString());
    setBusy(true); setError("");
    try { await api("/api/campaigns", "POST", fd); setMessage(""); onCreated(); }
    catch (err) { setError(err instanceof Error ? err.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova campanha" width={760}>
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-[1fr_260px]">
        <div className="space-y-3">
          <div><label className="label">Nome da campanha</label><input name="name" className="input" required placeholder="Ex.: Óticas Blumenau - novembro" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Lista</label>
              <select name="listId" className="input" required defaultValue="">
                <option value="" disabled>Selecione</option>
                {lists?.map((l) => <option key={l.id} value={l.id}>{l.name} ({l._count.members})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Conexão</label>
              <select name="connectionId" className="input" value={connectionId || conn?.id || ""} onChange={(e) => setConnectionId(e.target.value)}>
                {conns?.items.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.provider === "CLOUD_API" ? "Cloud API" : "Evolution"})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Mensagem</label>
            <textarea name="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="input resize-y" placeholder={"{Oi|Olá}, tudo bem? 👋\n\nUse {opção1|opção2} para variar o texto entre envios."} />
            <p className="mt-1 flex items-start gap-1 text-[11px] text-gray-500"><Info size={12} className="mt-0.5 shrink-0" /> Variação automática com {"{Oi|Olá|E aí}"}. Variáveis opcionais: {"{{nome}}"} e {"{{primeiro_nome}}"}. Contatos que responderem SAIR são excluídos dos próximos disparos.</p>
          </div>
          <div><label className="label">Anexo (imagem, vídeo, PDF ou áudio — opcional)</label><input name="file" type="file" className="text-sm" /></div>
          {conn?.provider === "CLOUD_API" && (
            <div className="grid grid-cols-2 gap-3 rounded-md bg-amber-50 p-3">
              <p className="col-span-2 text-xs text-amber-800">Na API oficial, mensagens para quem não falou com você nas últimas 24h precisam usar um <b>template aprovado</b> pela Meta.</p>
              <div><label className="label">Nome do template</label><input name="templateName" className="input" /></div>
              <div><label className="label">Idioma</label><input name="templateLang" className="input" defaultValue="pt_BR" /></div>
            </div>
          )}
          <fieldset className="grid grid-cols-2 gap-3 rounded-md border border-gray-100 p-3 md:grid-cols-4">
            <legend className="px-1 text-xs font-medium text-gray-600">Ritmo de envio (anti-bloqueio)</legend>
            <div><label className="label">Intervalo mín. (s)</label><input name="minDelaySec" type="number" min={5} defaultValue={20} className="input" /></div>
            <div><label className="label">Intervalo máx. (s)</label><input name="maxDelaySec" type="number" min={5} defaultValue={45} className="input" /></div>
            <div><label className="label">Pausa a cada (msgs)</label><input name="batchSize" type="number" min={0} defaultValue={50} className="input" /></div>
            <div><label className="label">Duração pausa (s)</label><input name="batchPauseSec" type="number" min={0} defaultValue={600} className="input" /></div>
            <div><label className="label">Enviar a partir de (h)</label><input name="windowStart" type="number" min={0} max={23} defaultValue={8} className="input" /></div>
            <div><label className="label">Até (h)</label><input name="windowEnd" type="number" min={0} max={24} defaultValue={20} className="input" /></div>
            <div className="col-span-2"><label className="label">Agendar início (opcional)</label><input name="scheduledAt" type="datetime-local" className="input" /></div>
          </fieldset>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button name="action" value="draft" className="btn-outline" disabled={busy}>Salvar rascunho</button>
            <button name="action" value="start" className="btn-primary" disabled={busy}><Rocket size={15} /> Criar e iniciar</button>
          </div>
        </div>
        <div>
          <label className="label">Pré-visualização</label>
          <div className="rounded-xl bg-[#e5ddd5] p-3">
            <div className="ml-auto max-w-[95%] whitespace-pre-wrap rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13px] text-gray-800 shadow-sm">
              {message ? renderPreview(message) : <span className="text-gray-400">Sua mensagem aparece aqui</span>}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">A cada envio uma variação diferente é sorteada.</p>
        </div>
      </form>
    </Modal>
  );
}
