"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import clsx from "clsx";
import { Plus, Upload, Search, MessageCircle, Trash2, ListPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, displayName, fetcher, formatPhoneClient } from "@/lib/client";

type List = { id: string; name: string; _count: { members: number } };
type Contact = { id: string; name: string | null; pushName: string | null; phone: string; email: string | null; optOut: boolean; createdAt: string; tags: { tag: { id: string; name: string; color: string } }[]; lists: { list: { id: string; name: string } }[] };

export default function ContatosPage() {
  const router = useRouter();
  const toast = useToast();
  const [listId, setListId] = useState<string>("");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [modal, setModal] = useState<"" | "new" | "import" | "list" | "addToList">("");
  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data: lists, mutate: mutateLists } = useSWR<List[]>("/api/lists", fetcher);
  const { data, mutate } = useSWR<{ items: Contact[]; total: number; pages: number }>(`/api/contacts?${new URLSearchParams({ q: dq, listId, page: String(page) })}`, fetcher);
  const refresh = () => { mutate(); mutateLists(); };

  async function openChat(phone: string) {
    try { const c = await api("/api/conversations", "POST", { phone }); router.push(`/chat?c=${c.id}`); }
    catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); }
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-gray-50/60">
      <aside className="w-60 shrink-0 overflow-y-auto border-r border-gray-100 bg-white p-3 scroll-thin">
        <div className="mb-2 flex items-center justify-between px-2"><span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Listas</span><button onClick={() => setModal("list")} className="text-brand-600 hover:text-brand-700" title="Nova lista"><Plus size={16} /></button></div>
        <button onClick={() => { setListId(""); setPage(1); }} className={clsx("flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm", !listId ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50")}>
          <span className="flex items-center gap-2"><Users size={15} /> Todos os contatos</span>
        </button>
        {lists?.map((l) => (
          <div key={l.id} className={clsx("group flex items-center justify-between rounded-md px-2 py-1.5 text-sm", listId === l.id ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50")}>
            <button className="flex-1 truncate text-left" onClick={() => { setListId(l.id); setPage(1); }}>📋 {l.name}</button>
            <span className="text-xs text-gray-400 group-hover:hidden">{l._count.members}</span>
            <button className="hidden text-gray-400 hover:text-red-500 group-hover:block" onClick={async () => { if (confirm(`Excluir a lista "${l.name}"? Os contatos não serão apagados.`)) { await api(`/api/lists/${l.id}/members`, "DELETE"); if (listId === l.id) setListId(""); refresh(); } }}><Trash2 size={13} /></button>
          </div>
        ))}
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <PageHeader title="Contatos" subtitle={data ? `${data.total} contato(s)` : undefined}>
          <div className="relative"><input className="input w-64 pl-8" placeholder="Buscar nome, telefone, e-mail" value={q} onChange={(e) => setQ(e.target.value)} /><Search size={15} className="absolute left-2.5 top-2.5 text-gray-400" /></div>
          {selected.length > 0 && <button className="btn-outline" onClick={() => setModal("addToList")}><ListPlus size={15} /> Adicionar {selected.length} à lista</button>}
          <button className="btn-outline" onClick={() => setModal("import")}><Upload size={15} /> Importar CSV</button>
          <button className="btn-primary" onClick={() => setModal("new")}><Plus size={15} /> Novo contato</button>
        </PageHeader>
        <div className="flex-1 overflow-y-auto p-6 scroll-thin">
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="w-10 px-4 py-2"><input type="checkbox" className="accent-brand-600" checked={!!data?.items.length && selected.length === data.items.length} onChange={(e) => setSelected(e.target.checked ? data!.items.map((c) => c.id) : [])} /></th>
                  <th className="px-2 py-2">Nome</th><th className="px-4 py-2">Telefone</th><th className="px-4 py-2">E-mail</th><th className="px-4 py-2">Tags / listas</th><th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {data?.items.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                    <td className="px-4 py-2"><input type="checkbox" className="accent-brand-600" checked={selected.includes(c.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))} /></td>
                    <td className="px-2 py-2"><div className="flex items-center gap-2"><Avatar name={displayName(c)} size={28} /> <span>{displayName(c)}</span>{c.optOut && <span className="rounded bg-amber-50 px-1.5 text-[10px] text-amber-700">opt-out</span>}</div></td>
                    <td className="px-4 py-2 text-gray-600">{formatPhoneClient(c.phone)}</td>
                    <td className="px-4 py-2 text-gray-500">{c.email ?? "—"}</td>
                    <td className="px-4 py-2"><div className="flex flex-wrap gap-1">
                      {c.tags.map(({ tag }) => <span key={tag.id} className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: tag.color + "1f", color: tag.color }}>{tag.name}</span>)}
                      {c.lists.map(({ list }) => <span key={list.id} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{list.name}</span>)}
                    </div></td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => openChat(c.phone)} className="rounded p-1.5 text-brand-600 hover:bg-brand-50" title="Abrir conversa"><MessageCircle size={16} /></button>
                      {listId && <button onClick={async () => { await api(`/api/lists/${listId}/members?contactId=${c.id}`, "DELETE"); refresh(); }} className="rounded p-1.5 text-gray-400 hover:bg-gray-100" title="Remover da lista"><ListPlus size={16} className="rotate-45" /></button>}
                      <button onClick={async () => { if (confirm("Excluir contato e todas as conversas dele?")) { await api(`/api/contacts/${c.id}`, "DELETE"); refresh(); } }} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500" title="Excluir"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum contato encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
          {data && data.pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
              <span className="text-gray-500">Página {page} de {data.pages}</span>
              <button className="btn-ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Próxima</button>
            </div>
          )}
        </div>
      </div>

      <NewContact open={modal === "new"} lists={lists} defaultList={listId} onClose={() => setModal("")} onDone={() => { setModal(""); refresh(); }} />
      <ImportCsv open={modal === "import"} lists={lists} defaultList={listId} onClose={() => setModal("")} onDone={(msg) => { setModal(""); refresh(); toast(msg); }} />
      <NewList open={modal === "list"} onClose={() => setModal("")} onDone={() => { setModal(""); refresh(); }} />
      <Modal open={modal === "addToList"} onClose={() => setModal("")} title={`Adicionar ${selected.length} contato(s) à lista`}>
        <div className="space-y-1">
          {lists?.map((l) => <button key={l.id} onClick={async () => { await api(`/api/lists/${l.id}/members`, "POST", { contactIds: selected }); setSelected([]); setModal(""); refresh(); toast(`Adicionados à lista ${l.name}`); }} className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-brand-50">📋 {l.name}</button>)}
          {lists?.length === 0 && <p className="text-sm text-gray-500">Crie uma lista primeiro.</p>}
        </div>
      </Modal>
    </div>
  );
}

function NewContact({ open, lists, defaultList, onClose, onDone }: { open: boolean; lists?: List[]; defaultList: string; onClose: () => void; onDone: () => void }) {
  const [err, setErr] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Novo contato">
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        try { await api("/api/contacts", "POST", { ...f, listId: f.listId || undefined }); onDone(); } catch (x) { setErr(x instanceof Error ? x.message : "Erro"); }
      }}>
        <div><label className="label">Nome</label><input name="name" className="input" /></div>
        <div><label className="label">WhatsApp (com DDD)</label><input name="phone" className="input" required placeholder="(47) 99999-9999" /></div>
        <div><label className="label">E-mail</label><input name="email" type="email" className="input" /></div>
        <div><label className="label">Adicionar à lista</label><select name="listId" defaultValue={defaultList} className="input"><option value="">Nenhuma</option>{lists?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary">Salvar</button></div>
      </form>
    </Modal>
  );
}

function ImportCsv({ open, lists, defaultList, onClose, onDone }: { open: boolean; lists?: List[]; defaultList: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Importar contatos (CSV)">
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr("");
        try { const r = await api("/api/contacts/import", "POST", new FormData(e.currentTarget)); onDone(`${r.imported} importados, ${r.invalid} ignorados (inválidos/duplicados)`); }
        catch (x) { setErr(x instanceof Error ? x.message : "Erro"); } finally { setBusy(false); }
      }}>
        <p className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">Colunas aceitas (cabeçalho na 1ª linha, separador vírgula ou ponto e vírgula): <b>nome</b>, <b>telefone</b> (ou whatsapp/celular), <b>email</b>, <b>tags</b> (separadas por |). Números sem DDI recebem 55 automaticamente.</p>
        <input name="file" type="file" accept=".csv,text/csv" required className="text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Lista existente</label><select name="listId" defaultValue={defaultList} className="input"><option value="">Nenhuma</option>{lists?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
          <div><label className="label">…ou criar nova lista</label><input name="newList" className="input" placeholder="Nome da lista" /></div>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy}>{busy ? "Importando..." : "Importar"}</button></div>
      </form>
    </Modal>
  );
}

function NewList({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [err, setErr] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Nova lista">
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { await api("/api/lists", "POST", { name: new FormData(e.currentTarget).get("name") }); onDone(); } catch (x) { setErr(x instanceof Error ? x.message : "Erro"); } }}>
        <input name="name" className="input" required autoFocus placeholder="Ex.: Óticas Blumenau" />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary">Criar</button></div>
      </form>
    </Modal>
  );
}
