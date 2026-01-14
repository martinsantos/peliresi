import { PrismaClient } from '@prisma/client';

// Obtener DATABASE_URL y agregar parámetros de pool optimizados
const getDatabaseUrl = (): string => {
  const baseUrl = process.env.DATABASE_URL || '';

  // Si ya tiene parámetros, agregar con &, sino con ?
  const separator = baseUrl.includes('?') ? '&' : '?';

  // Pool de 30 conexiones para soportar 200+ usuarios concurrentes
  // pool_timeout=20 segundos para evitar conexiones huérfanas
  return `${baseUrl}${separator}connection_limit=30&pool_timeout=20`;
};

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  },
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'warn', 'error']
    : ['warn', 'error']
});

// Graceful shutdown - cerrar conexiones al terminar
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
