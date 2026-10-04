import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ rules: vi.fn(), currentRule: vi.fn(), requests: vi.fn(), request: vi.fn(), actors: vi.fn(), actor: vi.fn(), cases: vi.fn(), upsert: vi.fn(), reconcile: vi.fn(), notice: vi.fn(), admins: vi.fn(), transaction: vi.fn(), cron: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  reglaAlerta: { findMany: m.rules }, intercambioInspeccion: { findMany: m.requests, findUnique: m.request },
  transportista: { findMany: m.actors, findUnique: m.actor }, operador: { findMany: m.actors, findUnique: m.actor },
  vehiculo: { findMany: m.actors, findUnique: m.actor }, chofer: { findMany: m.actors, findUnique: m.actor },
  alertaGenerada: { findMany: m.cases }, $transaction: m.transaction,
} }));
vi.mock('node-cron', () => ({ default: { schedule: m.cron } }));
import { ejecutarCatalogo, simularCatalogo, iniciarAlertCatalogueJob } from '../../jobs/alertCatalogue.job';
const now = new Date('2026-10-04T12:00:00Z');
const rule = { id: 'rule', nombre: 'Requerimiento vencido', evento: 'TIEMPO_EXCESIVO', condicion: '{"tipo":"requerimiento_inspeccion"}', destinatarios: '["INSPECCIONADO","INSPECTOR_ASIGNADO","ADMIN_GENERADOR","ADMIN_OPERADOR"]' };
const request = { id: 'req', tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', destinatario: 'INSPECCIONADO', asunto: 'QA requerimiento', plazoRespuestaAt: new Date('2026-10-01T12:00:00Z'), respuestas: [],
  inspeccion: { id: 'inspection', numero: 'GRP-QA', estado: 'NOTIFICADA', tipoActor: 'GENERADOR', generadorId: 'g1', inspectorId: 'inspector',
    inspector: { id: 'inspector', rol: 'GENERADOR', esInspector: true, activo: true }, generador: { id: 'g1', activo: true, usuario: { id: 'owner', activo: true } } } };
beforeEach(() => {
  vi.clearAllMocks(); m.rules.mockResolvedValue([rule]); m.requests.mockResolvedValue([{ id: 'req' }]); m.request.mockResolvedValue(request);
  m.currentRule.mockImplementation(async () => ({ ...(await m.rules())[0], activa: true }));
  m.cases.mockResolvedValue([]); m.upsert.mockResolvedValue({ estado: 'PENDIENTE' }); m.admins.mockResolvedValue([{ id: 'sector' }]);
  m.actors.mockResolvedValue([{ id: 'obj' }]); m.actor.mockResolvedValue({ id: 'obj', activo: true, usuarioId: 'operator', usuario: { activo: true }, razonSocial: 'QA operador', vencimientoHabilitacion: new Date('2026-10-01T12:00:00Z') });
  m.transaction.mockImplementation(fn => fn({ reglaAlerta: { findUnique: m.currentRule }, intercambioInspeccion: { findUnique: m.request }, operador: { findUnique: m.actor }, transportista: { findUnique: m.actor }, vehiculo: { findUnique: m.actor }, chofer: { findUnique: m.actor },
    alertaGenerada: { upsert: m.upsert, updateMany: m.reconcile }, notificacion: { upsert: m.notice }, usuario: { findMany: m.admins } }));
});
it('notifies only the linked actor, assigned inspector and selected matching administration', async () => {
  expect(await ejecutarCatalogo(now)).toBe(3);
  expect(m.notice.mock.calls.map(([arg]) => arg.create.usuarioId)).toEqual(['owner', 'inspector', 'sector']);
  expect(m.admins.mock.calls[0][0].where.rol.in).toEqual(['ADMIN_GENERADOR']);
  expect(JSON.parse(m.notice.mock.calls[0][0].create.datos)).toMatchObject({ destino: 'participacion', inspeccionId: 'inspection', entidadId: 'req' });
  expect(JSON.parse(m.notice.mock.calls[1][0].create.datos).destino).toBe('inspeccion');
});
it('simulation does not create rules, cases or notices', async () => {
  expect(await simularCatalogo(rule.condicion, now)).toMatchObject({ total: 1, escribeDatos: false });
  expect(m.transaction).not.toHaveBeenCalled(); expect(m.upsert).not.toHaveBeenCalled(); expect(m.notice).not.toHaveBeenCalled();
});
it('displays afternoon deadlines in unambiguous 24-hour Mendoza time', async () => {
  m.request.mockResolvedValue({ ...request, plazoRespuestaAt: new Date('2026-10-03T22:30:00Z') });
  await ejecutarCatalogo(now);
  expect(m.notice.mock.calls[0][0].create.mensaje).toContain('19:30:00 (Mendoza)');
});
it('retries preserve case snapshot, decision and notification read state', async () => {
  await ejecutarCatalogo(now); await ejecutarCatalogo(new Date('2026-10-05T12:00:00Z'));
  expect(m.upsert.mock.calls[0][0].where).toEqual(m.upsert.mock.calls[1][0].where);
  expect(m.upsert.mock.calls[1][0].update).toEqual({ id: m.upsert.mock.calls[1][0].where.id });
  expect(m.notice.mock.calls[3][0].update).not.toHaveProperty('leida');
});
it.each(['RESUELTA', 'DESCARTADA'])('never renotifies a %s case', async estado => {
  m.upsert.mockResolvedValue({ estado }); expect(await ejecutarCatalogo(now)).toBe(0); expect(m.notice).not.toHaveBeenCalled();
});
it('rereads after scanning so a now-answered request does not produce a notice', async () => {
  m.request.mockResolvedValueOnce(request).mockResolvedValue({ ...request, respuestas: [{ parte: 'INSPECCIONADO', tipo: 'RESPUESTA' }] });
  expect(await ejecutarCatalogo(now)).toBe(0); expect(m.upsert).not.toHaveBeenCalled();
});
it('an inactive or unrelated assignee is not notified, nor is an unidentified actor invented', async () => {
  m.request.mockResolvedValue({ ...request, inspeccion: { ...request.inspeccion, tipoActor: null, generador: null, inspector: { id: 'other', rol: 'GENERADOR', esInspector: true, activo: true } } });
  m.admins.mockResolvedValue([]); expect(await ejecutarCatalogo(now)).toBe(0); expect(m.notice).not.toHaveBeenCalled();
});
it('operator expiry uses its own owner, includes already overdue sources and no manifest', async () => {
  m.rules.mockResolvedValue([{ ...rule, evento: 'VENCIMIENTO', condicion: '{"tipo":"vencimiento_documental","anticipacionDias":30,"entidades":["OPERADOR"]}', destinatarios: '["OPERADOR"]' }]);
  expect(await ejecutarCatalogo(now)).toBe(1);
  expect(m.notice.mock.calls[0][0].create).toMatchObject({ usuarioId: 'operator', tipo: 'INFO_GENERAL' });
  expect(JSON.parse(m.notice.mock.calls[0][0].create.datos)).toMatchObject({ estadoDetectado: 'VENCIDO', actorId: 'obj', destino: 'perfil' });
  expect(m.requests).not.toHaveBeenCalled();
});
it('renewal resolves the former case without changing its source or creating daily duplicates', async () => {
  m.rules.mockResolvedValue([{ ...rule, evento: 'VENCIMIENTO', condicion: '{"tipo":"vencimiento_documental","anticipacionDias":30,"entidades":["OPERADOR"]}', destinatarios: '["OPERADOR"]' }]);
  await ejecutarCatalogo(now); const old = m.upsert.mock.calls[0][0].create; m.cases.mockResolvedValue([old]);
  m.actor.mockResolvedValue({ id: 'obj', activo: true, usuarioId: 'operator', usuario: { activo: true }, razonSocial: 'QA operador', vencimientoHabilitacion: new Date('2027-01-01T12:00:00Z') });
  m.notice.mockClear(); await ejecutarCatalogo(now); expect(m.reconcile.mock.calls[0][0].data).toMatchObject({ estado: 'RESUELTA', resueltaPor: null }); expect(m.notice).not.toHaveBeenCalled();
});
it('database failure propagates, never claiming an empty or successful evaluation', async () => {
  m.notice.mockRejectedValueOnce(new Error('storage failed')); await expect(ejecutarCatalogo(now)).rejects.toThrow('storage failed');
});
it('deactivating a rule during its scan stops new cases/notices', async () => {
  m.currentRule.mockResolvedValue({ ...rule, activa: false });
  expect(await ejecutarCatalogo(now)).toBe(0); expect(m.upsert).not.toHaveBeenCalled(); expect(m.notice).not.toHaveBeenCalled();
});
it('preview counts past the first page but retains only twenty examples', async () => {
  m.requests.mockResolvedValueOnce(Array.from({ length: 100 }, (_, index) => ({ id: 'req' + index }))).mockResolvedValueOnce([{ id: 'req100' }]);
  m.request.mockImplementation(async ({ where }) => ({ ...request, id: where.id }));
  const preview = await simularCatalogo(rule.condicion, now);
  expect(preview.total).toBe(101); expect(preview.ejemplos).toHaveLength(20);
  expect(m.requests.mock.calls[1][0]).toMatchObject({ cursor: { id: 'req99' }, skip: 1, take: 100 });
});
it('skips inactive rules and schedules only once on the designated instance, not on startup', async () => {
  m.rules.mockResolvedValue([]); expect(await ejecutarCatalogo(now)).toBe(0); expect(m.requests).not.toHaveBeenCalled();
  const previous = process.env.NODE_APP_INSTANCE;
  try { process.env.NODE_APP_INSTANCE = 'qa'; iniciarAlertCatalogueJob(); expect(m.cron).not.toHaveBeenCalled();
    process.env.NODE_APP_INSTANCE = '0'; iniciarAlertCatalogueJob(); expect(m.cron).toHaveBeenCalledWith('5 8 * * *', expect.any(Function), { timezone: 'America/Argentina/Mendoza' });
  } finally { if (previous === undefined) delete process.env.NODE_APP_INSTANCE; else process.env.NODE_APP_INSTANCE = previous; }
});
