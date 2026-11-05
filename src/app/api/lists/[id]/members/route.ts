import { z } from "zod";
import { route, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Adiciona contatos à lista: por IDs ou por tag. */
export const POST = route<Ctx>(async (req, { params }) => {
  await requireUser();
  const { id } = await params;
  const b = z.object({ contactIds: z.array(z.string()).optional(), tagId: z.string().optional() }).parse(await req.json());
  let ids = b.contactIds ?? [];
  if (b.tagId) ids = ids.concat((await prisma.contactTag.findMany({ where: { tagId: b.tagId } })).map((t) => t.contactId));
  const r = await prisma.contactListMember.createMany({ data: ids.map((contactId) => ({ listId: id, contactId })), skipDuplicates: true });
  return json({ added: r.count });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  await requireUser();
  const { id } = await params;
  const contactId = new URL(req.url).searchParams.get("contactId");
  if (contactId) await prisma.contactListMember.deleteMany({ where: { listId: id, contactId } });
  else await prisma.contactList.delete({ where: { id } });
  return json({ ok: true });
});
