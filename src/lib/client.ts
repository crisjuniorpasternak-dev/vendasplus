"use client";
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function fetcher<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error ?? res.statusText);
  return data;
}

export async function api<T = any>(url: string, method = "POST", body?: unknown): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error ?? res.statusText);
  return data;
}

export const displayName = (c?: { name?: string | null; pushName?: string | null; phone?: string } | null) =>
  c?.name || c?.pushName || (c?.phone ? formatPhoneClient(c.phone) : "Sem nome");

export function formatPhoneClient(d: string) {
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const rest = d.slice(4);
    const a = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
    return `+55 (${d.slice(2, 4)}) ${a}-${rest.slice(a.length)}`;
  }
  return "+" + d;
}

export function relativeTime(iso: string | Date) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export const brl = (v: number | string) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
