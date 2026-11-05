import { route, json } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { retryMessage } from "@/lib/messaging";

export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  await requireUser();
  try {
    return json(await retryMessage((await params).id));
  } catch (e) {
    throw new HttpError(502, e instanceof Error ? e.message : "Falha no reenvio");
  }
});
