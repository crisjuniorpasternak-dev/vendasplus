import { z } from "zod";
import { route, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logHistory } from "@/lib/messaging";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { tagId, name } = z.object({ tagId: z.string().optional(), name: z.string().optional() }).parse(await req.json());
  const tag = tagId
    ? await prisma.tag.findUniqueOrThrow({ where: { id: tagId } })
    : await prisma.tag.upsert({ where: { name: name!.trim() }, create: { name: name!.trim() }, update: {} });
  await prisma.contactTag.upsert({ where: { contactId_tagId: { contactId: id, tagId: tag.id } }, create: { contactId: id, tagId: tag.id }, update: {} });
  await logHistory({ contactId: id, userId: user.id, type: "tag_added", description: `Tag "${tag.name}" adicionada` });
  return json(tag);
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  await requireUser();
  const { id } = await params;
  const tagId = new URL(req.url).searchParams.get("tagId")!;
  await prisma.contactTag.deleteMany({ where: { contactId: id, tagId } });
  return json({ ok: true });
});
