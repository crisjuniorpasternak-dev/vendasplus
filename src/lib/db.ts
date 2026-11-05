import { PrismaClient } from "@prisma/client";
import { withSchema } from "./db-url";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient({ datasourceUrl: withSchema(process.env.DATABASE_URL) });
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
