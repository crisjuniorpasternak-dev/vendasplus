import { route, json } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

/** Importa CSV com colunas: nome, telefone (ou whatsapp/celular), email, tags (separadas por |). */
export const POST = route(async (req) => {
  await requireUser();
  const form = await req.formData();
  const file = form.get("file");
  const listId = (form.get("listId") as string) || null;
  const newList = (form.get("newList") as string)?.trim();
  if (!file || typeof file === "string") throw new HttpError(400, "Envie um arquivo CSV");
  const rows = parseCsv(await file.text());
  let targetList = listId;
  if (newList) targetList = (await prisma.contactList.upsert({ where: { name: newList }, create: { name: newList }, update: {} })).id;

  let imported = 0, invalid = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const phone = normalizePhone(r.telefone ?? r.phone ?? r.whatsapp ?? r.celular ?? r.numero ?? "");
    if (phone.length < 10 || seen.has(phone)) { invalid++; continue; }
    seen.add(phone);
    const name = r.nome ?? r.name ?? "";
    const email = r.email ?? r["e-mail"] ?? "";
    const c = await prisma.contact.upsert({
      where: { phone },
      create: { phone, name: name || null, email: email || null },
      update: { ...(name ? { name } : {}), ...(email ? { email } : {}) },
    });
    if (targetList) {
      await prisma.contactListMember.upsert({ where: { listId_contactId: { listId: targetList, contactId: c.id } }, create: { listId: targetList, contactId: c.id }, update: {} });
    }
    for (const t of (r.tags ?? r.etiquetas ?? "").split("|").map((s) => s.trim()).filter(Boolean)) {
      const tag = await prisma.tag.upsert({ where: { name: t }, create: { name: t }, update: {} });
      await prisma.contactTag.upsert({ where: { contactId_tagId: { contactId: c.id, tagId: tag.id } }, create: { contactId: c.id, tagId: tag.id }, update: {} });
    }
    imported++;
  }
  return json({ imported, invalid, total: rows.length, listId: targetList });
});
