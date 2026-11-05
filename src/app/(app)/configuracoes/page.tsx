"use client";
import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, fetcher } from "@/lib/client";

type User = { id: string; name: string; email: string; role: "ADMIN" | "AGENT"; active: boolean };

export default function ConfigPage() {
  const toast = useToast();
  const { data: me } = useSWR<User>("/api/me", fetcher);
  const { data: users, mutate: mu } = useSWR<User[]>("/api/users", fetcher);
  const { data: replies, mutate: mr } = useSWR<{ id: string; shortcut: string; body: string }[]>("/api/quick-replies", fetcher);
  const { data: tags, mutate: mt } = useSWR<{ id: string; name: string; color: string; _count: { contacts: number } }[]>("/api/tags", fetcher);
  const [userModal, setUserModal] = useState(false);
  const [pwd, setPwd] = useState<User | null>(null);
  const isAdmin = me?.role === "ADMIN";
  const err = (e: unknown) => toast(e instanceof Error ? e.message : "Erro", "error");

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50/60">
      <PageHeader title="Configurações" subtitle="Atendentes, respostas rápidas e tags" />
      <div className="grid flex-1 gap-5 overflow-y-auto p-6 lg:grid-cols-2 scroll-thin">
        <section className="card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-medium">Atendentes</h2>{isAdmin && <button className="btn-primary text-xs" onClick={() => setUserModal(true)}><Plus size={14} /> Novo atendente</button>}</div>
          <table className="w-full text-sm">
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="py-2"><div className="flex items-center gap-2"><Avatar name={u.name} size={28} /> {u.name}</div></td>
                  <td className="py-2 text-gray-500">{u.email}</td>
                  <td className="py-2">{isAdmin ? (
                    <select value={u.role} className="rounded border border-gray-200 px-1 py-0.5 text-xs" onChange={(e) => api(`/api/users/${u.id}`, "PATCH", { role: e.target.value }).then(() => mu()).catch(err)}>
                      <option value="ADMIN">Administrador</option><option value="AGENT">Atendente</option>
                    </select>) : <span className="text-xs text-gray-500">{u.role === "ADMIN" ? "Administrador" : "Atendente"}</span>}
                  </td>
                  <td className="py-2 text-xs">{u.active ? <span className="text-emerald-600">Ativo</span> : <span className="text-gray-400">Inativo</span>}</td>
                  <td className="py-2 text-right">{(isAdmin) && <>
                    <button className="btn-ghost text-xs" onClick={() => setPwd(u)}>Trocar senha</button>
                    {u.id !== me?.id && <button className="btn-ghost text-xs" onClick={() => api(`/api/users/${u.id}`, "PATCH", { active: !u.active }).then(() => mu()).catch(err)}>{u.active ? "Desativar" : "Ativar"}</button>}
                  </>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card p-4">
          <h2 className="mb-1 font-medium">Respostas rápidas</h2>
          <p className="mb-3 text-xs text-gray-500">No chat, digite <b>/atalho</b> para inserir o texto.</p>
          <form className="mb-3 space-y-2" onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const d = Object.fromEntries(new FormData(f)); try { await api("/api/quick-replies", "POST", d); f.reset(); mr(); } catch (x) { err(x); } }}>
            <input name="shortcut" className="input" placeholder="atalho (ex.: preco)" required />
            <textarea name="body" className="input" rows={3} placeholder="Texto da resposta" required />
            <button className="btn-primary text-xs"><Plus size={14} /> Salvar resposta</button>
          </form>
          {replies?.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-2 border-t border-gray-100 py-2 text-sm">
              <div><span className="font-medium text-brand-600">/{r.shortcut}</span><p className="whitespace-pre-wrap text-gray-600">{r.body}</p></div>
              <button onClick={() => api(`/api/quick-replies/${r.id}`, "DELETE").then(() => mr())} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
          ))}
        </section>

        <section className="card p-4">
          <h2 className="mb-3 font-medium">Tags</h2>
          <form className="mb-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const d = Object.fromEntries(new FormData(f)); try { await api("/api/tags", "POST", d); f.reset(); mt(); } catch (x) { err(x); } }}>
            <input name="name" className="input" placeholder="Nome da tag" required />
            <input name="color" type="color" defaultValue="#3b82f6" className="h-9 w-12 rounded border border-gray-200" />
            <button className="btn-primary text-xs">Adicionar</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {tags?.map((t) => <span key={t.id} className="rounded-full px-2.5 py-1 text-xs" style={{ background: t.color + "1f", color: t.color }}>{t.name} · {t._count.contacts}</span>)}
          </div>
        </section>
      </div>

      <Modal open={userModal} onClose={() => setUserModal(false)} title="Novo atendente">
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)); try { await api("/api/users", "POST", d); setUserModal(false); mu(); } catch (x) { err(x); } }}>
          <div><label className="label">Nome</label><input name="name" className="input" required /></div>
          <div><label className="label">E-mail</label><input name="email" type="email" className="input" required /></div>
          <div><label className="label">Senha (mín. 6)</label><input name="password" type="password" minLength={6} className="input" required /></div>
          <div><label className="label">Perfil</label><select name="role" className="input"><option value="AGENT">Atendente</option><option value="ADMIN">Administrador</option></select></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setUserModal(false)}>Cancelar</button><button className="btn-primary">Criar</button></div>
        </form>
      </Modal>
      <Modal open={!!pwd} onClose={() => setPwd(null)} title={`Nova senha · ${pwd?.name ?? ""}`}>
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const password = new FormData(e.currentTarget).get("password"); try { await api(`/api/users/${pwd!.id}`, "PATCH", { password }); setPwd(null); toast("Senha alterada"); } catch (x) { err(x); } }}>
          <input name="password" type="password" minLength={6} className="input" required autoFocus />
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setPwd(null)}>Cancelar</button><button className="btn-primary">Salvar</button></div>
        </form>
      </Modal>
    </div>
  );
}
