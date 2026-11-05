import { z } from "zod";
import { route, json } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/auth";
import { setSetting } from "@/lib/settings";

/** Salva URL e API key da Evolution no banco (usado quando não há variáveis de ambiente). */
export const PUT = route(async (req) => {
  await requireAdmin();
  if (process.env.EVOLUTION_API_URL) throw new HttpError(400, "A Evolution está definida por variáveis de ambiente no servidor");
  const b = z.object({ url: z.string().url("URL inválida"), apiKey: z.string().optional() }).parse(await req.json());
  await setSetting("evolution_url", b.url.replace(/\/+$/, ""));
  if (b.apiKey) await setSetting("evolution_api_key", b.apiKey.trim());
  return json({ ok: true });
});
