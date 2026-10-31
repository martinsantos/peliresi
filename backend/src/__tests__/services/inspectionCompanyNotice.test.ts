import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { inTrainingSession } from '../../lib/trainingScope';
import { inspectionCompanyNoticeRows, inspectionCompanyRecipientsBatch, withInspectionCompanyNoticeContext } from '../../services/inspectionCompanyNotice.service';
import { notificationMailContent } from '../../services/notification-mail.service';

const find = (value: unknown) => vi.fn().mockResolvedValue(value);
const inspection = { id: 'case', numero: 'QA-CASE-1', estado: 'NOTIFICADA', tipoActor: 'GENERADOR' as const, generadorId: 'actor' };
const exchange = { id: 'exchange', inspeccionId: 'case', secuencia: 1, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD',
  destinatario: 'INSPECCIONADO', autorId: 'admin', plazoRespuestaAt: new Date('2026-11-07T15:00:00.000Z') };
const event = { id: 'event', inspeccionId: 'case', tipo: 'CAMBIO_ESTADO', estadoHasta: 'NOTIFICADA',
  usuarioId: 'admin', metadata: { avisoAgenda: 'NOTIFICADA' } };
let db: any;
beforeEach(() => {
  vi.stubEnv('ENTERPRISE_ENABLED', 'true');
  db = {
    empresaActividad: { findMany: find([{ id: 'activity', empresaId: 'company', rol: 'GENERADOR', actorId: 'actor' }]) },
    empresa: { findMany: find([{ id: 'company', cuit: '30123456789', razonSocial: 'QA Empresa' }]) },
    autorizacionEmpresa: { findMany: find([{ id: 'grant', empresaId: 'company', actividadId: 'activity', usuarioId: 'rep' }]) },
    usuario: { findMany: find([{ id: 'rep' }]) },
    generador: { findMany: find([{ id: 'actor', activo: true, cuit: '30-12345678-9' }]) },
    transportista: { findMany: find([]) }, operador: { findMany: find([]) },
    inspeccion: { findMany: find([inspection]) }, intercambioInspeccion: { findMany: find([exchange]) },
    eventoInspeccion: { findMany: find([event]) },
  };
});
afterEach(() => vi.unstubAllEnvs());

it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] as const)('matches a whole-company grant to the exact %s activity', async rol => {
  const field = rol === 'GENERADOR' ? 'generadorId' : rol === 'TRANSPORTISTA' ? 'transportistaId' : 'operadorId';
  db.empresaActividad.findMany.mockResolvedValue([{ id: 'activity', empresaId: 'company', rol, actorId: 'actor' }]);
  db[rol.toLowerCase()].findMany.mockResolvedValue([{ id: 'actor', activo: true, cuit: '30123456789' }]);
  const batch = await inspectionCompanyRecipientsBatch(db, [{ id: 'case', tipoActor: rol, [field]: 'actor' }], ['rep']);
  expect(batch.get('case')).toEqual([{ usuarioId: 'rep', access: { empresaId: 'company', actividadId: 'activity', rol,
    razonSocial: 'QA Empresa', actorId: 'actor', autorizacionId: 'grant' } }]);
  expect(db.empresaActividad.findMany.mock.calls[0][0].where).toMatchObject({ activa: true, OR: [{ rol, actorId: 'actor' }] });
  expect(db.autorizacionEmpresa.findMany.mock.calls[0][0].where).toMatchObject({ activa: true, todosEstablecimientos: true, usuarioId: { in: ['rep'] } });
  expect(db.usuario.findMany.mock.calls[0][0].where).toMatchObject({ activo: true, emailVerified: true });
});
it('does not inspect company grants when the feature is disabled or in CAP', async () => {
  vi.stubEnv('ENTERPRISE_ENABLED', 'false'); expect(await inspectionCompanyRecipientsBatch(db, [inspection])).toEqual(new Map());
  vi.stubEnv('ENTERPRISE_ENABLED', 'true'); expect(await inTrainingSession(() => inspectionCompanyRecipientsBatch(db, [inspection]))).toEqual(new Map());
  expect(db.empresaActividad.findMany).not.toHaveBeenCalled();
});
it.each(['revoked', 'company-inactive', 'actor-inactive', 'wrong-cuit', 'malformed-company-cuit', 'user-inactive', 'activity-inactive', 'wrong-company'])('does not grant access when %s', async reason => {
  if (reason === 'revoked') db.autorizacionEmpresa.findMany.mockResolvedValue([]);
  if (reason === 'company-inactive') db.empresa.findMany.mockResolvedValue([]);
  if (reason === 'actor-inactive') db.generador.findMany.mockResolvedValue([{ id: 'actor', activo: false, cuit: '30123456789' }]);
  if (reason === 'wrong-cuit') db.generador.findMany.mockResolvedValue([{ id: 'actor', activo: true, cuit: '30111111111' }]);
  if (reason === 'malformed-company-cuit') db.empresa.findMany.mockResolvedValue([{ id: 'company', cuit: '30-12345678-9', razonSocial: 'QA Empresa' }]);
  if (reason === 'user-inactive') db.usuario.findMany.mockResolvedValue([]);
  if (reason === 'activity-inactive') db.empresaActividad.findMany.mockResolvedValue([]);
  if (reason === 'wrong-company') db.autorizacionEmpresa.findMany.mockResolvedValue([{ id: 'grant', empresaId: 'other', actividadId: 'activity', usuarioId: 'rep' }]);
  expect((await inspectionCompanyRecipientsBatch(db, [inspection])).get('case') || []).toEqual([]);
});
it('creates a deterministic opaque notice without case, deadline, author or duplicate direct recipients', async () => {
  const args = [db, inspection, { clase: 'intercambio', id: 'exchange', autorId: 'admin' }, []] as const;
  const [row] = await inspectionCompanyNoticeRows(...args);
  expect(await inspectionCompanyNoticeRows(...args)).toEqual([row]);
  expect(row.usuarioId).toBe('rep');
  expect(JSON.stringify(row)).not.toMatch(/QA-CASE|2026-11-07|company|actor|admin/);
  expect(await inspectionCompanyNoticeRows(db, inspection, { clase: 'intercambio', id: 'exchange', autorId: 'rep' }, [])).toEqual([]);
  expect(await inspectionCompanyNoticeRows(db, inspection, { clase: 'intercambio', id: 'exchange', autorId: 'admin' }, ['rep'])).toEqual([]);
});
it.each(['intercambio', 'agenda'] as const)('projects an authorized %s notice and a safe simulated email', async clase => {
  const [row] = await inspectionCompanyNoticeRows(db, inspection, { clase, id: clase === 'agenda' ? 'event' : 'exchange', autorId: 'admin' }, []);
  const [projected] = await withInspectionCompanyNoticeContext(db, [row]);
  const data = JSON.parse(projected.datos!);
  expect(projected.mensaje).toContain('QA-CASE-1');
  expect(data).toMatchObject({ inspeccionId: 'case', destino: 'participacion', tipoActor: 'GENERADOR', representacionVersion: 1,
    accesosEmpresa: [{ empresaId: 'company', actividadId: 'activity', actorId: 'actor' }] });
  expect(JSON.stringify(projected)).not.toContain('autorizacionId');
  const mail = notificationMailContent({ ...projected, rol: 'OPERADOR', createdAt: new Date() } as any);
  expect(mail?.html).toContain('/notificaciones/' + row.id);
  expect(mail?.html).not.toContain('QA Empresa');
});
it.each(['grant-revoked', 'grant-replaced', 'different-recipient', 'case-reassigned', 'case-hidden', 'source-invalid', 'self-addressed'])('masks old notices when %s', async reason => {
  const [row] = await inspectionCompanyNoticeRows(db, inspection, { clase: 'intercambio', id: 'exchange', autorId: 'admin' }, []);
  if (reason === 'grant-revoked') db.autorizacionEmpresa.findMany.mockResolvedValue([]);
  if (reason === 'grant-replaced') db.autorizacionEmpresa.findMany.mockResolvedValue([{ id: 'new-grant', empresaId: 'company', actividadId: 'activity', usuarioId: 'rep' }]);
  if (reason === 'different-recipient') row.usuarioId = 'other';
  if (reason === 'case-reassigned') db.inspeccion.findMany.mockResolvedValue([{ ...inspection, generadorId: 'another' }]);
  if (reason === 'case-hidden') db.inspeccion.findMany.mockResolvedValue([{ ...inspection, estado: 'BORRADOR' }]);
  if (reason === 'source-invalid') db.intercambioInspeccion.findMany.mockResolvedValue([{ ...exchange, parte: 'INSPECCIONADO' }]);
  if (reason === 'self-addressed') db.intercambioInspeccion.findMany.mockResolvedValue([{ ...exchange, autorId: 'rep' }]);
  const [visible] = await withInspectionCompanyNoticeContext(db, [row]);
  expect(visible.titulo).toBe('Aviso no disponible');
  expect(JSON.stringify(visible)).not.toMatch(/QA-CASE|2026-11-07|company|exchange|grant/);
});
it('masks malformed private references and batches multiple notices', async () => {
  const [row] = await inspectionCompanyNoticeRows(db, inspection, { clase: 'intercambio', id: 'exchange', autorId: 'admin' }, []);
  db.empresaActividad.findMany.mockClear(); db.autorizacionEmpresa.findMany.mockClear();
  const malformed = { ...row, datos: JSON.stringify({ tipo: 'psip_empresa', version: 999, numero: 'SECRET' }) };
  const visible = await withInspectionCompanyNoticeContext(db, [row, row, malformed]);
  expect(visible[2].titulo).toBe('Aviso no disponible'); expect(JSON.stringify(visible[2])).not.toContain('SECRET');
  expect(db.empresaActividad.findMany).toHaveBeenCalledOnce(); expect(db.autorizacionEmpresa.findMany).toHaveBeenCalledOnce();
});
