import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { readMedia } from "@/lib/storage";
import { prisma } from "@/lib/db";

export const GET = route<{ params: Promise<{ path: string[] }> }>(async (_req, { params }) => {
  await requireUser();
  const rel = (await params).path.join("/");
  const msg = await prisma.message.findFirst({ where: { mediaPath: rel }, select: { mediaMime: true, fileName: true } });
  const camp = msg ? null : await prisma.campaign.findFirst({ where: { mediaPath: rel }, select: { mediaMime: true, mediaFileName: true } });
  const data = await readMedia(rel).catch(() => null);
  if (!data) return new Response("Não encontrado", { status: 404 });
  const mime = msg?.mediaMime ?? camp?.mediaMime ?? "application/octet-stream";
  const name = msg?.fileName ?? camp?.mediaFileName;
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime.split(";")[0],
      "Cache-Control": "private, max-age=86400",
      ...(name ? { "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"` } : {}),
    },
  });
});
