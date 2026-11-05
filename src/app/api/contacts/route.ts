import { z } from "zod";
import { route, json } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

export const GET = route(async (req) => {
  await requireUser();
  const p = new URL(req.url).searchParams;
  const q = p.get("q")?.trim();
  const listId = p.get("listId") || undefined;
  const tagId = p.get("tagId") || undefined;
  const page = Math.max(1, Number(p.get("page") ?? 1));
  const take = 50;
  const where = {
    ...(listId ? { lists: { some: { listId } } } : {}),
    ...(tagId ? { tags: { some: { tagId } } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { pushName: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q.replace(/\D/g, "") || q } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: { tags: { include: { tag: true } }, lists: { include: { list: true } } },
    }),
    prisma.contact.count({ where }),
  ]);
  return json({ items, total, page, pages: Math.ceil(total / take) });
});

export const POST = route(async (req) => {
  await requireUser();
  const b = z.object({ name: z.string().optional(), phone: z.string(), email: z.string().optional(), listId: z.string().optional() }).parse(await req.json());
  const phone = normalizePhone(b.phone);
  if (phone.length < 10) throw new HttpError(400, "Telefone inválido");
  const contact = await prisma.contact.upsert({
    where: { phone },
    create: { phone, name: b.name || null, email: b.email || null },
    update: { ...(b.name ? { name: b.name } : {}), ...(b.email ? { email: b.email } : {}) },
  });
  if (b.listId) {
    await prisma.contactListMember.upsert({ where: { listId_contactId: { listId: b.listId, contactId: contact.id } }, create: { listId: b.listId, contactId: contact.id }, update: {} });
  }
  return json(contact, { status: 201 });
});
