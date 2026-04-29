import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate, mockFindUnique, mockFindMany, mockCount, mockQueryRawUnsafe, mockUpdateMany, mockUpdate } = vi.hoisted(() => {
  return {
    mockCreate: vi.fn().mockResolvedValue({ id: 'email-1' }),
    mockFindUnique: vi.fn().mockResolvedValue(null),
    mockFindMany: vi.fn().mockResolvedValue([]),
    mockCount: vi.fn().mockResolvedValue(0),
    mockQueryRawUnsafe: vi.fn().mockResolvedValue([]),
    mockUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
    mockUpdate: vi.fn().mockResolvedValue({}),
  };
});

vi.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    emailQueue: {
      create: mockCreate,
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      count: mockCount,
      updateMany: mockUpdateMany,
      update: mockUpdate,
    },
    manifiesto: {
      findUnique: mockFindUnique,
    },
    $queryRawUnsafe: mockQueryRawUnsafe,
  },
}));

vi.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
    }),
  },
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));

import { emailService, flushEmailQueue, startEmailFlushTimer, stopEmailFlushTimer } from '../../services/email.service';

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'email-1' });
    mockFindUnique.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    mockQueryRawUnsafe.mockResolvedValue([]);
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockUpdate.mockResolvedValue({});
  });

  it('should be importable', () => {
    expect(emailService).toBeDefined();
  });

  it('sendAlertEmail is a function', () => {
    expect(typeof emailService.sendAlertEmail).toBe('function');
  });

  it('sendEmailVerification is a function', () => {
    expect(typeof emailService.sendEmailVerification).toBe('function');
  });

  it('sendCuentaAprobadaEmail is a function', () => {
    expect(typeof emailService.sendCuentaAprobadaEmail).toBe('function');
  });

  it('sendPasswordResetEmail is a function', () => {
    expect(typeof emailService.sendPasswordResetEmail).toBe('function');
  });

  it('sendRegistroPendienteEmail is a function', () => {
    expect(typeof emailService.sendRegistroPendienteEmail).toBe('function');
  });

  it('sendNuevoRegistroAdminEmail is a function', () => {
    expect(typeof emailService.sendNuevoRegistroAdminEmail).toBe('function');
  });

  it('sendSolicitudEnviadaAdmin is a function', () => {
    expect(typeof emailService.sendSolicitudEnviadaAdmin).toBe('function');
  });

  it('sendSolicitudObservadaEmail is a function', () => {
    expect(typeof emailService.sendSolicitudObservadaEmail).toBe('function');
  });

  it('sendRespuestaCandidatoAdmin is a function', () => {
    expect(typeof emailService.sendRespuestaCandidatoAdmin).toBe('function');
  });

  it('sendSolicitudRechazadaEmail is a function', () => {
    expect(typeof emailService.sendSolicitudRechazadaEmail).toBe('function');
  });

  it('sendModificacionSolicitadaAdmin is a function', () => {
    expect(typeof emailService.sendModificacionSolicitadaAdmin).toBe('function');
  });

  it('sendModificacionAprobadaEmail is a function', () => {
    expect(typeof emailService.sendModificacionAprobadaEmail).toBe('function');
  });

  it('sendModificacionRechazadaEmail is a function', () => {
    expect(typeof emailService.sendModificacionRechazadaEmail).toBe('function');
  });

  describe('sendAlertEmail', () => {
    it('returns early when emails array is empty', async () => {
      await emailService.sendAlertEmail([], { nombre: 'Test' }, null, {});
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('enqueues an alert email', async () => {
      mockFindUnique.mockResolvedValue(null); // no manifiesto lookup needed

      await emailService.sendAlertEmail(
        ['user@test.com'],
        { nombre: 'Regla de Alerta', descripcion: 'Alerta activada' },
        null,
        { mensaje: 'Test alert' }
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            to: 'user@test.com',
            tipo: 'ALERTA',
            prioridad: 'BAJA',
            estado: 'DIGEST_PENDIENTE',
          }),
        })
      );
    });
  });

  describe('sendEmailVerification', () => {
    it('enqueues a transactional email with verification link', async () => {
      mockCount.mockResolvedValue(0); // under daily limit

      await emailService.sendEmailVerification('user@test.com', 'Test User', 'token-123');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            to: 'user@test.com',
            tipo: 'TRANSACCIONAL',
            prioridad: 'CRITICA',
            estado: 'PENDIENTE',
          }),
        })
      );
    });
  });

  describe('sendCuentaAprobadaEmail', () => {
    it('enqueues a transactional approval email', async () => {
      mockCount.mockResolvedValue(0);

      await emailService.sendCuentaAprobadaEmail('user@test.com', 'Test User');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            to: 'user@test.com',
            tipo: 'TRANSACCIONAL',
          }),
        })
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('enqueues a transactional password reset email', async () => {
      mockCount.mockResolvedValue(0);

      await emailService.sendPasswordResetEmail('user@test.com', 'Test User', 'reset-token');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            to: 'user@test.com',
            prioridad: 'CRITICA',
          }),
        })
      );
    });
  });

  describe('flushEmailQueue', () => {
    it('is a function and runs without error', async () => {
      await expect(flushEmailQueue()).resolves.toBeUndefined();
    });

    it('processes failed transactional emails if any', async () => {
      mockQueryRawUnsafe.mockResolvedValue([{ id: 'email-failed-1' }]);
      mockFindUnique.mockResolvedValue({
        id: 'email-failed-1',
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>Test</p>',
        tipo: 'TRANSACCIONAL',
        intentos: 1,
        maxIntentos: 3,
      });

      await expect(flushEmailQueue()).resolves.toBeUndefined();
    });
  });

  describe('startEmailFlushTimer / stopEmailFlushTimer', () => {
    it('startEmailFlushTimer is a function', () => {
      expect(typeof startEmailFlushTimer).toBe('function');
    });

    it('stopEmailFlushTimer is a function', () => {
      expect(typeof stopEmailFlushTimer).toBe('function');
    });
  });
});
