// Test setup file
import { PrismaClient } from '@prisma/client';

// Mock de Prisma Client para tests unitarios
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    manifiesto: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    usuario: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    reversionEstado: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    eventoManifiesto: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    logActividad: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    transportista: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    operador: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    generador: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    vehiculo: {
      count: jest.fn(),
    },
    chofer: {
      count: jest.fn(),
    },
    tratamientoAutorizado: {
      count: jest.fn(),
    },
    $transaction: jest.fn((callbacks) => Promise.all(callbacks)),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

// Timeout global para tests
jest.setTimeout(30000);

// Limpiar mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});

// Exportar instancia mock de Prisma para usar en tests
export const prismaMock = new PrismaClient();
