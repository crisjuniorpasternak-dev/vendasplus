"use client";
import { useEffect, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { api } from "@/lib/client";

export default function LoginPage() {
  const [setup, setSetup] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/setup").then((r) => r.json()).then((d) => setSetup(!!d.needsSetup)).catch(() => setSetup(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (setup) await api("/api/auth/setup", "POST", { name, email, password });
      else await api("/api/auth/login", "POST", { email, password });
      window.location.href = setup ? "/conexoes" : "/chat";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-white p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><MessagesSquare size={22} /></div>
          <div>
            <h1 className="text-lg font-semibold">ZapDesk</h1>
            <p className="text-xs text-gray-500">Multiatendimento WhatsApp</p>
          </div>
        </div>
        {setup && (
          <>
            <p className="mb-4 rounded-md bg-brand-50 p-3 text-sm text-brand-700">Primeiro acesso: crie a conta de administrador.</p>
            <label className="label">Seu nome</label>
            <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </>
        )}
        <label className="label">E-mail</label>
        <input className="input mb-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={!setup} />
        <label className="label">Senha{setup ? " (mín. 8 caracteres)" : ""}</label>
        <input className="input mb-4" type="password" value={password} minLength={setup ? 8 : undefined} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full py-2" disabled={loading || setup === null}>{loading ? "Aguarde..." : setup ? "Criar conta e entrar" : "Entrar"}</button>
      </form>
    </div>
  );
}
