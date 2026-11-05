import { route, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async () => json(await requireUser()));
