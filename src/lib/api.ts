import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Envolve um route handler com tratamento padronizado de erros. */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: "Dados inválidos", issues: e.issues }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 });
    }
  };
}

export const json = NextResponse.json;
