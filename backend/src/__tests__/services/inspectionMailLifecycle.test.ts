import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ inspection: vi.fn(), exchange: vi.fn(), event: vi.fn(), intake: vi.fn(), alert: vi.fn(), notice: vi.fn(), query: vi.fn(), insert: vi.fn(), actor: vi.fn(), alertsMany: vi.fn(), exchangesMany: vi.fn(), usersMany: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  inspeccion: { findUnique: db.inspection }, intercambioInspeccion: { findUnique: db.exchange, findMany: db.exchangesMany },
  eventoInspeccion: { findUnique: db.event }, antecedenteFiscalizacion: { findUnique: db.intake },
  alertaGenerada: { findUnique: db.alert, findMany: db.alertsMany },
  usuario: { findFirst: db.actor, findMany: db.usersMany },
  notificacion: { findUnique: db.notice }, $queryRawUnsafe: db.query, emailQueue: { createMany: db.insert },
} }));
import { notificationMailContent, queuedNoticeStillEligible, queueCommittedNotificationEmails, type NoticeForMail } from '../../services/notification-mail.service';

const inspection = { id: 'case', numero: 'QA-ARTIFICIAL', estado: 'NOTIFICADA', numeroActa: 'QA-ARTIFICIAL', inspectorId: 'inspector', tipoActor: 'GENERADOR', generadorId: 'g-1',
  generador: { usuarioId: 'owner', activo: true }, operador: null, transportista: null };
const metadata = { tipo: 'intercambio_inspeccion', version: 1, correoVersion: 1, inspeccionId: 'case', intercambioId: 'exchange',
  secuencia: 1, evento: 'REQUERIMIENTO', parte: 'AUTORIDAD', destino: 'participacion' };
const base: NoticeForMail = { id: 'notice', tipo: 'INFO_GENERAL', datos: JSON.stringify(metadata), createdAt: new Date(),
  usuarioId: 'owner', rol: 'GENERADOR', email: 'owner@night-qa.invalid', activo: true, emailVerified: true, notifEmail: true };
const exchange = { id: 'exchange', inspeccionId: 'case', secuencia: 1, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', autorId: 'admin' };

beforeEach(() => {
  vi.resetAllMocks();
  // Only the pure queue is enabled in this mocked process. No delivery/provider is imported.
  vi.stubEnv('DISABLE_EMAILS', 'false'); vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'inspecciones');
  vi.stubEnv('ACTOR_MULTIROLE_ENABLED', 'false');
  vi.stubEnv('EMAIL_DELIVERY_NOT_BEFORE', new Date(Date.now() - 60_000).toISOString());
  db.inspection.mockResolvedValue(inspection); db.exchange.mockResolvedValue(exchange);
  db.query.mockResolvedValue([base]); db.insert.mockResolvedValue({ count: 1 });
  db.notice.mockResolvedValue({ ...base, usuario: base });
});

describe('queued PSIP deadline reminders recheck the live requirement', () => {
  const deadline = new Date('2020-01-01T12:00:00Z');
  const facts = { familia: 'catalogo_verificable', version: 1, tipo: 'requerimiento_inspeccion', entidad: 'REQUERIMIENTO',
    entidadId: 'exchange', inspeccionId: 'case', casoId: 'alert', vencimiento: deadline.toISOString(), destino: 'inspeccion', tipoActor: 'GENERADOR', actorId: 'g-1' };
  const pending = { ...exchange, destinatario: 'INSPECCIONADO', plazoRespuestaAt: deadline, respuestas: [], inspeccion: inspection };
  beforeEach(() => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'alertas');
    const notice = { ...base, usuarioId: 'inspector', esInspector: true, datos: JSON.stringify(facts) };
    db.notice.mockResolvedValue({ ...notice, usuario: notice });
    db.alert.mockResolvedValue({ estado: 'PENDIENTE', datos: JSON.stringify(facts), regla: { activa: true } });
    db.alertsMany.mockResolvedValue([{ id: 'alert', estado: 'PENDIENTE', datos: JSON.stringify(facts), regla: { activa: true } }]);
    db.exchange.mockResolvedValue(pending);
    db.exchangesMany.mockResolvedValue([pending]);
    db.usersMany.mockResolvedValue([{ id: 'inspector', rol: 'GENERADOR', esInspector: true }]);
  });
  it('retains the assigned inspector but rejects a replacement before the catalogue runs again', async () => {
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(true);
    db.exchange.mockResolvedValue({ ...pending, inspeccion: { ...inspection, inspectorId: 'replacement' } });
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(false);
  });
  it('rechecks an approved secondary activity before allowing its overdue reminder', async () => {
    vi.stubEnv('ACTOR_MULTIROLE_ENABLED', 'true');
    const data = { ...facts, destino: 'participacion', tipoActor: 'GENERADOR', actorId: 'g-1' };
    const user = { ...base, rol: 'OPERADOR', datos: JSON.stringify(data) };
    const current = { ...inspection, generadorId: 'g-1', generador: { usuarioId: 'owner', activo: true } };
    db.notice.mockResolvedValue({ ...user, usuario: user });
    db.alert.mockResolvedValue({ estado: 'PENDIENTE', datos: JSON.stringify(data), regla: { activa: true } });
    db.alertsMany.mockResolvedValue([{ id: 'alert', estado: 'PENDIENTE', datos: JSON.stringify(data), regla: { activa: true } }]);
    db.exchange.mockResolvedValue({ ...pending, inspeccion: current });
    db.exchangesMany.mockResolvedValue([{ ...pending, inspeccion: current }]);
    db.usersMany.mockResolvedValue([{ id: 'owner', generador: { id: 'g-1' } }]);
    db.actor.mockResolvedValue({ id: 'owner' });
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(true);
    expect(db.actor.mock.calls[0][0].where.AND[1]).toMatchObject({ generador: { is: { id: 'g-1' } } });
    db.actor.mockResolvedValue(null);
    db.usersMany.mockResolvedValue([]);
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(false);
  });
  it.each([
    null,
    { ...pending, respuestas: [{ tipo: 'RESPUESTA', parte: 'INSPECCIONADO' }] },
    { ...pending, inspeccion: { ...inspection, estado: 'CERRADA_CONFORME' } },
    { ...pending, plazoRespuestaAt: new Date('2099-01-01T12:00:00Z') },
    { ...pending, inspeccionId: 'other' },
  ])('does not mail stale absence-of-response when the requirement changed: %j', async current => {
    db.exchange.mockResolvedValue(current);
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(false);
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('PSIP mail lifecycle, simulated only', () => {
  it.each([
    ['REQUERIMIENTO', 'Nuevo requerimiento'], ['RESPUESTA', 'Nueva respuesta'], ['DESCARGO', 'Descargo presentado'],
    ['SUBSANACION', 'Subsanación presentada'], ['PRONUNCIAMIENTO', 'Pronunciamiento disponible'],
    ['CIERRE_CONFORME', 'Cierre conforme'], ['DERIVACION_LEGALES', 'Derivación a Legales'],
  ])('names %s and links the recipient to their participation without copying the dossier', (evento, label) => {
    const content = notificationMailContent({ ...base, datos: JSON.stringify({ ...metadata, evento, cuerpo: 'PRIVATE', asunto: '<script>PRIVATE</script>', url: 'https://foreign.invalid' }) });
    expect(content?.subject).toBe('[SITREP] ' + label);
    expect(content?.html).toContain('/requerimientos/case');
    expect(content?.html).not.toContain('PRIVATE'); expect(content?.html).not.toContain('foreign.invalid');
  });
  it('links authority recipients directly to the exchange', () => {
    const content = notificationMailContent({ ...base, rol: 'ADMIN', datos: JSON.stringify({ ...metadata, parte: 'INSPECCIONADO', destino: 'inspeccion', evento: 'DESCARGO' }) });
    expect(content?.html).toContain('/inspecciones/case#intercambios');
  });
  it.each([
    { correoVersion: undefined }, { correoVersion: 2 }, { soloCampana: true }, { version: 2 },
    { evento: '__proto__' }, { intercambioId: '' }, { inspeccionId: '' }, { destino: 'external' },
  ])('preserves historical exclusions and rejects malformed contracts %j', patch => {
    expect(notificationMailContent({ ...base, datos: JSON.stringify({ ...metadata, ...patch }) })).toBeNull();
  });
  it('queues a current linked recipient once, then rechecks ownership before delivery', async () => {
    expect(await queueCommittedNotificationEmails()).toBe(1);
    expect(db.insert).toHaveBeenCalledWith({ skipDuplicates: true, data: [expect.objectContaining({ id: 'notification:notice', estado: 'PENDIENTE' })] });
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(true);
    db.inspection.mockResolvedValue({ ...inspection, generador: { usuarioId: 'new-owner' } });
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(false);
  });
  it.each([null, { ...exchange, inspeccionId: 'other' }, { ...exchange, tipo: 'DESCARGO' }, { ...exchange, parte: 'INSPECCIONADO' }, { ...exchange, secuencia: 2 }, { ...exchange, autorId: 'owner' }])('rejects missing, mismatched or self-addressed exchange %j', async current => {
    db.exchange.mockResolvedValue(current);
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(false);
  });
  it.each([
    ['ADMIN', 'general', false, true], ['ADMIN_GENERADOR', 'sector', false, true],
    ['ADMIN_OPERADOR', 'other-sector', true, false], ['GENERADOR', 'inspector', true, true],
    ['GENERADOR', 'inspector', false, false], ['GENERADOR', 'other-inspector', true, false],
    ['GENERADOR', 'owner', false, false], ['TRANSPORTISTA', 'owner', false, false],
  ])('revalidates an authority response for %s/%s', async (rol, usuarioId, esInspector, allowed) => {
    const notice = { ...base, rol, usuarioId, esInspector, datos: JSON.stringify({ ...metadata, parte: 'INSPECCIONADO', destino: 'inspeccion', evento: 'RESPUESTA' }) };
    db.notice.mockResolvedValue({ ...notice, usuario: notice });
    db.exchange.mockResolvedValue({ ...exchange, parte: 'INSPECCIONADO', tipo: 'RESPUESTA', autorId: 'owner' });
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(allowed);
  });
  it.each(['activo', 'emailVerified', 'notifEmail'] as const)('suppresses a recipient without %s', async field => {
    db.notice.mockResolvedValue({ ...base, usuario: { ...base, [field]: false } });
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(false);
  });
  it.each(['BORRADOR', 'PLANIFICADA', 'EN_CAMPO', 'EN_REVISION', 'CANCELADA'])('suppresses old participant mail once the inspection is no longer public: %s', async estado => {
    db.inspection.mockResolvedValue({ ...inspection, estado });
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(false);
  });
  it('never releases the queue while delivery is disabled', async () => {
    vi.stubEnv('DISABLE_EMAILS', 'true');
    expect(await queueCommittedNotificationEmails()).toBe(0); expect(db.query).not.toHaveBeenCalled();
  });
  it('rechecks the assignment of legacy agenda notices', async () => {
    const notice = { ...base, usuarioId: 'inspector', esInspector: true, datos: JSON.stringify({ inspeccionId: 'case', evento: 'ASIGNADA' }) };
    db.notice.mockResolvedValue({ ...notice, usuario: notice });
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(true);
    db.inspection.mockResolvedValue({ ...inspection, inspectorId: 'replacement' });
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(false);
  });
  it.each(['CREADA', 'PROGRAMADA', 'REPROGRAMADA', 'AGENDA_RETIRADA', 'REASIGNADA', 'SUJETO_VINCULADO', 'EN_CAMPO', 'EN_REVISION', 'NOTIFICADA', 'CANCELADA', 'EN_TRAMITE_LEGAL', 'FINALIZADA'])('renders and verifies the committed agenda event %s', async evento => {
    const data = { tipo: 'agenda_inspeccion', version: 1, correoVersion: 1, inspeccionId: 'case', eventoId: 'event', evento, destino: 'inspeccion', detalle: 'PRIVATE' };
    const notice = { ...base, rol: 'ADMIN', usuarioId: 'admin', datos: JSON.stringify(data) };
    db.notice.mockResolvedValue({ ...notice, usuario: notice }); db.event.mockResolvedValue({ inspeccionId: 'case', metadata: { avisoAgenda: evento } });
    expect(notificationMailContent(notice)?.subject).not.toContain('Novedad');
    expect(notificationMailContent(notice)?.html).toContain('/inspecciones/case');
    expect(notificationMailContent(notice)?.html).not.toContain('PRIVATE');
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(true);
    db.event.mockResolvedValue({ inspeccionId: 'other-case', metadata: { avisoAgenda: evento } });
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(false);
  });
  it.each(['REPROGRAMADA', 'EN_CAMPO', 'CANCELADA'])('does not expose an internal agenda event to the actor: %s', async evento => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'agenda_inspeccion', version: 1, correoVersion: 1, inspeccionId: 'case', eventoId: 'event', evento, destino: 'participacion' }) };
    db.notice.mockResolvedValue({ ...notice, usuario: notice }); db.event.mockResolvedValue({ inspeccionId: 'case', metadata: { avisoAgenda: evento } });
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(false);
  });
});

const intakeData = { tipo: 'antecedente_fiscalizacion', version: 1, correoVersion: 1, antecedenteId: 'intake' };
describe('inspection intake mail is an invitation to evaluate, not an accusation', () => {
  const notice = () => ({ ...base, usuarioId: 'admin', rol: 'ADMIN', datos: JSON.stringify(intakeData) });
  it('uses the controlled agenda route and discloses no actor identity or finding in mail', () => {
    const content = notificationMailContent({ ...notice(), datos: JSON.stringify({ ...intakeData, actorNombre: 'PRIVATE', evidencia: 'PRIVATE', url: 'https://foreign.invalid' }) });
    expect(content?.subject).toBe('[SITREP] Nuevo antecedente para evaluar en PSIP');
    expect(content?.html).toContain('/inspecciones?vista=antecedentes');
    expect(content?.html).toContain('no acredita una infracción');
    expect(content?.html).not.toContain('PRIVATE'); expect(content?.html).not.toContain('foreign.invalid');
  });
  it.each([{ version: undefined }, { correoVersion: undefined }, { correoVersion: 2 }, { antecedenteId: '' }, { soloCampana: true }])('does not backfill or accept malformed legacy intake %j', patch => {
    expect(notificationMailContent({ ...notice(), datos: JSON.stringify({ ...intakeData, ...patch }) })).toBeNull();
  });
  it.each([
    ['ADMIN', 'PENDIENTE', true], ['ADMIN_GENERADOR', 'EN_EVALUACION', true],
    ['ADMIN_OPERADOR', 'PENDIENTE', false], ['GENERADOR', 'PENDIENTE', false],
    ['ADMIN', 'VINCULADA', false], ['ADMIN', 'DESCARTADA', false],
  ])('rechecks current administrative sector and pending work %s/%s', async (rol, estado, allowed) => {
    const current = { ...notice(), rol, esInspector: true }; db.notice.mockResolvedValue({ ...current, usuario: current });
    db.intake.mockResolvedValue({ tipoActor: 'GENERADOR', estado, creadoPorId: 'operator' });
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(allowed);
  });
  it('suppresses a missing source or the author as recipient', async () => {
    const current = notice(); db.notice.mockResolvedValue({ ...current, usuario: current });
    db.intake.mockResolvedValue(null); expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(false);
    db.intake.mockResolvedValue({ tipoActor: 'GENERADOR', estado: 'PENDIENTE', creadoPorId: 'admin' });
    expect(await queuedNoticeStillEligible('notification:notice', base.email)).toBe(false);
  });
});
