import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ event: vi.fn(), first: vi.fn(), inspection: vi.fn(), user: vi.fn(), queue: vi.fn(), managers: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { eventoInspeccion: { findUnique: m.event, findFirst: m.first }, inspeccion: { findUnique: m.inspection }, usuario: { findUnique: m.user }, emailQueue: { findMany: m.queue } } }));
vi.mock('../../services/inspectionManagementRole.service', () => ({ inspectionManagementRecipientIds: m.managers }));
import { renderInspectionActMail, inspectionActMailState, queueInspectionActMails, inspectionActMailStillEligible, actMailId, listInspectionActMails, type ActMailAudience, type ActMailEvent } from '../../services/inspectionActMail.service';

const future = new Date(Date.now() + 86400000).toISOString();
const base = { inspeccionId: 'case', numero: 'INS-2026-0001', numeroActa: 'QA-001', tipo: 'APELACION', nombre: 'Persona de práctica', fecha: new Date('2026-11-03T15:00:00Z'), inspector: 'Inspector de práctica', responsable: 'Jefa de práctica', expiresAt: future };
const ready = { DISABLE_EMAILS: 'false', EMAIL_DELIVERY_NOT_BEFORE: '2026-01-01T00:00:00Z', INSPECTION_FIELD_MODEL_ENABLED: 'true', INSPECTION_ACT_MAIL_ENABLED: 'true', EMAIL_NOTIFICATION_FAMILIES: 'inspecciones' };
function tx(staff: any[] = [], people: any[] = [{ id: 'insp', nombre: 'Inspector de práctica' }]) {
  const findMany = vi.fn().mockResolvedValueOnce(staff).mockResolvedValueOnce(people);
  return { usuario: { findMany }, emailQueue: { createMany: vi.fn(async ({ data }: any) => ({ count: data.length })) } } as any;
}
beforeEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); m.managers.mockResolvedValue(['boss']); });

describe('inspection act mail content', () => {
  const cases: Array<[ActMailEvent, ActMailAudience]> = [['PRESENTACION_RECIBIDA', 'INSPECCIONADO'], ['PRESENTACION_RECIBIDA', 'INSPECTOR'], ['PRESENTACION_RECIBIDA', 'JEFATURA'], ['RESPUESTA_PUBLICADA', 'INSPECCIONADO'], ['RESPUESTA_PUBLICADA', 'INSPECTOR'], ['RESPUESTA_PUBLICADA', 'JEFATURA']];
  it.each(cases)('%s for %s states reason, dossier, responsible and next action', (event, audience) => {
    const mail = renderInspectionActMail({ ...base, event, audience });
    expect(mail.subject).toMatch(/^\[SITREP\] /);
    for (const label of ['Motivo', 'Responsable', 'Próxima acción']) expect(mail.text).toContain(label);
    expect(mail.text).toContain(audience === 'INSPECCIONADO' ? 'QA-001' : 'INS-2026-0001');
  });
  it('never puts the personal link, its token or the internal dossier in the inspeccionado mail', () => {
    for (const event of ['PRESENTACION_RECIBIDA', 'RESPUESTA_PUBLICADA'] as const) {
      const mail = renderInspectionActMail({ ...base, event, audience: 'INSPECCIONADO' });
      expect(mail.html).not.toMatch(/acta-compartida|\/inspecciones\/|#[a-f0-9]{64}/);
      expect(mail.text).toContain('no incluye ese enlace');
      expect(mail.text).toMatch(/disponible hasta/);
    }
  });
  it('gives staff an explicit web and app route to the dossier that still requires login', () => {
    const mail = renderInspectionActMail({ ...base, event: 'PRESENTACION_RECIBIDA', audience: 'INSPECTOR' });
    expect(mail.html).toContain('data-mail-action="web"'); expect(mail.html).toContain('/app/inspecciones/case'); expect(mail.text).toContain('después de ingresar');
  });
  it('escapes declared names', () => {
    const mail = renderInspectionActMail({ ...base, nombre: '<img src=x onerror=alert(1)>', event: 'PRESENTACION_RECIBIDA', audience: 'INSPECTOR' });
    expect(mail.html).not.toContain('<img src=x'); expect(mail.html).toContain('&lt;img');
  });
});

describe('inspection act mail guard', () => {
  it('stays closed with the kill switch and without its own flag', () => {
    expect(inspectionActMailState({})).toEqual({ ready: false, reason: 'EMAIL_DISABLED' });
    expect(inspectionActMailState({ ...ready, INSPECTION_ACT_MAIL_ENABLED: 'false' })).toEqual({ ready: false, reason: 'EVENT_NOT_ENABLED' });
    expect(inspectionActMailState({ ...ready, EMAIL_NOTIFICATION_FAMILIES: 'solicitudes' }).ready).toBe(false);
    expect(inspectionActMailState(ready)).toEqual({ ready: true, reason: '' });
  });
});

describe('queueing', () => {
  const input = (extra = {}) => ({ event: 'PRESENTACION_RECIBIDA' as const, eventoId: 'ev1', managers: ['boss'], inspection: { id: 'case', numero: 'INS-1', numeroActa: 'QA-001', inspectorId: 'insp' }, share: { destinatario: 'persona@practica.sitrep.test', expiresAt: future }, tipo: 'DESCARGO', nombre: 'Persona', fecha: new Date(), ...extra });
  it('prepares one suppressed row per audience while mail is disabled', async () => {
    const t = tx([{ id: 'insp', email: 'insp@practica.sitrep.test' }, { id: 'boss', email: 'boss@practica.sitrep.test' }]);
    await queueInspectionActMails(t, input());
    const { data, skipDuplicates } = t.emailQueue.createMany.mock.calls[0][0];
    expect(skipDuplicates).toBe(true);
    expect(data.map((r: any) => r.id)).toEqual([actMailId('ev1', 'INSPECTOR', 'insp'), actMailId('ev1', 'JEFATURA', 'boss'), actMailId('ev1', 'INSPECCIONADO', 'enlace')]);
    expect(data.every((r: any) => r.estado === 'SUPRIMIDO' && r.error === 'EMAIL_DISABLED')).toBe(true);
  });
  it('marks rows ready only when every gate is open', async () => {
    for (const [k, v] of Object.entries(ready)) vi.stubEnv(k, v);
    const t = tx([{ id: 'insp', email: 'insp@practica.sitrep.test' }]);
    await queueInspectionActMails(t, input());
    expect(t.emailQueue.createMany.mock.calls[0][0].data.every((r: any) => r.estado === 'PENDIENTE' && r.error === 'NOTIFICATION_READY')).toBe(true);
  });
  it('excludes the author, unverified accounts and an expired or missing link recipient', async () => {
    const t = tx([]);
    await queueInspectionActMails(t, input({ autorId: 'boss', share: { destinatario: 'persona@practica.sitrep.test', expiresAt: '2020-01-01T00:00:00Z' } }));
    const where = t.usuario.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ activo: true, emailVerified: true, notifEmail: true, id: { not: 'boss' } });
    expect(t.emailQueue.createMany).not.toHaveBeenCalled();
    const revoked = tx([]); await queueInspectionActMails(revoked, input({ share: { destinatario: null, expiresAt: future } }));
    expect(revoked.emailQueue.createMany).not.toHaveBeenCalled();
  });
});

describe('delivery recheck', () => {
  const share = { id: 'grant', destinatario: 'persona@practica.sitrep.test', metadata: { expiresAt: future } };
  beforeEach(() => { for (const [k, v] of Object.entries(ready)) vi.stubEnv(k, v); m.event.mockResolvedValue({ id: 'ev1', inspeccionId: 'case', tipo: 'ACTA_PRESENTACION_RECIBIDA', usuarioId: 'staff', metadata: { accesoId: 'grant' } }); });
  it('sends to the link recipient only while the link is valid', async () => {
    m.first.mockResolvedValueOnce(share).mockResolvedValueOnce(null);
    expect(await inspectionActMailStillEligible(actMailId('ev1', 'INSPECCIONADO', 'enlace'), 'Persona@practica.sitrep.test')).toBe(true);
    m.first.mockResolvedValueOnce(share).mockResolvedValueOnce({ id: 'revoke' });
    expect(await inspectionActMailStillEligible(actMailId('ev1', 'INSPECCIONADO', 'enlace'), share.destinatario)).toBe(false);
    m.first.mockResolvedValueOnce({ ...share, metadata: { expiresAt: '2020-01-01T00:00:00Z' } }).mockResolvedValueOnce(null);
    expect(await inspectionActMailStillEligible(actMailId('ev1', 'INSPECCIONADO', 'enlace'), share.destinatario)).toBe(false);
    m.first.mockResolvedValueOnce(share).mockResolvedValueOnce(null);
    expect(await inspectionActMailStillEligible(actMailId('ev1', 'INSPECCIONADO', 'enlace'), 'otra@practica.sitrep.test')).toBe(false);
  });
  it('drops staff mail after reassignment, account changes or with the gate closed', async () => {
    const user = { id: 'insp', email: 'insp@practica.sitrep.test', activo: true, emailVerified: true, notifEmail: true, esInspector: true };
    m.inspection.mockResolvedValue({ inspectorId: 'insp' }); m.user.mockResolvedValue(user);
    expect(await inspectionActMailStillEligible(actMailId('ev1', 'INSPECTOR', 'insp'), user.email)).toBe(true);
    m.inspection.mockResolvedValue({ inspectorId: 'other' });
    expect(await inspectionActMailStillEligible(actMailId('ev1', 'INSPECTOR', 'insp'), user.email)).toBe(false);
    m.inspection.mockResolvedValue({ inspectorId: 'insp' }); m.user.mockResolvedValue({ ...user, notifEmail: false });
    expect(await inspectionActMailStillEligible(actMailId('ev1', 'INSPECTOR', 'insp'), user.email)).toBe(false);
    m.user.mockResolvedValue({ ...user, id: 'boss', esInspector: false, email: 'boss@practica.sitrep.test' }); m.managers.mockResolvedValue([]);
    expect(await inspectionActMailStillEligible(actMailId('ev1', 'JEFATURA', 'boss'), 'boss@practica.sitrep.test')).toBe(false);
    vi.stubEnv('DISABLE_EMAILS', 'true'); m.user.mockResolvedValue(user);
    expect(await inspectionActMailStillEligible(actMailId('ev1', 'INSPECTOR', 'insp'), user.email)).toBe(false);
    expect(await inspectionActMailStillEligible('inspection-act:malformed', user.email)).toBe(false);
  });
  it('lists prepared mail scoped to the dossier events', async () => {
    m.queue.mockResolvedValue([{ id: actMailId('ev1', 'JEFATURA', 'boss'), to: 'b', subject: 's', html: 'h', estado: 'SUPRIMIDO', error: 'EMAIL_DISABLED', createdAt: new Date(), sentAt: null }, { id: actMailId('ev1', 'INSPECCIONADO', 'enlace'), to: 'p', subject: 's', html: 'h', estado: 'SUPRIMIDO', error: 'EMAIL_DISABLED', createdAt: new Date(), sentAt: null }]);
    const rows = await listInspectionActMails(['ev1']);
    expect(m.queue.mock.calls[0][0].where).toEqual({ OR: [{ id: { startsWith: 'inspection-act:ev1:' } }] });
    expect(rows.map(r => r.audiencia)).toEqual(['INSPECCIONADO', 'JEFATURA']);
    expect(await listInspectionActMails([])).toEqual([]);
  });
});
