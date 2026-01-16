import { PrismaClient } from '@prisma/client';

// Obtener DATABASE_URL y agregar parámetros de pool optimizados
const getDatabaseUrl = (): string => {
  const baseUrl = process.env.DATABASE_URL || '';

  // Si ya tiene parámetros, agregar con &, sino con ?
  const separator = baseUrl.includes('?') ? '&' : '?';

  // OPTIMIZADO: Pool de 50 conexiones para soportar 500+ usuarios concurrentes
  // pool_timeout=30 segundos para manejar picos de carga
  // socket_timeout=15 segundos para evitar queries colgadas
  return `${baseUrl}${separator}connection_limit=50&pool_timeout=30&socket_timeout=15`;
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
