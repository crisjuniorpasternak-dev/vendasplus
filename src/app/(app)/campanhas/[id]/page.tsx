"use client";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import clsx from "clsx";
import { ArrowLeft, Play, Pause, XCircle, RotateCw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api, displayName, fetcher, formatPhoneClient } from "@/lib/client";

const STATUS: Record<string, [string, string]> = {
  DRAFT: ["Rascunho", "bg-gray-100 text-gray-600"], RUNNING: ["Enviando", "bg-sky-50 text-sky-700"], PAUSED: ["Pausada", "bg-amber-50 text-amber-700"],
  DONE: ["Concluída", "bg-emerald-50 text-emerald-700"], CANCELED: ["Cancelada", "bg-red-50 text-red-600"],
};
const R_STATUS: Record<string, [string, string]> = {
  PENDING: ["Na fila", "text-gray-500"], SENT: ["Enviada", "text-emerald-600"], FAILED: ["Falhou", "text-red-600"], SKIPPED: ["Pulada", "text-amber-600"],
};

export default function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { data: c, mutate } = useSWR<any>(`/api/campaigns/${id}`, fetcher, { refreshInterval: 4000 });
  if (!c) return <div className="p-6 text-sm text-gray-400">Carregando...</div>;
  const counts = c.recipients.reduce((a: Record<string, number>, r: any) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
  const act = async (action: string) => { try { await api(`/api/campaigns/${id}`, "PATCH", { action }); mutate(); } catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); } };
  const [label, tone] = STATUS[c.status];
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50/60">
      <PageHeader title={c.name} subtitle={`Lista ${c.list.name} · conexão ${c.connection.name}`}>
        <Link href="/campanhas" className="btn-ghost"><ArrowLeft size={15} /> Voltar</Link>
        {(c.status === "DRAFT" || c.status === "PAUSED") && <button className="btn-primary" onClick={() => act("start")}><Play size={15} /> {c.status === "DRAFT" ? "Iniciar" : "Retomar"}</button>}
        {c.status === "RUNNING" && <button className="btn-outline" onClick={() => act("pause")}><Pause size={15} /> Pausar</button>}
        {(counts.FAILED ?? 0) > 0 && <button className="btn-outline" onClick={() => act("retry_failed")}><RotateCw size={15} /> Reenviar falhas</button>}
        {!["DONE", "CANCELED"].includes(c.status) && <button className="btn-danger" onClick={() => confirm("Cancelar a campanha? Os envios pendentes serão descartados.") && act("cancel")}><XCircle size={15} /> Cancelar</button>}
        {c.status !== "RUNNING" && <button className="btn-ghost text-red-500" onClick={async () => { if (confirm("Excluir campanha?")) { await api(`/api/campaigns/${id}`, "DELETE"); router.push("/campanhas"); } }}><Trash2 size={15} /></button>}
      </PageHeader>
      <div className="flex-1 overflow-y-auto p-6 scroll-thin">
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Status" value={<span className={clsx("rounded-full px-2 py-0.5 text-sm", tone)}>{label}</span>} />
          <Stat label="Na fila" value={counts.PENDING ?? 0} />
          <Stat label="Enviadas" value={<span className="text-emerald-600">{counts.SENT ?? 0}</span>} />
          <Stat label="Falhas" value={<span className="text-red-600">{counts.FAILED ?? 0}</span>} />
          <Stat label="Próximo envio" value={<span className="text-sm">{c.status === "RUNNING" && c.nextSendAt && new Date(c.nextSendAt).getFullYear() < 2900 ? new Date(c.nextSendAt).toLocaleTimeString("pt-BR") : "—"}</span>} />
        </div>
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">Mensagem</h3>
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">{c.message || `[template] ${c.templateName}`}</pre>
            {c.mediaPath && <a href={`/api/media/${c.mediaPath}`} target="_blank" className="mt-2 inline-block text-xs text-brand-600 underline">📎 {c.mediaFileName}</a>}
          </div>
          <div className="card p-4 text-sm text-gray-600">
            <h3 className="mb-2 text-sm font-medium text-gray-700">Configuração</h3>
            <p>Intervalo aleatório entre <b>{c.minDelaySec}s</b> e <b>{c.maxDelaySec}s</b></p>
            <p>Pausa de <b>{Math.round(c.batchPauseSec / 60)} min</b> a cada <b>{c.batchSize}</b> envios</p>
            <p>Janela de envio: <b>{c.windowStart}h às {c.windowEnd}h</b></p>
            {c.scheduledAt && <p>Agendada para <b>{new Date(c.scheduledAt).toLocaleString("pt-BR")}</b></p>}
          </div>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500"><tr><th className="px-4 py-2">Contato</th><th className="px-4 py-2">Telefone</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Enviado em</th><th className="px-4 py-2">Erro</th></tr></thead>
            <tbody>
              {c.recipients.map((r: any) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{displayName(r.contact)}</td>
                  <td className="px-4 py-2 text-gray-500">{formatPhoneClient(r.contact.phone)}</td>
                  <td className={clsx("px-4 py-2", R_STATUS[r.status][1])}>{R_STATUS[r.status][0]}</td>
                  <td className="px-4 py-2 text-gray-500">{r.sentAt ? new Date(r.sentAt).toLocaleString("pt-BR") : "—"}</td>
                  <td className="max-w-xs truncate px-4 py-2 text-xs text-red-500" title={r.error ?? ""}>{r.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="card p-3"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 text-xl font-semibold text-gray-800">{value}</div></div>;
}
