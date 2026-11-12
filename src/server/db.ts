import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** node-postgres warns that sslmode=require will change meaning; verify-full is what it does today, so say so explicitly. */
export function connectionString(url = process.env.DATABASE_URL ?? ""): string {
  return url.replace(/sslmode=(require|prefer|verify-ca)\b/, "sslmode=verify-full");
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString() }) });
}

// One client across hot reloads in dev; each serverless instance gets its own.
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
