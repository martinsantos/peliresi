import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';

// Mock QRCode
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fakeqr') },
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fakeqr'),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Mock prisma
const { mockFindUnique, mockFindMany, mockCount, mockUpdate, mockCreate, mockTransaction } = vi.hoisted(() => {
  // transaction callback
  const mockTxUpdate = vi.fn();
  const mockTxCreate = vi.fn();
  const mockTxFindUnique = vi.fn();
  const mockTxCount = vi.fn();
  const mockTxManifiesto = { findUnique: mockTxFindUnique, update: mockTxUpdate, count: mockTxCount };
  const mockTxCreateMany = vi.fn();

  return {
    mockFindUnique: vi.fn(),
    mockFindMany: vi.fn(),
    mockCount: vi.fn(),
    mockUpdate: vi.fn(),
    mockCreate: vi.fn(),
    mockTransaction: vi.fn((cb: Function) => cb({
      manifiesto: {
        findUnique: mockTxFindUnique,
        update: mockTxUpdate,
        count: mockTxCount,
      },
      eventoManifiesto: {
        create: mockTxCreate,
        createMany: mockTxCreateMany,
        count: mockTxCount,
      },
      trackingGPS: { create: vi.fn() },
    })),
  };
});

vi.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    manifiesto: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      count: mockCount,
      update: mockUpdate,
    },
    eventoManifiesto: { create: mockCreate },
    $transaction: mockTransaction,
  },
}));

// Mock blockchain service
vi.mock('../../services/blockchain.service', () => ({
  hashManifiesto: vi.fn().mockReturnValue('fake-hash-abc'),
  computeRollingHash: vi.fn().mockReturnValue('rolling-hash-xyz'),
  computeClosureHash: vi.fn().mockReturnValue('closure-hash-123'),
  registrarSello: vi.fn().mockResolvedValue(undefined),
}));

// Mock domain events
vi.mock('../../services/domainEvent.service', () => ({
  domainEvents: { emit: vi.fn() },
}));

// Mock manifiesto-gps controller
vi.mock('../../controllers/manifiesto-gps.controller', () => ({
  invalidateGpsCache: vi.fn(),
}));

import {
  firmarManifiesto,
  confirmarRetiro,
  confirmarEntrega,
  confirmarRecepcion,
  confirmarRecepcionInSitu,
  cerrarManifiesto,
  rechazarCarga,
  registrarIncidente,
  registrarTratamiento,
  revertirEstado,
  registrarPesaje,
  cancelarManifiesto,
} from '../../controllers/manifiesto-workflow.controller';

function createMocks(userOverrides = {}) {
  const req = {
    params: {},
    body: {},
    user: {
      id: 'user-1',
      rol: 'ADMIN',
      ...userOverrides,
    },
  } as unknown as AuthRequest;
  const res = {
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('ManifiestoWorkflowController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  describe('exported functions', () => {
    it('firmarManifiesto is a function', () => { expect(typeof firmarManifiesto).toBe('function'); });
    it('confirmarRetiro is a function', () => { expect(typeof confirmarRetiro).toBe('function'); });
    it('confirmarEntrega is a function', () => { expect(typeof confirmarEntrega).toBe('function'); });
    it('confirmarRecepcion is a function', () => { expect(typeof confirmarRecepcion).toBe('function'); });
    it('confirmarRecepcionInSitu is a function', () => { expect(typeof confirmarRecepcionInSitu).toBe('function'); });
    it('cerrarManifiesto is a function', () => { expect(typeof cerrarManifiesto).toBe('function'); });
    it('rechazarCarga is a function', () => { expect(typeof rechazarCarga).toBe('function'); });
    it('registrarIncidente is a function', () => { expect(typeof registrarIncidente).toBe('function'); });
    it('registrarTratamiento is a function', () => { expect(typeof registrarTratamiento).toBe('function'); });
    it('revertirEstado is a function', () => { expect(typeof revertirEstado).toBe('function'); });
    it('registrarPesaje is a function', () => { expect(typeof registrarPesaje).toBe('function'); });
    it('cancelarManifiesto is a function', () => { expect(typeof cancelarManifiesto).toBe('function'); });
  });

  describe('firmarManifiesto', () => {
    it('throws 404 when manifiesto is not found', async () => {
      const { req, res, next } = createMocks();
      req.params = { id: 'nonexistent' };
      mockFindUnique.mockResolvedValue(null);

      await firmarManifiesto(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404, message: expect.stringContaining('no encontrado') })
      );
    });

    it('throws 400 when manifiesto is not BORRADOR', async () => {
      const { req, res, next } = createMocks();
      req.params = { id: 'man-1' };
      mockFindUnique.mockResolvedValue({ id: 'man-1', numero: 'MAN-001', estado: 'APROBADO' });

      await firmarManifiesto(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });
  });

  describe('confirmarRetiro', () => {
    it('throws 403 when user is not TRANSPORTISTA or ADMIN', async () => {
      const { req, res, next } = createMocks({ rol: 'GENERADOR' });
      req.params = { id: 'man-1' };

      await confirmarRetiro(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it('throws 400 for IN_SITU manifiestos', async () => {
      const { req, res, next } = createMocks({ rol: 'TRANSPORTISTA' });
      req.params = { id: 'man-1' };
      mockFindUnique.mockResolvedValue({ modalidad: 'IN_SITU' });

      await confirmarRetiro(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });
  });

  describe('confirmarEntrega', () => {
    it('throws 403 when user is not TRANSPORTISTA or ADMIN', async () => {
      const { req, res, next } = createMocks({ rol: 'GENERADOR' });
      req.params = { id: 'man-1' };

      await confirmarEntrega(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it('throws 400 for IN_SITU manifiestos', async () => {
      const { req, res, next } = createMocks({ rol: 'TRANSPORTISTA' });
      req.params = { id: 'man-1' };
      mockFindUnique.mockResolvedValue({ modalidad: 'IN_SITU' });

      await confirmarEntrega(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });
  });

  describe('confirmarRecepcion', () => {
    it('throws 403 when user is not OPERADOR or ADMIN', async () => {
      const { req, res, next } = createMocks({ rol: 'TRANSPORTISTA' });
      req.params = { id: 'man-1' };

      await confirmarRecepcion(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });
  });

  describe('confirmarRecepcionInSitu', () => {
    it('throws 403 when user is not OPERADOR or ADMIN', async () => {
      const { req, res, next } = createMocks({ rol: 'GENERADOR' });
      req.params = { id: 'man-1' };

      await confirmarRecepcionInSitu(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });
  });

  describe('cerrarManifiesto', () => {
    it('throws 403 when user is not OPERADOR or ADMIN', async () => {
      const { req, res, next } = createMocks({ rol: 'TRANSPORTISTA' });
      req.params = { id: 'man-1' };

      await cerrarManifiesto(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });
  });

  describe('rechazarCarga', () => {
    it('throws 403 when user is not OPERADOR or ADMIN', async () => {
      const { req, res, next } = createMocks({ rol: 'TRANSPORTISTA' });
      req.params = { id: 'man-1' };

      await rechazarCarga(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });
  });

  describe('registrarIncidente', () => {
    it('throws 403 when user is not TRANSPORTISTA or ADMIN', async () => {
      const { req, res, next } = createMocks({ rol: 'GENERADOR' });
      req.params = { id: 'man-1' };
      req.body = { descripcion: 'Incidente de prueba', tipo: 'DERRAME' }; // Zod validates before role check

      await registrarIncidente(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it('throws 400 when body validation fails', async () => {
      const { req, res, next } = createMocks({ rol: 'TRANSPORTISTA' });
      req.params = { id: 'man-1' };
      req.body = {}; // Missing descripcion (required min 1 char)

      await registrarIncidente(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });
  });

  describe('registrarTratamiento', () => {
    it('throws 403 when user is not OPERADOR or ADMIN', async () => {
      const { req, res, next } = createMocks({ rol: 'GENERADOR' });
      req.params = { id: 'man-1' };

      await registrarTratamiento(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });
  });

  describe('revertirEstado', () => {
    it('throws 404 when manifiesto is not found', async () => {
      const { req, res, next } = createMocks();
      req.params = { id: 'nonexistent' };
      mockFindUnique.mockResolvedValue(null);

      await revertirEstado(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 })
      );
    });
  });

  describe('registrarPesaje', () => {
    it('throws 403 when user is not OPERADOR or ADMIN', async () => {
      const { req, res, next } = createMocks({ rol: 'TRANSPORTISTA' });
      req.params = { id: 'man-1' };

      await registrarPesaje(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });
  });

  describe('cancelarManifiesto', () => {
    it('throws 404 when manifiesto is not found', async () => {
      const { req, res, next } = createMocks();
      req.params = { id: 'nonexistent' };
      mockFindUnique.mockResolvedValue(null);

      await cancelarManifiesto(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 })
      );
    });

    it('throws 400 when manifiesto is already CANCELADO', async () => {
      const { req, res, next } = createMocks();
      req.params = { id: 'man-1' };
      mockFindUnique.mockResolvedValue({ id: 'man-1', estado: 'CANCELADO', numero: 'MAN-001' });

      await cancelarManifiesto(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, message: expect.stringContaining('cancelado') })
      );
    });
  });
});
