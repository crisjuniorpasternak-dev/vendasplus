// Build da Vercel: aplica migrations (no schema próprio), roda o seed e compila o Next.
import { execSync } from "child_process";
import { withSchema } from "../src/lib/db-url";

const env = {
  ...process.env,
  DATABASE_URL: withSchema(process.env.DATABASE_URL),
  DATABASE_URL_UNPOOLED: withSchema(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL),
};
const run = (cmd: string) => execSync(cmd, { stdio: "inherit", env });

run("npx prisma generate");
run("npx prisma migrate deploy");
run("npx tsx prisma/seed.ts");
run("npx next build");
