import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  queue: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  query: vi.fn(),
  manifest: vi.fn(),
}));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: mocks.sendMail }) } }));
vi.mock('../../lib/prisma', () => ({ default: { emailQueue: mocks.queue, $queryRawUnsafe: mocks.query, manifiesto: { findUnique: mocks.manifest } } }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  vi.stubEnv('DISABLE_EMAILS', 'true');
  vi.stubEnv('EMAIL_DELIVERY_NOT_BEFORE', '');
  vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', '');
  mocks.queue.create.mockImplementation(async ({ data }) => ({ id: 'qa-mail', createdAt: new Date(), intentos: 0, maxIntentos: 3, ...data }));
  mocks.queue.count.mockResolvedValue(0);
  mocks.queue.update.mockResolvedValue({});
  mocks.queue.updateMany.mockResolvedValue({ count: 1 });
  mocks.queue.findMany.mockResolvedValue([]);
  mocks.query.mockResolvedValue([]);
  mocks.sendMail.mockResolvedValue({ accepted: ['qa@example.invalid'], rejected: [] });
});

describe('SMTP receipt and retry safety (mock provider only)', () => {
  beforeEach(() => {
    vi.stubEnv('DISABLE_EMAILS', 'false');
    vi.stubEnv('EMAIL_DELIVERY_NOT_BEFORE', new Date(Date.now() - 60000).toISOString());
  });
  it('sends HTML and plain text and marks SMTP accepted only after acceptance', async () => {
    const { emailService } = await import('../../services/email.service');
    await emailService.sendCuentaAprobadaEmail('qa@example.invalid', '<QA>');
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining('&lt;QA&gt;'), text: expect.stringContaining('<QA>') }));
    expect(mocks.queue.update).toHaveBeenCalledWith({ where: { id: 'qa-mail' }, data: expect.objectContaining({ estado: 'ENVIADO', sentAt: expect.any(Date) }) });
  });
  it('does not call a rejected recipient sent', async () => {
    mocks.sendMail.mockResolvedValue({ accepted: [], rejected: ['qa@example.invalid'] });
    const { emailService } = await import('../../services/email.service');
    await emailService.sendCuentaAprobadaEmail('qa@example.invalid', 'QA');
    expect(mocks.queue.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'SUPRIMIDO', error: 'SMTP_REJECTED', nextRetryAt: null }) }));
  });
  it('retries a connection failure, with a future deadline', async () => {
    mocks.sendMail.mockRejectedValue({ code: 'ECONNECTION' });
    const { emailService } = await import('../../services/email.service');
    await emailService.sendCuentaAprobadaEmail('qa@example.invalid', 'QA');
    expect(mocks.queue.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'FALLIDO', intentos: 1, nextRetryAt: expect.any(Date) }) }));
  });
  it('quarantines timeout ambiguity instead of duplicating a possibly accepted message', async () => {
    mocks.sendMail.mockRejectedValue({ code: 'ETIMEDOUT' });
    const { emailService } = await import('../../services/email.service');
    await emailService.sendCuentaAprobadaEmail('qa@example.invalid', 'QA');
    expect(mocks.queue.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'PENDIENTE', error: 'DELIVERY_UNCERTAIN_REVIEW_REQUIRED', nextRetryAt: null }) }));
  });
  it('never schedules a retry when SMTP accepted but receipt persistence fails', async () => {
    mocks.queue.update.mockRejectedValue(new Error('DB unavailable'));
    const { emailService } = await import('../../services/email.service');
    await emailService.sendCuentaAprobadaEmail('qa@example.invalid', 'QA');
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.queue.update).toHaveBeenCalledTimes(1);
    expect(mocks.queue.update.mock.calls[0][0].data.estado).toBe('ENVIADO');
  });
  it('honors the daily limit without contacting SMTP', async () => {
    mocks.queue.count.mockResolvedValue(100);
    const { emailService } = await import('../../services/email.service');
    await emailService.sendCuentaAprobadaEmail('qa@example.invalid', 'QA');
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.queue.update.mock.calls[0][0].data.estado).toBe('SUPRIMIDO');
  });
  it('keeps recovery available when operational notices have exhausted their allowance', async () => {
    mocks.queue.count.mockImplementation(async ({ where }) => where.NOT?.id?.startsWith === 'notification:' ? 0 : 100);
    const { emailService } = await import('../../services/email.service');
    await emailService.sendPasswordResetEmail('qa@example.invalid', 'QA', 'synthetic-token');
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.queue.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ NOT: { id: { startsWith: 'notification:' } } }) }));
  });
  it('does not send a retry already claimed by another worker', async () => {
    mocks.query.mockResolvedValueOnce([{ id: 'qa-mail' }]);
    mocks.queue.findUnique.mockResolvedValue({ id: 'qa-mail', estado: 'FALLIDO', intentos: 1, maxIntentos: 3, createdAt: new Date(), to: 'qa@example.invalid', tipo: 'TRANSACCIONAL' });
    mocks.queue.updateMany.mockResolvedValue({ count: 0 });
    const { flushEmailQueue } = await import('../../services/email.service');
    await flushEmailQueue();
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.queue.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'qa-mail', estado: 'FALLIDO', intentos: 1 }, data: expect.objectContaining({ estado: 'PENDIENTE' }) }));
  });
  it('preserves and excludes an old failed row even if returned by a stale selection', async () => {
    mocks.query.mockResolvedValueOnce([{ id: 'old' }]);
    mocks.queue.findUnique.mockResolvedValue({ id: 'old', estado: 'FALLIDO', intentos: 1, maxIntentos: 3, createdAt: new Date('2020-01-01') });
    const { flushEmailQueue } = await import('../../services/email.service');
    await flushEmailQueue();
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.queue.update).not.toHaveBeenCalled();
    expect(mocks.query.mock.calls[0][1]).toBeInstanceOf(Date);
  });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('mail safety regressions', () => {
  it.each([{ isDemoData: true }, { modo: 'revision' }, { modo: 'prueba' }])('does not enqueue alerts from training context %j', async context => {
    const { emailService } = await import('../../services/email.service');
    await emailService.sendAlertEmail(['qa@example.invalid'], { nombre: 'QA' }, null, context);
    expect(mocks.queue.create).not.toHaveBeenCalled();
  });
  it('checks the persisted manifest training flag before enqueueing', async () => {
    mocks.manifest.mockResolvedValue({ numero: 'DEMO-001', isDemoData: true });
    const { emailService } = await import('../../services/email.service');
    await emailService.sendAlertEmail(['qa@example.invalid'], { nombre: 'QA' }, 'manifest-qa', {});
    expect(mocks.queue.create).not.toHaveBeenCalled();
  });
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
