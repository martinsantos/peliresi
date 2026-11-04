import { afterEach, expect, it, vi } from 'vitest';
import { withCompanyNoticeContext } from '../../services/companyNotice.service';

const deadline = new Date('2020-01-01T12:00:00Z');
const find = (value: unknown) => vi.fn().mockResolvedValue(value);
function fixture(role: 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' = 'GENERADOR') {
  const key = role.toLowerCase() as 'generador' | 'transportista' | 'operador';
  const facts = { familia: 'catalogo_verificable', version: 1, tipo: 'requerimiento_inspeccion', entidad: 'REQUERIMIENTO',
    entidadId: 'req', inspeccionId: 'inspection', tipoActor: role, actorId: 'actor', vencimiento: deadline.toISOString(),
    numero: 'QA-PRIVATE', descripcion: 'Todavía no hay respuesta', estadoDetectado: 'SIN_RESPUESTA' };
  const inspection = { id: 'inspection', numero: 'QA-PRIVATE', estado: 'NOTIFICADA', inspectorId: 'inspector', tipoActor: role, generadorId: null, transportistaId: null,
    operadorId: null, generador: null, transportista: null, operador: null,
    [`${key}Id`]: 'actor', [key]: { usuarioId: 'owner', activo: true } };
  const request = { id: 'req', inspeccionId: 'inspection', tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD',
    destinatario: 'INSPECCIONADO', plazoRespuestaAt: deadline, respuestas: [], inspeccion: inspection };
  const alert = { id: 'alert', datos: JSON.stringify(facts), estado: 'PENDIENTE', regla: { activa: true } };
  const notice = { usuarioId: 'owner', tipo: 'INFO_GENERAL', titulo: 'Aviso original', mensaje: 'Todavía no hay respuesta',
    datos: JSON.stringify({ ...facts, casoId: 'alert', destino: 'participacion' }) };
  return { notice, request, inspection, alert, db: { alertaGenerada: { findMany: find([alert]) },
    intercambioInspeccion: { findMany: find([request]) }, usuario: { findMany: find([{ id: 'owner', [key]: { id: 'actor' } }]) } } };
}
afterEach(() => vi.unstubAllEnvs());

it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] as const)('preserves a currently pending direct %s notice', async role => {
  const { db, notice } = fixture(role);
  expect(await withCompanyNoticeContext(db as any, [notice])).toEqual([notice]);
});

it('batches repeated notices by role and asks the database to verify secondary-activity approval', async () => {
  vi.stubEnv('ACTOR_MULTIROLE_ENABLED', 'true');
  const { db, notice } = fixture();
  expect(await withCompanyNoticeContext(db as any, [notice, notice])).toEqual([notice, notice]);
  expect(db.usuario.findMany).toHaveBeenCalledOnce();
  expect(db.usuario.findMany.mock.calls[0][0].where.AND[1].OR[0]).toMatchObject({
    OR: [{ rol: 'GENERADOR' }, { solicitudes: { some: { estado: 'APROBADA', tipoActor: 'GENERADOR', generadorId: 'actor' } } }],
  });
});

it.each(['answered', 'rule-inactive', 'case-resolved', 'deadline-changed'] as const)(
  'does not claim a response is missing after %s, without waiting for the alert sweep', async reason => {
    const { db, notice, request, alert } = fixture();
    if (reason === 'answered') db.intercambioInspeccion.findMany.mockResolvedValue([{ ...request, respuestas: [{ parte: 'INSPECCIONADO', tipo: 'RESPUESTA' }] }]);
    if (reason === 'rule-inactive') db.alertaGenerada.findMany.mockResolvedValue([{ ...alert, regla: { activa: false } }]);
    if (reason === 'case-resolved') db.alertaGenerada.findMany.mockResolvedValue([{ ...alert, estado: 'RESUELTA' }]);
    if (reason === 'deadline-changed') db.intercambioInspeccion.findMany.mockResolvedValue([{ ...request, plazoRespuestaAt: new Date('2099-01-01') }]);
    const [view] = await withCompanyNoticeContext(db as any, [notice]);
    expect(view.titulo).toBe('Estado actualizado de requerimiento');
    expect(view.mensaje).toContain('QA-PRIVATE');
    if (reason === 'answered') expect(view.mensaje).toContain('Se registró una respuesta');
    expect(JSON.stringify(view)).not.toContain('Todavía no hay respuesta');
    expect(JSON.parse(view.datos!).estadoDetectado).toBe('ACTUALIZADO');
  },
);

it('updates an assigned inspector’s own notice after a response without another sweep', async () => {
  const { db, notice, request } = fixture();
  notice.usuarioId = 'inspector'; notice.datos = JSON.stringify({ ...JSON.parse(notice.datos!), destino: 'inspeccion' });
  db.usuario.findMany.mockResolvedValue([{ id: 'inspector', rol: 'GENERADOR', esInspector: true }]);
  db.intercambioInspeccion.findMany.mockResolvedValue([{ ...request, respuestas: [{ parte: 'INSPECCIONADO', tipo: 'RESPUESTA' }] }]);
  const [view] = await withCompanyNoticeContext(db as any, [notice]);
  expect(view.titulo).toBe('Estado actualizado de requerimiento');
  expect(JSON.stringify(view)).not.toContain('Todavía no hay respuesta');
  expect(JSON.parse(view.datos!).destino).toBe('inspeccion');
});

it.each(['reassigned', 'wrong-sector'] as const)('masks an authority notice after %s', async reason => {
  const { db, notice, request, inspection } = fixture();
  notice.usuarioId = 'inspector'; notice.datos = JSON.stringify({ ...JSON.parse(notice.datos!), destino: 'inspeccion' });
  db.usuario.findMany.mockResolvedValue([reason === 'wrong-sector'
    ? { id: 'inspector', rol: 'ADMIN_OPERADOR', esInspector: false }
    : { id: 'inspector', rol: 'GENERADOR', esInspector: true }]);
  if (reason === 'reassigned') db.intercambioInspeccion.findMany.mockResolvedValue([{ ...request, inspeccion: { ...inspection, inspectorId: 'different' } }]);
  const [view] = await withCompanyNoticeContext(db as any, [notice]);
  expect(view.titulo).toBe('Aviso no disponible');
  expect(JSON.stringify(view)).not.toContain('QA-PRIVATE');
});

it.each(['account-inactive', 'actor-inactive', 'owner-changed', 'wrong-source'] as const)(
  'does not reveal newly derived status after %s', async reason => {
    const { db, notice, request, inspection, alert } = fixture();
    if (reason === 'account-inactive') db.usuario.findMany.mockResolvedValue([]);
    if (reason === 'actor-inactive') db.intercambioInspeccion.findMany.mockResolvedValue([{ ...request, inspeccion: { ...inspection, generador: { usuarioId: 'owner', activo: false } } }]);
    if (reason === 'owner-changed') db.intercambioInspeccion.findMany.mockResolvedValue([{ ...request, inspeccion: { ...inspection, generador: { usuarioId: 'different', activo: true } } }]);
    if (reason === 'wrong-source') db.alertaGenerada.findMany.mockResolvedValue([{ ...alert, datos: JSON.stringify({ tipo: 'other' }) }]);
    const [view] = await withCompanyNoticeContext(db as any, [notice]);
    expect(view.titulo).toBe('Aviso no disponible');
    expect(JSON.stringify(view)).not.toContain('QA-PRIVATE');
  },
);
