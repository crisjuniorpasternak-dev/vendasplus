import { z } from "zod";
import { route, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = route(async () => {
  await requireUser();
  return json(await prisma.contactList.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { members: true } } } }));
});

export const POST = route(async (req) => {
  await requireUser();
  const { name } = z.object({ name: z.string().min(1) }).parse(await req.json());
  return json(await prisma.contactList.create({ data: { name } }), { status: 201 });
});
