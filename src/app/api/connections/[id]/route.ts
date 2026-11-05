import { z } from "zod";
import { route, json } from "@/lib/api";
import { requireAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/whatsapp";

type Ctx = { params: Promise<{ id: string }> };

/** Consulta o estado atual da conexão no provedor. */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireUser();
  const conn = await prisma.connection.findUniqueOrThrow({ where: { id: (await params).id } });
  try {
    const st = await getProvider(conn).getState();
    const updated = await prisma.connection.update({ where: { id: conn.id }, data: { status: st.state, phone: st.phone ?? conn.phone } });
    return json({ ...updated, detail: st.detail });
  } catch (e) {
    return json({ ...conn, status: "error", error: e instanceof Error ? e.message : String(e) });
  }
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const b = z.object({ name: z.string().optional(), instanceName: z.string().optional(), provider: z.enum(["EVOLUTION", "CLOUD_API"]).optional(), isDefault: z.boolean().optional() }).parse(await req.json());
  if (b.isDefault) await prisma.connection.updateMany({ data: { isDefault: false } });
  return json(await prisma.connection.update({ where: { id }, data: b }));
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  await requireAdmin();
  await prisma.connection.delete({ where: { id: (await params).id } });
  return json({ ok: true });
});
