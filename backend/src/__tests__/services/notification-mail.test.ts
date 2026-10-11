import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), insert: vi.fn(), inspection: vi.fn(), notice: vi.fn(), application: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { $queryRawUnsafe: mocks.query, emailQueue: { createMany: mocks.insert }, inspeccion: { findUnique: mocks.inspection }, notificacion: { findUnique: mocks.notice }, solicitudInscripcion: { findFirst: mocks.application } } }));
import { notificationMailContent, queueCommittedNotificationEmails, queuedNoticeStillEligible, type NoticeForMail } from '../../services/notification-mail.service';
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
  it('queues a verified pending applicant only for their own open application', async () => {
    const pending = { ...notice, activo: false, rol: 'GENERADOR', usuarioId: 'applicant', motivoInactividad: 'PENDIENTE_APROBACION' };
    mocks.query.mockResolvedValue([pending]); mocks.application.mockResolvedValue({ id: 'sol-qa' });
    await queueCommittedNotificationEmails();
    expect(mocks.insert.mock.calls[0][0].data[0].estado).toBe('PENDIENTE');
    expect(mocks.application).toHaveBeenCalledWith({ where: { id: 'sol-qa', usuarioId: 'applicant', estado: { in: ['BORRADOR', 'ENVIADA', 'EN_REVISION', 'OBSERVADA'] } }, select: { id: true } });
    mocks.notice.mockResolvedValue({ ...pending, usuario: pending });
    expect(await queuedNoticeStillEligible('notification:qa-notice', pending.email)).toBe(true);
  });
  it.each([
    { motivoInactividad: 'SUSPENDIDA' }, { motivoInactividad: null }, { emailVerified: false },
    { notifEmail: false }, { tipo: 'INFO_GENERAL', datos: '{"tipo":"soporte","ticketId":"qa"}' },
  ])('never treats this inactive recipient as an approved applicant: %j', async changes => {
    const pending = { ...notice, activo: false, usuarioId: 'applicant', motivoInactividad: 'PENDIENTE_APROBACION', ...changes };
    mocks.query.mockResolvedValue([pending]); mocks.application.mockResolvedValue({ id: 'sol-qa' });
    await queueCommittedNotificationEmails();
    expect(mocks.insert.mock.calls[0][0].data[0].estado).toBe('SUPRIMIDO');
    mocks.notice.mockResolvedValue({ ...pending, usuario: pending });
    expect(await queuedNoticeStillEligible('notification:qa-notice', pending.email)).toBe(false);
  });
  it('suppresses a pending applicant if the application closed, disappeared or belongs to someone else', async () => {
    const pending = { ...notice, activo: false, usuarioId: 'applicant', motivoInactividad: 'PENDIENTE_APROBACION' };
    mocks.query.mockResolvedValue([pending]); mocks.application.mockResolvedValue(null);
    await queueCommittedNotificationEmails();
    expect(mocks.insert.mock.calls[0][0].data[0].estado).toBe('SUPRIMIDO');
    mocks.notice.mockResolvedValue({ ...pending, usuario: pending });
    expect(await queuedNoticeStillEligible('notification:qa-notice', pending.email)).toBe(false);
  });
  it('rechecks the current recipient before sending an eligible queued notice', async () => {
    mocks.notice.mockResolvedValue({ ...notice, usuario: notice });
    expect(await queuedNoticeStillEligible('notification:qa-notice', notice.email)).toBe(true);
    expect(mocks.notice).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'qa-notice' } }));
  });
  it.each([{ activo: false }, { emailVerified: false }, { notifEmail: false }, { email: 'changed@example.invalid' }])('does not send after recipient changed: %j', async changes => {
    mocks.notice.mockResolvedValue({ ...notice, usuario: { ...notice, ...changes } });
    expect(await queuedNoticeStillEligible('notification:qa-notice', notice.email)).toBe(false);
  });
  it('does not reinterpret account-verification or reset mail as optional notifications', async () => {
    expect(await queuedNoticeStillEligible('ordinary-transactional', notice.email)).toBe(true);
    expect(mocks.notice).not.toHaveBeenCalled();
  });
  it('suppresses deleted notices and a family disabled since enqueue', async () => {
    mocks.notice.mockResolvedValue(null);
    expect(await queuedNoticeStillEligible('notification:qa-notice', notice.email)).toBe(false);
    mocks.notice.mockResolvedValue({ ...notice, usuario: notice });
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'soporte');
    expect(await queuedNoticeStillEligible('notification:qa-notice', notice.email)).toBe(false);
  });
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
  it.each([{ isDemoData: true }, { modo: 'revision' }, { modo: 'prueba' }])('excludes training context %j', context => {
    expect(notificationMailContent({ ...notice, datos: JSON.stringify({ solicitudId: 'qa', ...context }) })).toBeNull();
  });
  it.each([null, { numeroActa: 'ARP-DEMO-099' }, { numeroActa: 'DEMO/099' }])('does not mail training or missing inspection %j', async inspection => {
    mocks.query.mockResolvedValue([{ ...notice, tipo: 'INFO_GENERAL', datos: JSON.stringify({ inspeccionId: 'qa' }) }]);
    mocks.inspection.mockResolvedValue(inspection);
    await queueCommittedNotificationEmails();
    expect(mocks.insert.mock.calls[0][0].data[0]).toMatchObject({ estado: 'SUPRIMIDO', error: 'TRAINING_OR_MISSING_RESOURCE' });
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
