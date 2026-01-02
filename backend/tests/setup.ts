import { PrismaClient } from '@prisma/client';

// Mock de Prisma para tests
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    usuario: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    manifiesto: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    tipoResiduo: {
      findMany: jest.fn()
    },
    trackingGPS: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    eventoManifiesto: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    $disconnect: jest.fn()
  }))
}));

// Variables de entorno para tests
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.NODE_ENV = 'test';

// Limpiar mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});

// Cerrar conexiones después de todos los tests
afterAll(async () => {
  // Cleanup si es necesario
});
