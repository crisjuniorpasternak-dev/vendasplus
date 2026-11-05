import { z } from "zod";
import { route, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = route(async () => {
  await requireUser();
  return json(await prisma.quickReply.findMany({ orderBy: { shortcut: "asc" } }));
});

export const POST = route(async (req) => {
  await requireUser();
  const b = z.object({ shortcut: z.string().min(1).transform((s) => s.replace(/^\//, "").trim()), body: z.string().min(1) }).parse(await req.json());
  return json(await prisma.quickReply.upsert({ where: { shortcut: b.shortcut }, create: b, update: { body: b.body } }), { status: 201 });
});
