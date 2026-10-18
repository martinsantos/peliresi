import { PrismaClient } from '@prisma/client';
import { prismaConnectionUrl } from './prismaConnection';
import { contextualClient, trainingConnectionUrl } from './trainingScope';

// Prisma singleton to avoid multiple instances during hot-reload/PM2
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// Explicit defaults bound the two production workers to at most forty DB
// connections. Existing URL overrides (including the small QA pool) are honored.
const datasource = process.env.DATABASE_URL ? prismaConnectionUrl(process.env.DATABASE_URL) : undefined;
const operationalPrisma = globalForPrisma.prisma ?? new PrismaClient(datasource ? { datasources: { db: { url: datasource } } } : undefined);
let schoolPrisma: PrismaClient | undefined;
function trainingPrisma(): PrismaClient {
  if (!schoolPrisma) {
    const url = trainingConnectionUrl(process.env.DATABASE_URL || '', process.env.TRAINING_DATABASE_URL || '');
    schoolPrisma = new PrismaClient({ datasources: { db: { url } } });
  }
  return schoolPrisma;
}
export const prisma = contextualClient(operationalPrisma, trainingPrisma);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = operationalPrisma;
}

export default prisma;
