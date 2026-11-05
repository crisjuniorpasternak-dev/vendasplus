"use client";
import { useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import { Plus, RefreshCw, QrCode, Webhook, Star, Trash2, LogOut, CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, fetcher, formatPhoneClient } from "@/lib/client";

type Conn = { id: string; name: string; provider: "EVOLUTION" | "CLOUD_API"; instanceName: string; status: string; phone: string | null; isDefault: boolean };
type Resp = { items: Conn[]; config: { evolutionConfigured: boolean; evolutionUrl: string | null; cloudConfigured: boolean; webhookEvolution: string; webhookCloud: string } };

const STATE: Record<string, [string, string]> = {
  open: ["Conectado", "bg-emerald-50 text-emerald-700"], connecting: ["Conectando", "bg-amber-50 text-amber-700"], qrcode: ["Aguardando QR", "bg-amber-50 text-amber-700"],
  close: ["Desconectado", "bg-red-50 text-red-600"], error: ["Erro", "bg-red-50 text-red-600"], unknown: ["Não verificado", "bg-gray-100 text-gray-600"],
};

export default function ConexoesPage() {
  const { data, mutate } = useSWR<Resp>("/api/connections", fetcher);
  const toast = useToast();
  const [newOpen, setNewOpen] = useState(false);
  const [qr, setQr] = useState<{ conn: Conn; qrcode?: string | null; pairingCode?: string | null; message?: string } | null>(null);

  async function check(c: Conn) {
    const r = await fetcher<Conn & { error?: string }>(`/api/connections/${c.id}`);
    mutate();
    if (r.error) toast(r.error, "error"); else toast(`${c.name}: ${STATE[r.status]?.[0] ?? r.status}`);
  }
  async function connect(c: Conn) {
    try { setQr({ conn: c, ...(await api(`/api/connections/${c.id}/connect`)) }); } catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); }
  }
  async function webhook(c: Conn) {
    try { const r = await api(`/api/connections/${c.id}/webhook`); toast(`Webhook configurado: ${r.url}`); } catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50/60">
      <PageHeader title="Conexões WhatsApp" subtitle="Números conectados via Evolution API ou WhatsApp Cloud API oficial">
        <button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={15} /> Nova conexão</button>
      </PageHeader>
      <div className="flex-1 overflow-y-auto p-6 scroll-thin">
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          <ConfigCard ok={!!data?.config.evolutionConfigured} title="Evolution API" lines={[
            data?.config.evolutionConfigured ? `URL: ${data.config.evolutionUrl}` : "Defina EVOLUTION_API_URL e EVOLUTION_API_KEY no .env",
            `Webhook: ${data?.config.webhookEvolution ?? ""}`,
          ]} />
          <ConfigCard ok={!!data?.config.cloudConfigured} title="WhatsApp Cloud API (oficial)" lines={[
            data?.config.cloudConfigured ? "Token configurado" : "Opcional: defina WHATSAPP_CLOUD_TOKEN e WHATSAPP_CLOUD_VERIFY_TOKEN",
            `Webhook (painel Meta): ${data?.config.webhookCloud ?? ""}`,
          ]} />
        </div>
        {data?.items.length === 0 && <div className="card p-8 text-center text-sm text-gray-500">Nenhuma conexão. Clique em <b>Nova conexão</b> e informe o nome da instância da sua Evolution API.</div>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.items.map((c) => {
            const [label, tone] = STATE[c.status] ?? [c.status, "bg-gray-100 text-gray-600"];
            return (
              <div key={c.id} className="card p-4">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium text-gray-900">{c.name}{c.isDefault && <Star size={14} className="fill-amber-400 text-amber-400" />}</div>
                  <span className={clsx("rounded-full px-2 py-0.5 text-xs", tone)}>{label}</span>
                </div>
                <p className="mb-3 text-xs text-gray-500">{c.provider === "CLOUD_API" ? "Cloud API · phone_number_id" : "Evolution · instância"} <code className="rounded bg-gray-100 px-1">{c.instanceName}</code>{c.phone && <> · {formatPhoneClient(c.phone)}</>}</p>
                <div className="flex flex-wrap gap-1.5">
                  <button className="btn-ghost text-xs" onClick={() => check(c)}><RefreshCw size={13} /> Status</button>
                  {c.provider === "EVOLUTION" && <button className="btn-outline text-xs" onClick={() => connect(c)}><QrCode size={13} /> Conectar (QR)</button>}
                  {c.provider === "EVOLUTION" && <button className="btn-ghost text-xs" onClick={() => webhook(c)}><Webhook size={13} /> Configurar webhook</button>}
                  {!c.isDefault && <button className="btn-ghost text-xs" onClick={async () => { await api(`/api/connections/${c.id}`, "PATCH", { isDefault: true }); mutate(); }}><Star size={13} /> Tornar padrão</button>}
                  {c.provider === "EVOLUTION" && c.status === "open" && <button className="btn-ghost text-xs" onClick={async () => { if (confirm("Desconectar o número desta instância?")) { await api(`/api/connections/${c.id}/connect`, "DELETE"); mutate(); } }}><LogOut size={13} /> Desconectar</button>}
                  <button className="btn-ghost text-xs text-red-500" onClick={async () => { if (confirm("Remover esta conexão do sistema? (as conversas ficam vinculadas a ela)")) { try { await api(`/api/connections/${c.id}`, "DELETE"); mutate(); } catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); } } }}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nova conexão">
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          try { await api("/api/connections", "POST", { name: f.name, provider: f.provider, instanceName: f.instanceName, isDefault: f.isDefault === "on" }); setNewOpen(false); mutate(); }
          catch (x) { toast(x instanceof Error ? x.message : "Erro", "error"); }
        }}>
          <div><label className="label">Nome de exibição</label><input name="name" className="input" required placeholder="ex.: blumenau-principal" /></div>
          <div><label className="label">Provedor</label><select name="provider" className="input"><option value="EVOLUTION">Evolution API</option><option value="CLOUD_API">WhatsApp Cloud API (oficial)</option></select></div>
          <div><label className="label">Instância (Evolution) ou phone_number_id (Cloud API)</label><input name="instanceName" className="input" required /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isDefault" className="accent-brand-600" /> Conexão padrão</label>
          <p className="text-xs text-gray-500">URL e chaves ficam somente nas variáveis de ambiente do servidor.</p>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setNewOpen(false)}>Cancelar</button><button className="btn-primary">Salvar</button></div>
        </form>
      </Modal>

      <Modal open={!!qr} onClose={() => { setQr(null); mutate(); }} title={`Conectar ${qr?.conn.name ?? ""}`}>
        {qr?.message && <p className="mb-3 text-sm text-emerald-700">{qr.message}</p>}
        {qr?.qrcode ? (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.qrcode} alt="QR Code" className="mx-auto h-64 w-64" />
            <p className="mt-2 text-sm text-gray-600">No celular: WhatsApp → Aparelhos conectados → Conectar aparelho</p>
          </div>
        ) : !qr?.message && <p className="text-sm text-gray-500">A Evolution não retornou QR Code. Verifique se a instância existe.</p>}
        {qr?.pairingCode && <p className="mt-3 text-center text-sm">Ou use o código: <b className="tracking-widest">{qr.pairingCode}</b></p>}
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn-outline" onClick={() => qr && connect(qr.conn)}><RefreshCw size={14} /> Gerar novo QR</button>
          <button className="btn-primary" onClick={() => qr && check(qr.conn).then(() => setQr(null))}>Já escaneei</button>
        </div>
      </Modal>
    </div>
  );
}

function ConfigCard({ ok, title, lines }: { ok: boolean; title: string; lines: string[] }) {
  return (
    <div className="card flex gap-3 p-4">
      {ok ? <CheckCircle2 className="shrink-0 text-emerald-500" size={20} /> : <AlertTriangle className="shrink-0 text-amber-500" size={20} />}
      <div className="min-w-0 text-sm">
        <div className="font-medium text-gray-800">{title}</div>
        {lines.map((l) => <p key={l} className="break-all text-xs text-gray-500">{l}</p>)}
      </div>
    </div>
  );
}
