import { cookies } from "next/headers";
import { prisma } from "./db";
import { createHash, randomBytes } from "crypto";
import { SESSION_COOKIE, SESSION_MAX_AGE, looksLikeSession } from "./session";

export { hashPassword, verifyPassword } from "./auth-hash";

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!looksLikeSession(token)) return null;
  const session = await prisma.session.findUnique({ where: { id: hashToken(token!) } });
  if (!session || session.expiresAt < new Date()) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return user?.active ? user : null;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Não autenticado");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new HttpError(403, "Apenas administradores");
  return user;
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000) } });
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return { token, maxAge: SESSION_MAX_AGE };
}

export async function destroySession(token?: string) {
  if (looksLikeSession(token)) await prisma.session.deleteMany({ where: { id: hashToken(token!) } });
}

export function sessionCookie(token: string, maxAge: number, req: Request) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, sameSite: "lax" as const, secure: new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https", maxAge, path: "/" };
}
