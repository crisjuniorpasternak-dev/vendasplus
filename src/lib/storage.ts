import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { env } from "./env";

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

export async function readMedia(rel: string) {
  return readFile(resolveMedia(rel));
}

export const mediaUrl = (rel?: string | null) => (rel ? `/api/media/${rel}` : null);
