import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ users: vi.fn(), insert: vi.fn(), record: vi.fn(), notice: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { usuario: { findMany: db.users }, registroManifiestoExcepcional: { findUnique: db.record }, notificacion: { findUnique: db.notice } } }));
import { EVENTUAL_NOTICE_LABELS, eventualNoticeEvent, notifyEventualParties } from '../../services/eventualNotice.service';
import { notificationMailContent, queuedNoticeStillEligible } from '../../services/notification-mail.service';

const event = (id: string, tipo: string, extra = {}) => ({ id, tipo, version: 0, autorId: 'operator', fecha: '2026-10-20T12:00:00Z', nota: 'PRIVATE', ...extra });
const record = { id: 'eventual', creadoPorId: 'operator', operadorId: 'op', autorRol: 'OPERADOR', impersonadoPorId: null,
  datos: { generador: { padronId: 'gen' }, transportista: { email: 'never-contact@night-qa.invalid' },
    aprobaciones: [{ parte: 'creador', rol: 'OPERADOR', usuarioId: 'operator', actorId: 'op' }, { parte: 'generador', rol: 'GENERADOR', actorId: 'gen' }] },
  eventos: [] } as any;
const metadata = { tipo: 'manifiesto_eventual', version: 1, correoVersion: 1, registroId: 'eventual', eventoId: 'creacion', evento: 'CREADO' };
const notice = { id: 'notice', usuarioId: 'generator', tipo: 'INFO_GENERAL', datos: JSON.stringify(metadata), createdAt: new Date(),
  email: 'generator@night-qa.invalid', activo: true, emailVerified: true, notifEmail: true, rol: 'GENERADOR' };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('MANIFEST_EXCEPTIONAL_REVIEWERS', 'reviewer,operator');
  vi.stubEnv('MANIFEST_EXCEPTIONAL_ENABLED', 'true');
  vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'manifiestos');
  db.users.mockResolvedValue([{ id: 'generator' }]); db.insert.mockResolvedValue({ count: 1 });
  db.record.mockResolvedValue(record); db.notice.mockResolvedValue({ ...notice, usuario: notice });
});
afterEach(() => vi.unstubAllEnvs());

it('records one deterministic notice per event and recipient, inside the supplied transaction', async () => {
  const tx = { usuario: { findMany: db.users }, notificacion: { createMany: db.insert } } as any;
  await notifyEventualParties(tx, record, 'creacion'); await notifyEventualParties(tx, record, 'creacion');
  expect(db.insert.mock.calls[0]).toEqual(db.insert.mock.calls[1]);
  expect(db.insert).toHaveBeenCalledWith({ skipDuplicates: true, data: [expect.objectContaining({ usuarioId: 'generator', titulo: EVENTUAL_NOTICE_LABELS.CREADO[0], datos: JSON.stringify(metadata) })] });
  expect(db.users).toHaveBeenCalledWith({ where: { activo: true, id: { not: 'operator' }, OR: [
    { id: 'operator', OR: [{ rol: 'ADMIN' }, { rol: 'GENERADOR', generador: { isNot: null } }, { rol: 'TRANSPORTISTA', transportista: { isNot: null } }, { rol: 'OPERADOR', operador: { isNot: null } }] },
    { rol: 'GENERADOR', generador: { is: { id: 'gen' } } }, { rol: 'OPERADOR', operador: { is: { id: 'op' } } },
  ] }, select: { id: true } });
  expect(JSON.stringify(db.insert.mock.calls)).not.toContain('never-contact');
});
it('notifies the designated reviewer only when revision is requested, excluding its own record', async () => {
  const tx = { usuario: { findMany: db.users }, notificacion: { createMany: db.insert } } as any;
  await notifyEventualParties(tx, { ...record, eventos: [event('request', 'SOLICITAR_REVISION')] }, 'request');
  expect(db.users.mock.calls[0][0].where.OR.at(-1)).toEqual({ rol: 'ADMIN', id: { in: ['reviewer'] } });
});
it('evaluates each approval at its committed position, not from later unanimity', () => {
  const row = { ...record, eventos: [event('one', 'APROBAR_PARTE', { parte: 'generador' }), event('two', 'APROBAR_PARTE', { parte: 'creador' })] };
  expect(eventualNoticeEvent(row, 'one')?.kind).toBe('APROBACION');
  expect(eventualNoticeEvent(row, 'two')?.kind).toBe('APROBADO');
  expect(eventualNoticeEvent(row, 'missing')).toBeNull();
});
it.each([
  ['RECHAZAR_PARTE', {}, 'RECHAZADO'], ['AVANCE', { etapa: 'RETIRADO' }, 'RETIRADO'],
  ['AVANCE', { etapa: 'RECIBIDO' }, 'RECIBIDO'], ['AVANCE', { etapa: 'TRATADO' }, 'TRATADO'],
  ['DIFERENCIA', {}, 'DIFERENCIA'], ['SOLICITAR_REVISION', {}, 'SOLICITAR_REVISION'],
  ['RESOLVER', { decision: 'APROBADA' }, 'APROBADA_POST_FACTO'], ['RESOLVER', { decision: 'OBSERVADA' }, 'OBSERVADA_POST_FACTO'],
  ['RESOLVER', { decision: 'RECHAZADA' }, 'RECHAZADA_POST_FACTO'],
])('resolves %s without conflating operation and post-facto review', (type, extra, kind) => {
  expect(eventualNoticeEvent({ ...record, eventos: [event('step', type as string, extra)] }, 'step')).toEqual({ kind, authorId: 'operator' });
});
it.each(Object.keys(EVENTUAL_NOTICE_LABELS))('renders %s with a controlled link and no private contents', evento => {
  const rendered = notificationMailContent({ ...notice, datos: JSON.stringify({ ...metadata, evento, nota: 'PRIVATE', url: 'https://foreign.invalid' }) });
  expect(rendered?.family).toBe('manifiestos'); expect(rendered?.html).toContain('/manifiestos/baja-intensidad?registro=eventual');
  expect(rendered?.subject).toBe('[SITREP] ' + EVENTUAL_NOTICE_LABELS[evento as keyof typeof EVENTUAL_NOTICE_LABELS][0]);
  expect(rendered?.html).not.toContain('PRIVATE'); expect(rendered?.html).not.toContain('foreign.invalid');
});
it.each([{ version: 2 }, { correoVersion: undefined }, { soloCampana: true }, { evento: '__proto__' }, { eventoId: '' }, { registroId: '../other' }])('rejects invalid or historical mail contract %j', patch => {
  expect(notificationMailContent({ ...notice, datos: JSON.stringify({ ...metadata, ...patch }) })).toBeNull();
});
it('rechecks current ownership/assignment rather than trusting a queued recipient', async () => {
  expect(await queuedNoticeStillEligible('notification:notice', notice.email)).toBe(true);
  db.users.mockResolvedValue([]);
  expect(await queuedNoticeStillEligible('notification:notice', notice.email)).toBe(false);
});
it('does not mail an eventual while its feature is closed', async () => {
  vi.stubEnv('MANIFEST_EXCEPTIONAL_ENABLED', 'false');
  expect(await queuedNoticeStillEligible('notification:notice', notice.email)).toBe(false);
  expect(db.record).not.toHaveBeenCalled();
});
it('rejects a missing source or event whose type does not match the notice', async () => {
  db.record.mockResolvedValue(null); expect(await queuedNoticeStillEligible('notification:notice', notice.email)).toBe(false);
  db.record.mockResolvedValue({ ...record, eventos: [event('step', 'AVANCE', { etapa: 'RECIBIDO' })] });
  const altered = { ...notice, datos: JSON.stringify({ ...metadata, eventoId: 'step', evento: 'TRATADO' }) };
  db.notice.mockResolvedValue({ ...altered, usuario: altered });
  expect(await queuedNoticeStillEligible('notification:notice', notice.email)).toBe(false);
});
