// Sessões guardadas no banco (dispensa AUTH_SECRET). O middleware só verifica se o cookie existe;
// a validação real acontece em requireUser() em cada rota da API.
export const SESSION_COOKIE = "zd_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function looksLikeSession(token?: string | null) {
  return !!token && /^[a-f0-9]{64}$/.test(token);
}
