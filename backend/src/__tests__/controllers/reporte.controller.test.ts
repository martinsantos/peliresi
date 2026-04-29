import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';

const { mockFindMany, mockCount, mockGroupBy, mockAggregate, mockFindUnique } = vi.hoisted(() => {
  return {
    mockFindMany: vi.fn(),
    mockCount: vi.fn(),
    mockGroupBy: vi.fn(),
    mockAggregate: vi.fn(),
    mockFindUnique: vi.fn(),
  };
});

vi.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    manifiesto: {
      findMany: mockFindMany,
      count: mockCount,
      groupBy: mockGroupBy,
      findUnique: mockFindUnique,
    },
    manifiestoResiduo: {
      aggregate: mockAggregate,
    },
    transportista: {
      findMany: mockFindMany,
      count: mockCount,
    },
    eventoManifiesto: {
      findMany: mockFindMany,
      count: mockCount,
      groupBy: mockGroupBy,
    },
    generador: { findMany: mockFindMany },
    operador: { findMany: mockFindMany },
  },
}));

vi.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  reporteManifiestosPorPeriodo,
  reporteResiduosTratados,
  reporteTransporte,
  getLogAuditoria,
  exportarCSV,
} from '../../controllers/reporte.controller';

function createMocks(userOverrides = {}) {
  const req = {
    params: {},
    query: {},
    user: { id: 'user-1', rol: 'ADMIN', ...userOverrides },
  } as unknown as AuthRequest;
  const res = {
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

const mockManifiestoItem = {
  id: 'man-1',
  numero: 'MAN-001',
  estado: 'APROBADO',
  createdAt: new Date('2025-06-01'),
  fechaFirma: new Date('2025-06-01'),
  fechaRetiro: null,
  fechaEntrega: null,
  fechaRecepcion: null,
  fechaCierre: null,
  generador: { id: 'gen-1', razonSocial: 'Generador SA', cuit: '30-12345678-9' },
  transportista: { id: 'trans-1', razonSocial: 'Transportista SA', cuit: '30-87654321-0' },
  operador: { id: 'oper-1', razonSocial: 'Operador SA', cuit: '30-11223344-5' },
  residuos: [
    { id: 'res-1', cantidad: 100, unidad: 'kg', tipoResiduo: { nombre: 'Aceite usado', codigo: 'Y8' } },
  ],
  eventos: [{ descripcion: 'Tratamiento: incineracion' }],
};

describe('ReporteController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    mockGroupBy.mockResolvedValue([]);
    mockAggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
  });

  describe('exported functions', () => {
    it('reporteManifiestosPorPeriodo is a function', () => { expect(typeof reporteManifiestosPorPeriodo).toBe('function'); });
    it('reporteResiduosTratados is a function', () => { expect(typeof reporteResiduosTratados).toBe('function'); });
    it('reporteTransporte is a function', () => { expect(typeof reporteTransporte).toBe('function'); });
    it('getLogAuditoria is a function', () => { expect(typeof getLogAuditoria).toBe('function'); });
    it('exportarCSV is a function', () => { expect(typeof exportarCSV).toBe('function'); });
  });

  describe('reporteManifiestosPorPeriodo', () => {
    it('returns report with empty data when no manifiestos', async () => {
      const { req, res, next } = createMocks();
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      mockGroupBy.mockResolvedValue([]);
      mockAggregate.mockResolvedValue({ _sum: { cantidad: 0 } });

      await reporteManifiestosPorPeriodo(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            resumen: expect.objectContaining({ totalManifiestos: 0 }),
            manifiestos: [],
          }),
        })
      );
    });

    it('applies query filters', async () => {
      const { req, res, next } = createMocks();
      req.query = { fechaInicio: '2025-01-01', fechaFin: '2025-12-31', estado: 'APROBADO' };

      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      mockGroupBy.mockResolvedValue([]);
      mockAggregate.mockResolvedValue({ _sum: { cantidad: 0 } });

      await reporteManifiestosPorPeriodo(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('reporteResiduosTratados', () => {
    it('returns report for TRATADO manifiestos', async () => {
      const { req, res, next } = createMocks();
      mockFindMany.mockResolvedValue([mockManifiestoItem]);
      mockCount.mockResolvedValue(1);

      await reporteResiduosTratados(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            resumen: expect.objectContaining({ totalManifiestosTratados: 1 }),
          }),
        })
      );
    });
  });

  describe('reporteTransporte', () => {
    it('returns transport report', async () => {
      const { req, res, next } = createMocks();
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await reporteTransporte(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            transportistas: [],
          }),
        })
      );
    });
  });

  describe('getLogAuditoria', () => {
    it('throws 403 when user is not ADMIN', async () => {
      const { req, res, next } = createMocks({ rol: 'GENERADOR' });

      await getLogAuditoria(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it('returns audit log for admin users', async () => {
      const { req, res, next } = createMocks({ rol: 'ADMIN' });
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      mockGroupBy.mockResolvedValue([]);

      await getLogAuditoria(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            eventos: [],
          }),
        })
      );
    });
  });

  describe('exportarCSV', () => {
    it('throws 400 for invalid export type', async () => {
      const { req, res, next } = createMocks();
      req.params = { tipo: 'invalid' };

      await exportarCSV(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });

    it('exports manifiestos CSV', async () => {
      const { req, res, next } = createMocks();
      req.params = { tipo: 'manifiestos' };
      mockFindMany.mockResolvedValue([mockManifiestoItem]);

      await exportarCSV(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('Numero,Estado,Generador')
      );
    });

    it('exports generadores CSV', async () => {
      const { req, res, next } = createMocks();
      req.params = { tipo: 'generadores' };
      mockFindMany.mockResolvedValue([
        {
          razonSocial: 'Generador SA', cuit: '30-12345678-9', domicilio: 'Av. Siempre Viva 123',
          telefono: '123456', email: 'gen@test.com', numeroInscripcion: 'GEN-001',
          categoria: 'A', activo: true, _count: { manifiestos: 10 },
        },
      ]);

      await exportarCSV(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('RazonSocial,CUIT')
      );
    });

    it('exports transportistas CSV', async () => {
      const { req, res, next } = createMocks();
      req.params = { tipo: 'transportistas' };
      mockFindMany.mockResolvedValue([
        {
          razonSocial: 'Transportista SA', cuit: '30-87654321-0', numeroHabilitacion: 'T-001',
          telefono: '654321', email: 'trans@test.com', activo: true,
          _count: { manifiestos: 5, vehiculos: 3, choferes: 2 },
        },
      ]);

      await exportarCSV(req, res, next);

      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('Transportista SA')
      );
    });

    it('exports operadores CSV', async () => {
      const { req, res, next } = createMocks();
      req.params = { tipo: 'operadores' };
      mockFindMany.mockResolvedValue([
        {
          razonSocial: 'Operador SA', cuit: '30-11223344-5', numeroHabilitacion: 'O-001',
          domicilio: 'Planta 1', telefono: '112233', email: 'oper@test.com',
          categoria: 'A', activo: true, _count: { manifiestos: 20 },
        },
      ]);

      await exportarCSV(req, res, next);

      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('Operador SA')
      );
    });
  });
});
