// Sessão assinada com HMAC via Web Crypto (funciona no middleware/edge e no Node).
const enc = new TextEncoder();
export const SESSION_COOKIE = "zd_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function b64url(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET ausente ou muito curto (mín. 16 caracteres)");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function sign(payload: string) {
  return b64url(await crypto.subtle.sign("HMAC", await key(), enc.encode(payload)));
}

export async function createSessionToken(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${userId}.${exp}`;
  return { token: `${payload}.${await sign(payload)}`, maxAge: MAX_AGE };
}

export async function verifySessionToken(token?: string | null): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (Number(exp) < Date.now() / 1000) return null;
  const expected = await sign(`${userId}.${exp}`);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? userId : null;
}
