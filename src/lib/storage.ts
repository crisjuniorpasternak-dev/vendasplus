import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { env } from "./env";

/** Na Vercel o disco é efêmero: com BLOB_READ_WRITE_TOKEN as mídias vão para o Vercel Blob (privado). */
const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/webm": "webm", "audio/aac": "aac",
  "video/mp4": "mp4", "video/3gpp": "3gp", "application/pdf": "pdf",
};

export function extFor(mime?: string | null, fileName?: string | null) {
  if (fileName && fileName.includes(".")) return fileName.split(".").pop()!.toLowerCase().slice(0, 8);
  const base = (mime ?? "").split(";")[0].trim();
  return EXT[base] ?? "bin";
}

/** Salva um arquivo e devolve o caminho relativo (usado em /api/media/<caminho>). */
export async function saveMedia(data: Buffer, mime?: string | null, fileName?: string | null) {
  const d = new Date();
  const dir = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const rel = `${dir}/${randomUUID()}.${extFor(mime, fileName)}`;
  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    await put(`media/${rel}`, data, { access: "private", contentType: mime ?? undefined, addRandomSuffix: false });
    return rel;
  }
  const abs = path.resolve(env.uploadDir, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, data);
  return rel;
}

export function resolveMedia(rel: string) {
  const root = path.resolve(env.uploadDir);
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) throw new Error("caminho inválido");
  return abs;
}

export async function readMedia(rel: string): Promise<Buffer> {
  if (blobEnabled()) {
    const { get } = await import("@vercel/blob");
    const r = await get(`media/${rel}`, { access: "private" });
    if (!r || r.statusCode !== 200) throw new Error("mídia não encontrada");
    return Buffer.from(await new Response(r.stream).arrayBuffer());
  }
  return readFile(resolveMedia(rel));
}

export const mediaUrl = (rel?: string | null) => (rel ? `/api/media/${rel}` : null);
