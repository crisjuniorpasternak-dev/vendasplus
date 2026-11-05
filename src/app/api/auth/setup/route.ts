import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { HttpError, createSession, hashPassword, sessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Primeiro acesso: enquanto não existe nenhum usuário, permite criar o administrador. */
export const GET = route(async () => NextResponse.json({ needsSetup: (await prisma.user.count()) === 0 }));

export const POST = route(async (req) => {
  const b = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres") }).parse(await req.json());
  const user = await prisma.$transaction(async (tx) => {
    if ((await tx.user.count()) > 0) throw new HttpError(409, "O administrador já foi criado. Faça login.");
    return tx.user.create({ data: { name: b.name, email: b.email.toLowerCase(), role: "ADMIN", passwordHash: hashPassword(b.password) } });
  }, { isolationLevel: "Serializable" });
  const { token, maxAge } = await createSession(user.id);
  const res = NextResponse.json({ ok: true }, { status: 201 });
  res.cookies.set(sessionCookie(token, maxAge, req));
  return res;
});
