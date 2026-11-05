import { z } from "zod";
import { route, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = route(async () => {
  await requireUser();
  return json(await prisma.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { contacts: true } } } }));
});

export const POST = route(async (req) => {
  await requireUser();
  const b = z.object({ name: z.string().min(1), color: z.string().optional() }).parse(await req.json());
  return json(await prisma.tag.upsert({ where: { name: b.name }, create: b, update: { color: b.color } }), { status: 201 });
});
