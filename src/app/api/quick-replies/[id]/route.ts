import { route, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  await requireUser();
  await prisma.quickReply.delete({ where: { id: (await params).id } });
  return json({ ok: true });
});
