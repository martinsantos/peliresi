import { PrismaClient } from '@prisma/client';

// Prisma singleton to avoid multiple instances during hot-reload/PM2
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// Connection pool is configured via DATABASE_URL query params:
//   ?connection_limit=20&pool_timeout=10
// With PM2 cluster mode (2 instances), total pool = 40 connections.
// Default Prisma pool is only 5 — too low for 100 concurrent users.
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
