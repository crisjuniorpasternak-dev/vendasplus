import { z } from "zod";
import { route, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logHistory } from "@/lib/messaging";
import { normalizePhone } from "@/lib/phone";

type Ctx = { params: Promise<{ id: string }> };

const opt = z.string().nullable().optional();
const schema = z.object({
  name: opt, email: opt, site: opt, document: opt, phone: z.string().optional(),
  birthDate: opt, notes: opt, street: opt, number: opt, district: opt, city: opt, state: opt, zipCode: opt,
  optOut: z.boolean().optional(),
  customFields: z.record(z.string(), z.string()).optional(),
  listIds: z.array(z.string()).optional(),
});

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireUser();
  return json(await prisma.contact.findUniqueOrThrow({ where: { id: (await params).id }, include: { tags: { include: { tag: true } }, lists: { include: { list: true } } } }));
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { listIds, birthDate, phone, ...rest } = schema.parse(await req.json());
  const data: Record<string, unknown> = { ...rest };
  if (birthDate !== undefined) data.birthDate = birthDate ? new Date(birthDate) : null;
  if (phone) data.phone = normalizePhone(phone);
  const contact = await prisma.contact.update({ where: { id }, data });
  if (listIds) {
    const current = await prisma.contactListMember.findMany({ where: { contactId: id } });
    const add = listIds.filter((l) => !current.some((c) => c.listId === l));
    await prisma.contactListMember.deleteMany({ where: { contactId: id, listId: { notIn: listIds } } });
    if (add.length) await prisma.contactListMember.createMany({ data: add.map((listId) => ({ listId, contactId: id })) });
    if (add.length) {
      const lists = await prisma.contactList.findMany({ where: { id: { in: add } } });
      await logHistory({ contactId: id, userId: user.id, type: "list_added", description: `Adicionado à lista ${lists.map((l) => l.name).join(", ")}` });
    }
  }
  return json(contact);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  await requireUser();
  await prisma.contact.delete({ where: { id: (await params).id } });
  return json({ ok: true });
});
