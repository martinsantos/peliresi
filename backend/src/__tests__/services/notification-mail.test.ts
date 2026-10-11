import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), insert: vi.fn(), inspection: vi.fn(), notice: vi.fn(), application: vi.fn(), document: vi.fn(), manifest: vi.fn(), alert: vi.fn(), renewal: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { $queryRawUnsafe: mocks.query, emailQueue: { createMany: mocks.insert }, inspeccion: { findUnique: mocks.inspection }, notificacion: { findUnique: mocks.notice }, solicitudInscripcion: { findFirst: mocks.application }, documento: { findUnique: mocks.document }, manifiesto: { findUnique: mocks.manifest }, alertaGenerada: { findUnique: mocks.alert }, renovacion: { findUnique: mocks.renewal } } }));
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
  it.each([
    ['MODIFICACION_SOLICITADA', 'ADMIN_GENERADOR', 'PENDIENTE', 'other', true],
    ['MODIFICACION_SOLICITADA', 'ADMIN_OPERADOR', 'PENDIENTE', 'other', false],
    ['MODIFICACION_SOLICITADA', 'ADMIN', 'APROBADA', 'other', false],
    ['MODIFICACION_APROBADA', 'GENERADOR', 'APROBADA', 'owner', true],
    ['MODIFICACION_RECHAZADA', 'GENERADOR', 'RECHAZADA', 'owner', true],
    ['MODIFICACION_APROBADA', 'GENERADOR', 'APROBADA', 'reassigned', false],
    ['MODIFICACION_RECHAZADA', 'GENERADOR', 'PENDIENTE', 'owner', false],
  ])('renewal %s revalidates %s / %s / %s', async (tipo, rol, estado, owner, expected) => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'padron');
    const renewalNotice = { ...notice, tipo, rol, usuarioId: 'owner', datos: '{"renovacionId":"renewal"}' };
    mocks.notice.mockResolvedValue({ ...renewalNotice, usuario: renewalNotice });
    mocks.renewal.mockResolvedValue({ tipoActor: 'GENERADOR', estado, generador: { usuarioId: owner } });
    expect(await queuedNoticeStillEligible('notification:qa-notice', notice.email)).toBe(expected);
  });
  it('a rejection notice requires the own rejected result, not an old observation', async () => {
    const rejected = { ...notice, tipo: 'SOLICITUD_RECHAZADA', activo: false, rol: 'GENERADOR', usuarioId: 'applicant', motivoInactividad: 'PENDIENTE_APROBACION' };
    mocks.query.mockResolvedValue([rejected]); mocks.application.mockResolvedValue({ id: 'sol-qa' });
    await queueCommittedNotificationEmails();
    expect(mocks.application).toHaveBeenCalledWith({ where: { id: 'sol-qa', usuarioId: 'applicant', estado: { in: ['RECHAZADA'] } }, select: { id: true } });
    expect(mocks.insert.mock.calls[0][0].data[0].estado).toBe('PENDIENTE');
  });
  const certificate = { ...notice, tipo: 'INFO_GENERAL', usuarioId: 'owner', rol: 'GENERADOR', datos: JSON.stringify({ tipo: 'certificado_ambiental', documentoId: 'doc', actorTipo: 'generador', actorId: 'actor' }) };
  const document = { tipo: 'CERTIFICADO_AMBIENTAL', estado: 'APROBADO', generadorId: 'actor', generador: { usuarioId: 'owner' }, operador: null, transportista: null };
  it('queues the official certificate once and points to the owner-readable record', async () => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'certificados');
    mocks.query.mockResolvedValue([certificate]); mocks.document.mockResolvedValue(document);
    await queueCommittedNotificationEmails();
    expect(mocks.insert.mock.calls[0][0].data[0]).toMatchObject({ estado: 'PENDIENTE', id: 'notification:qa-notice' });
    expect(notificationMailContent(certificate)?.html).toContain('/mi-perfil');
    expect(notificationMailContent(certificate)?.html).not.toContain('/api/');
  });
  it.each([null, { ...document, estado: 'RECHAZADO' }, { ...document, tipo: 'COMPROBANTE_PAGO' },
    { ...document, generadorId: 'other' }, { ...document, generador: { usuarioId: 'other' } },
    { ...document, operador: { usuarioId: 'owner' } },
  ])('suppresses a missing, revoked, unrelated or ambiguous certificate: %j', async current => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'certificados');
    mocks.document.mockResolvedValue(current); mocks.query.mockResolvedValue([certificate]);
    await queueCommittedNotificationEmails();
    expect(mocks.insert.mock.calls[0][0].data[0].estado).toBe('SUPRIMIDO');
    mocks.notice.mockResolvedValue({ ...certificate, usuario: certificate });
    expect(await queuedNoticeStillEligible('notification:qa-notice', certificate.email)).toBe(false);
  });
  const manifestNotice = { ...notice, tipo: 'MANIFIESTO_FIRMADO', manifiestoId: 'manifest', usuarioId: 'owner', rol: 'TRANSPORTISTA', datos: null };
  it.each(['MANIFIESTO_FIRMADO', 'MANIFIESTO_EN_TRANSITO', 'MANIFIESTO_ENTREGADO', 'MANIFIESTO_RECIBIDO', 'MANIFIESTO_TRATADO', 'MANIFIESTO_RECHAZADO'])('routes %s to the actual manifest, without copying free text', tipo => {
    expect(notificationMailContent({ ...manifestNotice, tipo })?.html).toContain('/manifiestos/manifest');
    expect(notificationMailContent({ ...manifestNotice, tipo, manifiestoId: null })).toBeNull();
  });
  it.each([null, { isDemoData: true }, { isDemoData: false, transportista: { usuarioId: 'reassigned' } }])('suppresses deleted, synthetic or reassigned manifest %j', async current => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'manifiestos');
    mocks.manifest.mockResolvedValue(current); mocks.notice.mockResolvedValue({ ...manifestNotice, usuario: manifestNotice });
    expect(await queuedNoticeStillEligible('notification:qa-notice', manifestNotice.email)).toBe(false);
  });
  it.each([{ rol: 'TRANSPORTISTA' }, { rol: 'ADMIN_OPERADOR' }, { rol: 'GENERADOR', esInspector: true }])('rechecks legitimate manifest participant or staff %j', async user => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'manifiestos');
    mocks.manifest.mockResolvedValue({ isDemoData: false, transportista: { usuarioId: 'owner' } });
    mocks.notice.mockResolvedValue({ ...manifestNotice, usuario: { ...manifestNotice, ...user } });
    expect(await queuedNoticeStillEligible('notification:qa-notice', manifestNotice.email)).toBe(true);
  });
  it.each([null, { estado: 'RESUELTA', regla: { activa: true } }, { estado: 'PENDIENTE', regla: { activa: false } }])('does not mail a resolved or disabled catalogue case %j', async current => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'alertas');
    mocks.alert.mockResolvedValue(current);
    const alert = { ...notice, tipo: 'INFO_GENERAL', datos: JSON.stringify({ familia: 'catalogo_verificable', casoId: 'case', inspeccionId: 'inspection' }) };
    mocks.notice.mockResolvedValue({ ...alert, usuario: alert });
    expect(notificationMailContent(alert)?.family).toBe('alertas');
    expect(await queuedNoticeStillEligible('notification:qa-notice', alert.email)).toBe(false);
  });
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
