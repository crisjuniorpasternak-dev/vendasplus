import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, createSessionToken } from "@/lib/session";

export const POST = route(async (req) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(await req.json());
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
  }
  const { token, maxAge } = await createSessionToken(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.APP_URL?.startsWith("https"), maxAge, path: "/" });
  return res;
});
