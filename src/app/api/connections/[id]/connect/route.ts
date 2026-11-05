import { route, json } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/whatsapp";

type Ctx = { params: Promise<{ id: string }> };

/** Gera QR Code / código de pareamento (Evolution). */
export const POST = route<Ctx>(async (_req, { params }) => {
  await requireAdmin();
  const conn = await prisma.connection.findUniqueOrThrow({ where: { id: (await params).id } });
  const p = getProvider(conn);
  if (!p.connect) throw new HttpError(400, "Este provedor não usa QR Code (Cloud API é conectada pelo painel da Meta)");
  try {
    return json(await p.connect());
  } catch (e) {
    throw new HttpError(502, e instanceof Error ? e.message : "Falha ao conectar");
  }
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  await requireAdmin();
  const conn = await prisma.connection.findUniqueOrThrow({ where: { id: (await params).id } });
  const p = getProvider(conn);
  if (!p.logout) throw new HttpError(400, "Não suportado");
  await p.logout();
  await prisma.connection.update({ where: { id: conn.id }, data: { status: "close" } });
  return json({ ok: true });
});
