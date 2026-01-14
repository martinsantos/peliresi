/**
 * Unit tests for Admin Sectorial Controller
 * Tests dashboard and management functions for sectorial admins
 */

import { Request, Response } from 'express';
import prisma from '../../src/lib/prisma';

// Mock prisma
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    transportista: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    operador: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    generador: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    vehiculo: { count: jest.fn() },
    chofer: { count: jest.fn() },
    tratamientoAutorizado: { count: jest.fn() },
    manifiesto: { count: jest.fn() },
    usuario: { update: jest.fn() },
    logActividad: { create: jest.fn() },
  },
}));

// Import controller after mocking
import {
  getDashboardTransportistas,
  getTransportistas,
  getDashboardOperadores,
  getOperadores,
  getDashboardGeneradores,
  getGeneradores,
} from '../../src/controllers/admin-sectorial.controller';

describe('Admin Sectorial Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();
    mockRes = {
      json: jsonMock,
      status: statusMock,
    };
    mockReq = {
      user: { id: 'admin-1', rol: 'ADMIN_TRANSPORTISTAS' },
      query: {},
      params: {},
    };
    jest.clearAllMocks();
  });

  describe('getDashboardTransportistas', () => {
    it('should return transportistas dashboard stats', async () => {
      (prisma.transportista.count as jest.Mock)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8);  // activos
      (prisma.vehiculo.count as jest.Mock).mockResolvedValue(25);
      (prisma.chofer.count as jest.Mock).mockResolvedValue(15);
      (prisma.manifiesto.count as jest.Mock)
        .mockResolvedValueOnce(5)  // en transito
        .mockResolvedValueOnce(20); // entregados

      await getDashboardTransportistas(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          stats: {
            totalTransportistas: 10,
            transportistasActivos: 8,
            totalVehiculos: 25,
            totalChoferes: 15,
            manifestosEnTransito: 5,
            manifestosEntregados: 20,
          },
        },
      });
    });
  });

  describe('getTransportistas', () => {
    it('should return paginated list of transportistas', async () => {
      const mockTransportistas = [
        {
          id: 't1',
          razonSocial: 'Transporte Test',
          cuit: '20-12345678-9',
          activo: true,
          usuario: { email: 'test@test.com', nombre: 'Test', apellido: 'User', activo: true, aprobado: true },
          vehiculos: [],
          choferes: [],
          _count: { manifiestos: 5 },
        },
      ];

      (prisma.transportista.findMany as jest.Mock).mockResolvedValue(mockTransportistas);
      (prisma.transportista.count as jest.Mock).mockResolvedValue(1);

      mockReq.query = { page: '1', limit: '10' };

      await getTransportistas(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          transportistas: mockTransportistas,
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        },
      });
    });

    it('should filter transportistas by search term', async () => {
      mockReq.query = { busqueda: 'test', page: '1', limit: '10' };

      (prisma.transportista.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transportista.count as jest.Mock).mockResolvedValue(0);

      await getTransportistas(mockReq as Request, mockRes as Response);

      expect(prisma.transportista.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { razonSocial: { contains: 'test', mode: 'insensitive' } },
              { cuit: { contains: 'test' } },
            ]),
          }),
        })
      );
    });
  });

  describe('getDashboardOperadores', () => {
    it('should return operadores dashboard stats', async () => {
      mockReq.user = { id: 'admin-1', rol: 'ADMIN_OPERADORES' };

      (prisma.operador.count as jest.Mock)
        .mockResolvedValueOnce(5)  // total
        .mockResolvedValueOnce(4); // activos
      (prisma.tratamientoAutorizado.count as jest.Mock).mockResolvedValue(12);
      (prisma.manifiesto.count as jest.Mock)
        .mockResolvedValueOnce(8)   // recibidos
        .mockResolvedValueOnce(15); // tratados

      await getDashboardOperadores(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          stats: expect.objectContaining({
            totalOperadores: 5,
            operadoresActivos: 4,
            totalTratamientos: 12,
          }),
        },
      });
    });
  });

  describe('getDashboardGeneradores', () => {
    it('should return generadores dashboard stats', async () => {
      mockReq.user = { id: 'admin-1', rol: 'ADMIN_GENERADORES' };

      (prisma.generador.count as jest.Mock)
        .mockResolvedValueOnce(20)  // total
        .mockResolvedValueOnce(18); // activos
      (prisma.manifiesto.count as jest.Mock)
        .mockResolvedValueOnce(3)   // borradores
        .mockResolvedValueOnce(10)  // aprobados
        .mockResolvedValueOnce(5);  // en transito

      await getDashboardGeneradores(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          stats: expect.objectContaining({
            totalGeneradores: 20,
            generadoresActivos: 18,
          }),
        },
      });
    });
  });
});
