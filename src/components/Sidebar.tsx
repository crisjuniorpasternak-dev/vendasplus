"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { MessageCircle, Users, Rocket, Filter, Smartphone, Settings, LogOut, LayoutGrid } from "lucide-react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";

const items = [
  { href: "/chat", icon: MessageCircle, label: "Multiatendimento" },
  { href: "/negocios", icon: Filter, label: "Negócios (funil)" },
  { href: "/contatos", icon: Users, label: "Contatos e listas" },
  { href: "/campanhas", icon: Rocket, label: "Campanhas / disparos" },
  { href: "/conexoes", icon: Smartphone, label: "Conexões WhatsApp" },
];

export function Sidebar() {
  const path = usePathname();
  const { data: me } = useSWR<{ name: string; role: string }>("/api/me", fetcher);
  return (
    <aside className="flex w-[60px] shrink-0 flex-col items-center border-r border-gray-100 bg-white py-3">
      <Link href="/chat" className="mb-5 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white" title="ZapDesk">
        <LayoutGrid size={18} />
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-1.5">
        {items.map(({ href, icon: Icon, label }) => {
          const active = path.startsWith(href);
          return (
            <Link key={href} href={href} title={label}
              className={clsx("group relative flex h-10 w-10 items-center justify-center rounded-lg transition", active ? "bg-brand-50 text-brand-600" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800")}>
              <Icon size={20} strokeWidth={1.8} />
              <span className="pointer-events-none absolute left-12 z-50 hidden whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col items-center gap-1.5">
        <Link href="/configuracoes" title="Configurações" className={clsx("flex h-10 w-10 items-center justify-center rounded-lg", path.startsWith("/configuracoes") ? "bg-brand-50 text-brand-600" : "text-gray-500 hover:bg-gray-100")}>
          <Settings size={20} strokeWidth={1.8} />
        </Link>
        <button title={`Sair (${me?.name ?? ""})`} onClick={async () => { await api("/api/auth/logout"); window.location.href = "/login"; }}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
          <LogOut size={19} strokeWidth={1.8} />
        </button>
      </div>
    </aside>
  );
}
