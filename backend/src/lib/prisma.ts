import { PrismaClient } from '@prisma/client';
import { prismaConnectionUrl } from './prismaConnection';

// Prisma singleton to avoid multiple instances during hot-reload/PM2
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// Explicit defaults bound the two production workers to at most forty DB
// connections. Existing URL overrides (including the small QA pool) are honored.
const datasource = process.env.DATABASE_URL ? prismaConnectionUrl(process.env.DATABASE_URL) : undefined;
export const prisma = globalForPrisma.prisma ?? new PrismaClient(datasource ? { datasources: { db: { url: datasource } } } : undefined);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
