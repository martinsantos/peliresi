import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock data
const mockRazonSocialGen = 'Generador SA';
const mockRazonSocialTrans = 'Transportista SA';
const mockRazonSocialOper = 'Operador SA';

const { mockFindMany, mockFindUnique, mockCreate, mockCreateMany } = vi.hoisted(() => {
  return {
    mockFindMany: vi.fn().mockResolvedValue([]),
    mockFindUnique: vi.fn().mockResolvedValue(null),
    mockCreate: vi.fn().mockResolvedValue({ id: 'notif-1' }),
    mockCreateMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
});

vi.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    notificacion: {
      create: mockCreate,
      createMany: mockCreateMany,
    },
    usuario: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
    },
    manifiesto: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Mock email service
vi.mock('../../services/email.service', () => ({
  emailService: {
    sendAlertEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock push service
vi.mock('../../services/push.service', () => ({
  enviarPushAlUsuario: vi.fn().mockResolvedValue(undefined),
}));

import { notificationService } from '../../services/notification-dispatcher.service';

describe('NotificationDispatcherService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default resolved values
    mockFindMany.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 'notif-1' });
    mockCreateMany.mockResolvedValue({ count: 0 });
  });

  it('should be importable', () => {
    expect(notificationService).toBeDefined();
  });

  it('crearNotificacion is a function', () => {
    expect(typeof notificationService.crearNotificacion).toBe('function');
  });

  it('notificarPorRol is a function', () => {
    expect(typeof notificationService.notificarPorRol).toBe('function');
  });

  it('notificarCambioEstado is a function', () => {
    expect(typeof notificationService.notificarCambioEstado).toBe('function');
  });

  describe('crearNotificacion', () => {
    it('creates a notification in the database', async () => {
      mockCreate.mockResolvedValue({
        id: 'notif-123',
        usuarioId: 'user-1',
        tipo: 'INFO_GENERAL',
        titulo: 'Test Notification',
        mensaje: 'Test message',
        prioridad: 'NORMAL',
      });

      const result = await notificationService.crearNotificacion({
        usuarioId: 'user-1',
        tipo: 'INFO_GENERAL',
        titulo: 'Test Notification',
        mensaje: 'Test message',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            usuarioId: 'user-1',
            tipo: 'INFO_GENERAL',
            titulo: 'Test Notification',
            mensaje: 'Test message',
          }),
        })
      );
      expect(result).toBeDefined();
    });

    it('includes manifiestoId when provided', async () => {
      mockCreate.mockResolvedValue({ id: 'notif-2', manifiestoId: 'man-1' });

      await notificationService.crearNotificacion({
        usuarioId: 'user-1',
        tipo: 'MANIFIESTO_FIRMADO',
        titulo: 'Manifiesto firmado',
        mensaje: 'MAN-001 firmado',
        manifiestoId: 'man-1',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            manifiestoId: 'man-1',
          }),
        })
      );
    });

    it('uses NORMAL as default prioridad', async () => {
      mockCreate.mockResolvedValue({ id: 'notif-3' });

      await notificationService.crearNotificacion({
        usuarioId: 'user-1',
        tipo: 'INFO_GENERAL',
        titulo: 'Test',
        mensaje: 'Test',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            prioridad: 'NORMAL',
          }),
        })
      );
    });
  });

  describe('notificarPorRol', () => {
    it('finds users by role and creates notifications', async () => {
      mockFindMany.mockResolvedValue([
        { id: 'admin-1' },
        { id: 'admin-2' },
      ]);
      mockCreateMany.mockResolvedValue({ count: 2 });

      await notificationService.notificarPorRol('ADMIN', {
        tipo: 'INFO_GENERAL',
        titulo: 'System Alert',
        mensaje: 'Something happened',
      });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { rol: 'ADMIN', activo: true },
        select: { id: true },
      });
      expect(mockCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ usuarioId: 'admin-1' }),
            expect.objectContaining({ usuarioId: 'admin-2' }),
          ]),
        })
      );
    });

    it('creates no user notifications when no users found for role', async () => {
      mockFindMany.mockResolvedValue([]);

      await notificationService.notificarPorRol('OPERADOR', {
        tipo: 'INFO_GENERAL',
        titulo: 'Test',
        mensaje: 'Test',
      });

      // The service always calls createMany, even with empty data array
      expect(mockCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: [] })
      );
    });
  });

  describe('notificarCambioEstado', () => {
    const baseManifiesto = {
      id: 'man-1',
      numero: 'MAN-001',
      estado: 'APROBADO',
      modalidad: 'CON_TRANSPORTE',
      fechaFirma: new Date('2025-06-01'),
      fechaEstimadaRetiro: new Date('2025-06-02'),
      fechaRetiro: null,
      fechaEntrega: null,
      fechaRecepcion: null,
      fechaCierre: null,
      observaciones: null,
      tratamientoMetodo: null,
      tratamientoAutorizadoId: null,
      generador: {
        id: 'gen-1',
        razonSocial: mockRazonSocialGen,
        cuit: '30-12345678-9',
        domicilio: 'Av. Siempre Viva 123',
        latitud: -32.89,
        longitud: -68.84,
        usuario: { id: 'user-gen' },
      },
      transportista: {
        id: 'trans-1',
        razonSocial: mockRazonSocialTrans,
        cuit: '30-87654321-0',
        usuario: { id: 'user-trans' },
      },
      operador: {
        id: 'oper-1',
        razonSocial: mockRazonSocialOper,
        cuit: '30-11223344-5',
        usuario: { id: 'user-oper' },
      },
    };

    it('handles manifiesto not found gracefully', async () => {
      mockFindUnique.mockResolvedValue(null);

      // Should not throw
      await expect(
        notificationService.notificarCambioEstado('nonexistent', 'APROBADO')
      ).resolves.toBeUndefined();
    });
  });
});
