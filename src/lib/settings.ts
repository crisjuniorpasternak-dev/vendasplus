import { randomBytes } from "crypto";
import { prisma } from "./db";

const cache = new Map<string, { v: string | null; at: number }>();
const TTL = 30_000;

export async function getSetting(key: string): Promise<string | null> {
  const c = cache.get(key);
  if (c && Date.now() - c.at < TTL) return c.v;
  const row = await prisma.appSetting.findUnique({ where: { key } });
  cache.set(key, { v: row?.value ?? null, at: Date.now() });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string | null) {
  if (value === null || value === "") await prisma.appSetting.deleteMany({ where: { key } });
  else await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  cache.delete(key);
}

/** Segredo gerado automaticamente na primeira vez e guardado no banco. Variável de ambiente tem prioridade. */
export async function ensureSecret(key: string, envValue?: string): Promise<string> {
  if (envValue) return envValue;
  const existing = await getSetting(key);
  if (existing) return existing;
  const value = randomBytes(24).toString("hex");
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: {} });
  cache.delete(key);
  return (await getSetting(key))!;
}

export const webhookSecret = () => ensureSecret("webhook_secret", process.env.WEBHOOK_SECRET);
export const cronSecret = () => ensureSecret("cron_secret", process.env.CRON_SECRET);

/** Evolution: variáveis de ambiente têm prioridade; senão usa o que foi salvo na tela de Conexões. */
export async function getEvolutionConfig() {
  const url = (process.env.EVOLUTION_API_URL || (await getSetting("evolution_url")) || "").replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY || (await getSetting("evolution_api_key")) || "";
  return { url, apiKey, fromEnv: !!process.env.EVOLUTION_API_URL };
}

/** URL pública do sistema: APP_URL, domínio de produção da Vercel ou a origem da requisição. */
export function appUrl(req?: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (req) {
    const h = req.headers;
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  }
  return "http://localhost:3000";
}

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";
