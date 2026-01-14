/**
 * Unit tests for ReversionService
 * Tests the state reversion logic for manifiestos
 */

import { reversionService } from '../../src/services/reversion.service';
import prisma from '../../src/lib/prisma';
import { notificationService } from '../../src/services/notification.service';
import { loggerService } from '../../src/services/logger.service';

// Mock dependencies
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    manifiesto: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    usuario: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    reversionEstado: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    eventoManifiesto: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../src/services/notification.service', () => ({
  notificationService: {
    crearNotificacion: jest.fn(),
  },
}));

jest.mock('../../src/services/logger.service', () => ({
  loggerService: {
    registrar: jest.fn(),
  },
}));

describe('ReversionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verificarReversionPermitida', () => {
    it('should allow ADMIN to revert any non-CANCELADO state', async () => {
      const mockManifiesto = {
        id: 'test-id',
        numero: 'MAN-001',
        estado: 'ENTREGADO',
        generador: { usuarioId: 'gen-user', razonSocial: 'Gen Test' },
        transportista: { usuarioId: 'trans-user', razonSocial: 'Trans Test' },
        operador: { usuarioId: 'op-user', razonSocial: 'Op Test' },
      };

      const mockUsuario = { id: 'admin-user', rol: 'ADMIN' };

      (prisma.manifiesto.findUnique as jest.Mock).mockResolvedValue(mockManifiesto);
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(mockUsuario);
      (prisma.usuario.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callbacks) => {
        const results = [];
        for (const cb of callbacks) {
          results.push(await cb);
        }
        return results;
      });
      (prisma.reversionEstado.create as jest.Mock).mockResolvedValue({ id: 'rev-1' });
      (prisma.manifiesto.update as jest.Mock).mockResolvedValue({ ...mockManifiesto, estado: 'EN_TRANSITO' });

      const result = await reversionService.revertirEstadoAdmin(
        'test-id',
        'EN_TRANSITO',
        'Motivo de prueba con mas de 20 caracteres',
        'admin-user'
      );

      expect(result).toBeDefined();
    });

    it('should throw error for motivo less than 20 characters', async () => {
      await expect(
        reversionService.revertirEstado({
          manifiestoId: 'test-id',
          estadoNuevo: 'EN_TRANSITO',
          motivo: 'Corto',
          tipoReversion: 'CORRECCION_ADMIN',
          usuarioId: 'admin-user',
          rolUsuario: 'ADMIN',
        })
      ).rejects.toThrow('El motivo de la reversión debe tener al menos 20 caracteres');
    });

    it('should throw error when manifiesto not found', async () => {
      (prisma.manifiesto.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        reversionService.revertirEstado({
          manifiestoId: 'non-existent',
          estadoNuevo: 'EN_TRANSITO',
          motivo: 'Motivo de prueba con mas de 20 caracteres',
          tipoReversion: 'CORRECCION_ADMIN',
          usuarioId: 'admin-user',
          rolUsuario: 'ADMIN',
        })
      ).rejects.toThrow('Manifiesto no encontrado');
    });
  });

  describe('revertirEntregaTransportista', () => {
    it('should revert ENTREGADO to EN_TRANSITO for transportista', async () => {
      const mockManifiesto = {
        id: 'test-id',
        numero: 'MAN-001',
        estado: 'ENTREGADO',
        transportista: { usuarioId: 'trans-user' },
        generador: { usuarioId: 'gen-user', razonSocial: 'Gen Test' },
        operador: { usuarioId: 'op-user', razonSocial: 'Op Test' },
      };

      const mockUsuario = { id: 'trans-user', rol: 'TRANSPORTISTA' };

      (prisma.manifiesto.findUnique as jest.Mock).mockResolvedValue(mockManifiesto);
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(mockUsuario);
      (prisma.usuario.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callbacks) => {
        const results = [];
        for (const cb of callbacks) {
          results.push(await cb);
        }
        return results;
      });
      (prisma.reversionEstado.create as jest.Mock).mockResolvedValue({ id: 'rev-1' });
      (prisma.manifiesto.update as jest.Mock).mockResolvedValue({ ...mockManifiesto, estado: 'EN_TRANSITO' });

      const result = await reversionService.revertirEntregaTransportista(
        'test-id',
        'El operador rechazó la entrega porque el material no coincide',
        'trans-user'
      );

      expect(result).toBeDefined();
    });

    it('should throw error if manifiesto is not in ENTREGADO state', async () => {
      const mockManifiesto = {
        id: 'test-id',
        estado: 'EN_TRANSITO',
        transportista: { usuarioId: 'trans-user' },
      };

      const mockUsuario = { id: 'trans-user', rol: 'TRANSPORTISTA' };

      (prisma.manifiesto.findUnique as jest.Mock).mockResolvedValue(mockManifiesto);
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(mockUsuario);

      await expect(
        reversionService.revertirEntregaTransportista(
          'test-id',
          'Motivo de prueba con mas de 20 caracteres',
          'trans-user'
        )
      ).rejects.toThrow('Solo se pueden revertir manifiestos en estado ENTREGADO');
    });
  });

  describe('rechazarRecepcionOperador', () => {
    it('should revert RECIBIDO to ENTREGADO for operador', async () => {
      const mockManifiesto = {
        id: 'test-id',
        numero: 'MAN-001',
        estado: 'RECIBIDO',
        operador: { usuarioId: 'op-user' },
        generador: { usuarioId: 'gen-user', razonSocial: 'Gen Test' },
        transportista: { usuarioId: 'trans-user', razonSocial: 'Trans Test' },
      };

      const mockUsuario = { id: 'op-user', rol: 'OPERADOR' };

      (prisma.manifiesto.findUnique as jest.Mock).mockResolvedValue(mockManifiesto);
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(mockUsuario);
      (prisma.usuario.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callbacks) => {
        const results = [];
        for (const cb of callbacks) {
          results.push(await cb);
        }
        return results;
      });
      (prisma.reversionEstado.create as jest.Mock).mockResolvedValue({ id: 'rev-1' });
      (prisma.manifiesto.update as jest.Mock).mockResolvedValue({ ...mockManifiesto, estado: 'ENTREGADO' });

      const result = await reversionService.rechazarRecepcionOperador(
        'test-id',
        'Error en la recepción, cantidad incorrecta documentada',
        'op-user'
      );

      expect(result).toBeDefined();
    });
  });

  describe('getHistorialReversiones', () => {
    it('should return reversion history for a manifiesto', async () => {
      const mockReversiones = [
        {
          id: 'rev-1',
          manifiestoId: 'test-id',
          estadoAnterior: 'ENTREGADO',
          estadoNuevo: 'EN_TRANSITO',
          motivo: 'Rechazo de entrega',
          tipoReversion: 'RECHAZO_ENTREGA',
          createdAt: new Date(),
          usuario: { id: 'user-1', nombre: 'Juan', apellido: 'Perez', email: 'juan@test.com', rol: 'TRANSPORTISTA' },
        },
      ];

      (prisma.reversionEstado.findMany as jest.Mock).mockResolvedValue(mockReversiones);

      const result = await reversionService.getHistorialReversiones('test-id');

      expect(result).toEqual(mockReversiones);
      expect(prisma.reversionEstado.findMany).toHaveBeenCalledWith({
        where: { manifiestoId: 'test-id' },
        orderBy: { createdAt: 'desc' },
        include: {
          usuario: {
            select: { id: true, nombre: true, apellido: true, email: true, rol: true },
          },
        },
      });
    });
  });

  describe('verificarReversionesFrecuentes', () => {
    it('should return true if user has 3+ reversions in 24h', async () => {
      const mockReversiones = [
        { id: 'rev-1', createdAt: new Date() },
        { id: 'rev-2', createdAt: new Date() },
        { id: 'rev-3', createdAt: new Date() },
      ];

      (prisma.reversionEstado.findMany as jest.Mock).mockResolvedValue(mockReversiones);

      const result = await reversionService.verificarReversionesFrecuentes('user-1');

      expect(result).toBe(true);
    });

    it('should return false if user has less than 3 reversions in 24h', async () => {
      const mockReversiones = [
        { id: 'rev-1', createdAt: new Date() },
        { id: 'rev-2', createdAt: new Date() },
      ];

      (prisma.reversionEstado.findMany as jest.Mock).mockResolvedValue(mockReversiones);

      const result = await reversionService.verificarReversionesFrecuentes('user-1');

      expect(result).toBe(false);
    });
  });
});
