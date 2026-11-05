/**
 * Permite isolar as tabelas do sistema em um schema próprio do Postgres.
 * Na Vercel usa o schema "vendasplus" por padrão, para não misturar com tabelas
 * que já existam no banco (ex.: um banco Neon reaproveitado). Sobrescreva com DB_SCHEMA.
 */
export function dbSchema(): string | undefined {
  return process.env.DB_SCHEMA || (process.env.VERCEL ? "vendasplus" : undefined);
}

export function withSchema(url: string | undefined): string | undefined {
  const schema = dbSchema();
  if (!url || !schema) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("schema")) u.searchParams.set("schema", schema);
    return u.toString();
  } catch {
    return url;
  }
}
