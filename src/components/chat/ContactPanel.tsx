"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Plus, X, User, DollarSign, Calendar, Filter, Trophy, ThumbsDown, Trash2, MessageSquare, Tag as TagIcon, ListPlus, Briefcase, History } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, brl, displayName, fetcher, formatPhoneClient } from "@/lib/client";
import type { ConversationDetail, Deal, Stage, Tag } from "./types";

export function ContactPanel({ conversationId }: { conversationId: string }) {
  const { data: conv, mutate } = useSWR<ConversationDetail>(`/api/conversations/${conversationId}`, fetcher, { refreshInterval: 8000 });
  const toast = useToast();
  const [tagOpen, setTagOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  if (!conv) return <aside className="w-[400px] shrink-0 border-l border-gray-100" />;
  const c = conv.contact;
  const name = displayName(c);

  async function save(patch: Record<string, unknown>) {
    try { await api(`/api/contacts/${c.id}`, "PATCH", patch); mutate(); }
    catch (e) { toast(e instanceof Error ? e.message : "Erro ao salvar", "error"); }
  }
  async function addDeal() {
    try { await api("/api/deals", "POST", { contactId: c.id }); mutate(); toast("Negócio criado"); }
    catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); }
  }

  return (
    <aside className="w-[400px] shrink-0 overflow-y-auto border-l border-gray-100 bg-white scroll-thin">
      <div className="flex items-start gap-3 border-b border-gray-100 px-4 py-3">
        <Avatar name={name} src={c.avatarUrl} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-gray-900">{name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {c.tags.map(({ tag }) => (
              <span key={tag.id} className="group flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: tag.color + "1f", color: tag.color }}>
                {tag.name}
                <button onClick={() => api(`/api/contacts/${c.id}/tags?tagId=${tag.id}`, "DELETE").then(() => mutate())} className="opacity-50 hover:opacity-100"><X size={11} /></button>
              </span>
            ))}
            <div className="relative">
              <button onClick={() => setTagOpen((v) => !v)} className="flex items-center gap-0.5 rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50"><Plus size={11} /> Adicionar tags</button>
              {tagOpen && <TagPicker contactId={c.id} current={c.tags.map((t) => t.tag.id)} onDone={() => { setTagOpen(false); mutate(); }} />}
            </div>
          </div>
        </div>
      </div>

      <Section title="Ações" collapsible={false}>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={addDeal} className="rounded-md bg-brand-50 px-2.5 py-1 text-[13px] text-brand-600 hover:bg-brand-100">+ Adicionar negócio</button>
          <button onClick={() => setListOpen(true)} className="rounded-md bg-brand-50 px-2.5 py-1 text-[13px] text-brand-600 hover:bg-brand-100">+ Adicionar lista</button>
        </div>
        {c.lists.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {c.lists.map(({ list }) => <span key={list.id} className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">📋 {list.name}</span>)}
          </div>
        )}
      </Section>

      <Section title="Perfil">
        <Field label="Nome" value={c.name ?? ""} placeholder={c.pushName ?? "Nome do lead"} onSave={(v) => save({ name: v || null })} />
        <Field label="E-mail" value={c.email ?? ""} placeholder="Email do lead" onSave={(v) => save({ email: v || null })} />
        <Field label="Telefone" value={formatPhoneClient(c.phone)} readOnly prefix="🇧🇷" />
        <Field label="Site" value={c.site ?? ""} placeholder="Exemplo: www.meulead.com.br" onSave={(v) => save({ site: v || null })} />
        <Field label="Documento" value={c.document ?? ""} placeholder="Informe o CPF ou CNPJ" onSave={(v) => save({ document: v || null })} />
        <Field label="Data de Nascimento" type="date" value={c.birthDate ? c.birthDate.slice(0, 10) : ""} placeholder="Selecione a data" onSave={(v) => save({ birthDate: v || null })} />
        <label className="mt-2 flex items-center justify-between py-1 text-[13px] text-gray-700">
          Não receber campanhas (opt-out)
          <input type="checkbox" checked={c.optOut} onChange={(e) => save({ optOut: e.target.checked })} className="h-4 w-4 accent-brand-600" />
        </label>
      </Section>

      <Section title="Notas">
        <NotesBox key={c.id} initial={c.notes ?? ""} onSave={(v) => save({ notes: v })} />
      </Section>

      <Section title="Endereço principal" defaultOpen={false}>
        <Field label="CEP" value={c.zipCode ?? ""} placeholder="00000-000" onSave={(v) => save({ zipCode: v || null })} />
        <Field label="Rua" value={c.street ?? ""} placeholder="Rua / Avenida" onSave={(v) => save({ street: v || null })} />
        <Field label="Número" value={c.number ?? ""} placeholder="Nº" onSave={(v) => save({ number: v || null })} />
        <Field label="Bairro" value={c.district ?? ""} placeholder="Bairro" onSave={(v) => save({ district: v || null })} />
        <Field label="Cidade" value={c.city ?? ""} placeholder="Cidade" onSave={(v) => save({ city: v || null })} />
        <Field label="UF" value={c.state ?? ""} placeholder="SC" onSave={(v) => save({ state: v || null })} />
      </Section>

      <Section title="Campos adicionais" defaultOpen={false}>
        <CustomFields value={c.customFields ?? {}} onSave={(v) => save({ customFields: v })} />
      </Section>

      {c.deals.length === 0 ? (
        <Section title="Negócio" collapsible={false}>
          <button onClick={addDeal} className="w-full rounded-md bg-gray-50 py-2 text-sm text-gray-600 hover:bg-gray-100">Adicionar +</button>
        </Section>
      ) : (
        c.deals.map((d) => <DealCard key={d.id} deal={d} contactName={name} onChange={() => mutate()} />)
      )}

      <Section title="Histórico">
        <ol className="relative ml-3 border-l-2 border-violet-200">
          {c.history.length === 0 && <li className="ml-5 py-2 text-sm text-gray-400">Sem eventos ainda</li>}
          {c.history.map((h) => (
            <li key={h.id} className="relative mb-3 ml-5">
              <span className="absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-white">
                {h.type.startsWith("deal") ? <Briefcase size={11} /> : h.type.startsWith("tag") ? <TagIcon size={11} /> : h.type.startsWith("list") ? <ListPlus size={11} /> : h.type.startsWith("conversation") ? <MessageSquare size={11} /> : <History size={11} />}
              </span>
              <div className="rounded-lg border border-gray-100 px-3 py-2 text-[13px] text-gray-700">
                {h.description}
                <div className="mt-0.5 text-[11px] text-gray-400">{new Date(h.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}{h.user ? ` · ${h.user.name}` : ""}</div>
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <ListModal open={listOpen} onClose={() => setListOpen(false)} contactId={c.id} current={c.lists.map((l) => l.list.id)} onSaved={() => { setListOpen(false); mutate(); }} />
    </aside>
  );
}

function Section({ title, children, collapsible = true, defaultOpen = true, extra }: { title: React.ReactNode; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 px-4 py-3">
      <div className={clsx("flex items-center justify-between", collapsible && "cursor-pointer")} onClick={() => collapsible && setOpen((v) => !v)}>
        <h4 className="text-[15px] font-medium text-gray-800">{title}</h4>
        <div className="flex items-center gap-1">{extra}{collapsible && (open ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />)}</div>
      </div>
      {(open || !collapsible) && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

function Field({ label, value, placeholder, onSave, readOnly, type = "text", prefix }: { label: string; value: string; placeholder?: string; onSave?: (v: string) => void; readOnly?: boolean; type?: string; prefix?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-[13px]">
      <span className="shrink-0 text-gray-700">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        {prefix && <span>{prefix}</span>}
        <input type={type} value={v} readOnly={readOnly} placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => { if (!readOnly && v !== value) onSave?.(v.trim()); }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className={clsx("w-full min-w-0 rounded px-1.5 py-0.5 text-right outline-none placeholder:text-gray-400", readOnly ? "text-gray-800" : "hover:bg-gray-50 focus:bg-gray-50 focus:ring-1 focus:ring-brand-200")} />
      </div>
    </div>
  );
}

function NotesBox({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(true);
  return (
    <div>
      <textarea value={v} onChange={(e) => { setV(e.target.value); setSaved(false); }} onBlur={() => { if (!saved) { onSave(v); setSaved(true); } }}
        placeholder="Anotações internas sobre este contato (não são enviadas ao cliente)"
        className="h-24 w-full resize-y rounded-md border-l-2 border-brand-500 bg-brand-50/40 p-2.5 text-sm outline-none focus:ring-1 focus:ring-brand-200" />
      <div className="text-right text-[11px] text-gray-400">{saved ? "Salvo" : "Salva ao sair do campo"}</div>
    </div>
  );
}

function CustomFields({ value, onSave }: { value: Record<string, string>; onSave: (v: Record<string, string>) => void }) {
  const [k, setK] = useState("");
  const [val, setVal] = useState("");
  const entries = Object.entries(value);
  return (
    <div>
      {entries.map(([key, v]) => (
        <div key={key} className="flex items-center justify-between py-1 text-[13px]">
          <span className="text-gray-700">{key}</span>
          <span className="flex items-center gap-2 text-gray-800">{v}<button onClick={() => { const n = { ...value }; delete n[key]; onSave(n); }} className="text-gray-300 hover:text-red-500"><X size={13} /></button></span>
        </div>
      ))}
      <div className="mt-2 flex gap-1.5">
        <input className="input py-1" placeholder="Campo" value={k} onChange={(e) => setK(e.target.value)} />
        <input className="input py-1" placeholder="Valor" value={val} onChange={(e) => setVal(e.target.value)} />
        <button className="btn-outline px-2" onClick={() => { if (k.trim()) { onSave({ ...value, [k.trim()]: val }); setK(""); setVal(""); } }}>Adicionar</button>
      </div>
    </div>
  );
}

function TagPicker({ contactId, current, onDone }: { contactId: string; current: string[]; onDone: () => void }) {
  const { data: tags } = useSWR<Tag[]>("/api/tags", fetcher);
  const [name, setName] = useState("");
  const add = async (body: { tagId?: string; name?: string }) => { await api(`/api/contacts/${contactId}/tags`, "POST", body); onDone(); };
  return (
    <div className="absolute left-0 top-7 z-30 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg" onClick={(e) => e.stopPropagation()}>
      <input autoFocus className="input mb-1.5 py-1" placeholder="Nova tag + Enter" value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) add({ name }); if (e.key === "Escape") onDone(); }} />
      <div className="max-h-48 overflow-y-auto">
        {tags?.filter((t) => !current.includes(t.id) && t.name.toLowerCase().includes(name.toLowerCase())).map((t) => (
          <button key={t.id} onClick={() => add({ tagId: t.id })} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-gray-50">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} /> {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function ListModal({ open, onClose, contactId, current, onSaved }: { open: boolean; onClose: () => void; contactId: string; current: string[]; onSaved: () => void }) {
  const { data: lists, mutate } = useSWR<{ id: string; name: string }[]>(open ? "/api/lists" : null, fetcher);
  const [sel, setSel] = useState<string[]>(current);
  const [newName, setNewName] = useState("");
  useEffect(() => { if (open) setSel(current); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={open} onClose={onClose} title="Listas do contato">
      <div className="mb-3 max-h-64 space-y-1 overflow-y-auto">
        {lists?.length === 0 && <p className="text-sm text-gray-400">Nenhuma lista criada ainda.</p>}
        {lists?.map((l) => (
          <label key={l.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
            <input type="checkbox" className="accent-brand-600" checked={sel.includes(l.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id)))} /> {l.name}
          </label>
        ))}
      </div>
      <div className="mb-4 flex gap-2">
        <input className="input" placeholder="Nova lista" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn-outline" onClick={async () => { if (!newName.trim()) return; const l = await api("/api/lists", "POST", { name: newName.trim() }); setSel((s) => [...s, l.id]); setNewName(""); mutate(); }}>Criar</button>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={async () => { await api(`/api/contacts/${contactId}`, "PATCH", { listIds: sel }); onSaved(); }}>Salvar</button>
      </div>
    </Modal>
  );
}

function DealCard({ deal, contactName, onChange }: { deal: Deal; contactName: string; onChange: () => void }) {
  const { data: stages } = useSWR<Stage[]>("/api/stages", fetcher);
  const toast = useToast();
  const [value, setValue] = useState(String(deal.value));
  const [editing, setEditing] = useState(false);
  const patch = async (body: Record<string, unknown>) => {
    try { await api(`/api/deals/${deal.id}`, "PATCH", body); onChange(); } catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); }
  };
  const idx = stages?.findIndex((s) => s.id === deal.stageId) ?? -1;
  return (
    <Section title={<span>Negócio <span className="text-sm font-normal text-gray-400">#{deal.number}</span></span>}
      extra={<button onClick={(e) => { e.stopPropagation(); if (confirm("Excluir este negócio?")) api(`/api/deals/${deal.id}`, "DELETE").then(onChange); }} className="rounded p-1 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>}>
      <div className="mb-3 flex items-center gap-2.5">
        <Avatar name={contactName} size={30} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium text-gray-900">
            <span className="truncate">{deal.title}</span>
            {deal.status !== "OPEN" && <span className={clsx("rounded-full px-1.5 py-0.5 text-[10px]", deal.status === "WON" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>{deal.status === "WON" ? "Ganho" : "Perdido"}</span>}
          </div>
          <input defaultValue={deal.product ?? ""} placeholder="Sem produto" onBlur={(e) => e.target.value !== (deal.product ?? "") && patch({ product: e.target.value || null })}
            className="w-full text-xs text-brand-600 underline outline-none placeholder:text-brand-600" />
        </div>
      </div>
      <div className="space-y-1.5 text-[13px] text-gray-600">
        <div className="flex items-center gap-2"><User size={14} className="text-gray-400" /> {deal.owner?.name ?? "Sem responsável"}</div>
        <div className="flex items-center gap-2"><DollarSign size={14} className="text-gray-400" />
          {editing ? (
            <input autoFocus type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => { setEditing(false); patch({ value: Number(value) || 0 }); }} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} className="input w-32 py-0.5" />
          ) : <button onClick={() => setEditing(true)} className="text-brand-600 underline">{brl(deal.value)}</button>}
        </div>
        <div className="flex items-center gap-2"><Calendar size={14} className="text-gray-400" /> {new Date(deal.createdAt).toLocaleDateString("pt-BR")}</div>
        <div className="flex items-center gap-2"><Filter size={14} className="text-gray-400" />
          <select value={deal.stageId} onChange={(e) => patch({ stageId: e.target.value })} className="rounded bg-transparent text-[13px] outline-none hover:bg-gray-50">
            {stages?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex gap-1 pt-1">
          {stages?.map((s, i) => (
            <button key={s.id} title={s.name} onClick={() => patch({ stageId: s.id })} className={clsx("h-2 flex-1 rounded-sm transition", i <= idx ? "bg-gray-700" : "bg-gray-200 hover:bg-gray-300")} />
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={() => patch({ status: deal.status === "WON" ? "OPEN" : "WON" })} className={clsx("btn flex-1 border text-xs", deal.status === "WON" ? "border-emerald-500 bg-emerald-500 text-white" : "border-emerald-300 text-emerald-600 hover:bg-emerald-50")}><Trophy size={13} /> Ganho</button>
          <button onClick={() => patch({ status: deal.status === "LOST" ? "OPEN" : "LOST" })} className={clsx("btn flex-1 border text-xs", deal.status === "LOST" ? "border-red-500 bg-red-500 text-white" : "border-red-300 text-red-600 hover:bg-red-50")}><ThumbsDown size={13} /> Perdido</button>
        </div>
      </div>
    </Section>
  );
}
