import { z } from "zod";
import { route, json } from "@/lib/api";
import { hashPassword, requireAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = route(async () => {
  await requireUser();
  return json(await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true, active: true } }));
});

export const POST = route(async (req) => {
  await requireAdmin();
  const b = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(6), role: z.enum(["ADMIN", "AGENT"]).default("AGENT") }).parse(await req.json());
  const u = await prisma.user.create({ data: { name: b.name, email: b.email.toLowerCase(), role: b.role, passwordHash: hashPassword(b.password) } });
  return json({ id: u.id }, { status: 201 });
});
