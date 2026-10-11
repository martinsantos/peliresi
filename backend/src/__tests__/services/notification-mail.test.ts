import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), insert: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { $queryRawUnsafe: mocks.query, emailQueue: { createMany: mocks.insert } } }));
import { notificationMailContent, queueCommittedNotificationEmails, type NoticeForMail } from '../../services/notification-mail.service';
const notice: NoticeForMail = { id: 'qa-notice', tipo: 'SOLICITUD_ENVIADA', datos: JSON.stringify({ solicitudId: 'sol-qa' }), createdAt: new Date(), email: 'qa@example.invalid', activo: true, emailVerified: true, notifEmail: true, rol: 'ADMIN' };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('DISABLE_EMAILS', 'false');
  vi.stubEnv('EMAIL_DELIVERY_NOT_BEFORE', new Date(Date.now() - 60000).toISOString());
  vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'solicitudes,soporte,inspecciones');
  mocks.query.mockResolvedValue([notice]); mocks.insert.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.unstubAllEnvs());
describe('committed notice mail relay', () => {
  it('links a reviewer to the exact application, without embedding applicant free text', () => {
    const mail = notificationMailContent({ ...notice, datos: JSON.stringify({ solicitudId: 'sol-qa', mensaje: 'secreto <img>' }) })!;
    expect(mail.html).toContain('/admin/solicitudes/sol-qa');
    expect(mail.html).not.toContain('secreto');
  });
  it('links a non-admin to their own application, not to administrative routes', () => {
    const mail = notificationMailContent({ ...notice, rol: 'GENERADOR' })!;
    expect(mail.html).toContain('/mi-solicitud'); expect(mail.html).not.toContain('/admin/');
  });
  it.each([
    [{ tipo: 'soporte', ticketId: 'ticket-qa' }, '/soporte/ticket-qa'],
    [{ inspeccionId: 'inspection-qa' }, '/inspecciones/inspection-qa'],
  ])('uses an exact resource action for %j', (data, path) => {
    expect(notificationMailContent({ ...notice, tipo: 'INFO_GENERAL', datos: JSON.stringify(data) })!.html).toContain(path);
  });
  it.each(['not-json', 'null', '{}', '{"interno":true,"solicitudId":"hidden"}'])('does not render unsafe/unknown notice %s', datos => {
    expect(notificationMailContent({ ...notice, datos })).toBeNull();
  });
  it('persists a deterministic ID and unique conflict handling, never sends here', async () => {
    expect(await queueCommittedNotificationEmails()).toBe(1);
    expect(mocks.insert).toHaveBeenCalledWith({ skipDuplicates: true, data: [expect.objectContaining({ id: 'notification:qa-notice', estado: 'PENDIENTE', error: 'NOTIFICATION_READY', to: 'qa@example.invalid' })] });
    expect(mocks.query.mock.calls[0][0]).toContain('LEFT JOIN email_queue');
    expect(mocks.query.mock.calls[0][1]).toBeInstanceOf(Date);
  });
  it.each(['activo', 'emailVerified', 'notifEmail'] as const)('suppresses recipients without %s', async field => {
    mocks.query.mockResolvedValue([{ ...notice, [field]: false }]);
    await queueCommittedNotificationEmails();
    expect(mocks.insert.mock.calls[0][0].data[0]).toMatchObject({ estado: 'SUPRIMIDO', error: 'RECIPIENT_NOT_ELIGIBLE' });
  });
  it.each(['disabled', 'no-family', 'no-cutoff'])('does no work with %s', async scenario => {
    if (scenario === 'disabled') vi.stubEnv('DISABLE_EMAILS', 'true');
    if (scenario === 'no-family') vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', '');
    if (scenario === 'no-cutoff') vi.stubEnv('EMAIL_DELIVERY_NOT_BEFORE', '');
    expect(await queueCommittedNotificationEmails()).toBe(0);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
