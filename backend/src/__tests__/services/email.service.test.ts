import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  queue: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  query: vi.fn(),
}));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: mocks.sendMail }) } }));
vi.mock('../../lib/prisma', () => ({ default: { emailQueue: mocks.queue, $queryRawUnsafe: mocks.query } }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  vi.stubEnv('DISABLE_EMAILS', 'true');
  vi.stubEnv('EMAIL_DELIVERY_NOT_BEFORE', '');
  mocks.queue.create.mockImplementation(async ({ data }) => ({ id: 'qa-mail', createdAt: new Date(), intentos: 0, maxIntentos: 3, ...data }));
  mocks.queue.count.mockResolvedValue(0);
  mocks.queue.findMany.mockResolvedValue([]);
  mocks.query.mockResolvedValue([]);
  mocks.sendMail.mockResolvedValue({ accepted: ['qa@example.invalid'], rejected: [] });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('mail safety regressions', () => {
  it('records suppressed transactional mail, never ENVIADO or a future retry', async () => {
    const { emailService } = await import('../../services/email.service');
    await emailService.sendCuentaAprobadaEmail('qa@example.invalid', 'Persona QA');
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.queue.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'SUPRIMIDO' }) }));
    expect(mocks.queue.update).not.toHaveBeenCalled();
  });
  it('does not retain disabled alerts as sendable digests', async () => {
    const { emailService } = await import('../../services/email.service');
    await emailService.sendAlertEmail(['qa@example.invalid'], { nombre: 'Alerta QA' }, null, {});
    expect(mocks.queue.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'SUPRIMIDO', digestKey: null }) }));
  });
  it('does not sweep the historical queue merely by disabling the kill switch', async () => {
    vi.stubEnv('DISABLE_EMAILS', 'false');
    const { flushEmailQueue } = await import('../../services/email.service');
    await flushEmailQueue();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.queue.findMany).not.toHaveBeenCalled();
    expect(mocks.queue.updateMany).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
