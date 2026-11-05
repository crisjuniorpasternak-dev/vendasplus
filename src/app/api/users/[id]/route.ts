import { z } from "zod";
import { route, json } from "@/lib/api";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  await requireAdmin();
  const b = z.object({ name: z.string().optional(), role: z.enum(["ADMIN", "AGENT"]).optional(), active: z.boolean().optional(), password: z.string().min(6).optional() }).parse(await req.json());
  const { password, ...rest } = b;
  await prisma.user.update({ where: { id: (await params).id }, data: { ...rest, ...(password ? { passwordHash: hashPassword(password) } : {}) } });
  return json({ ok: true });
});
