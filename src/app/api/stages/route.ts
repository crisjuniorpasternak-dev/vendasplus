import { route, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = route(async () => {
  await requireUser();
  return json(await prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }));
});
