import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ scan: vi.fn(), count: vi.fn(), current: vi.fn(), upsert: vi.fn(), transaction: vi.fn(), schedule: vi.fn(), rules: vi.fn(), rule: vi.fn(), adopt: vi.fn(), admin: vi.fn(), admins: vi.fn(), cases: vi.fn(), reconcile: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { manifiesto: { findMany: mocks.scan, count: mocks.count }, reglaAlerta: { findMany: mocks.rules, findUnique: mocks.rule, upsert: mocks.adopt }, usuario: { findFirst: mocks.admin }, alertaGenerada: { updateMany: mocks.reconcile }, $transaction: mocks.transaction } }));
vi.mock('node-cron', () => ({ default: { schedule: mocks.schedule } }));
import { ejecutarSeguimientoCierre, iniciarSeguimientoCierreJob, simularSeguimientoCierre } from '../../jobs/seguimientoCierre.job';
beforeEach(() => {
  vi.clearAllMocks(); mocks.scan.mockResolvedValue([{ id: 'qa' }]);
  mocks.rule.mockResolvedValue({ id: 'seguimiento_cierre_v1' });
  mocks.rules.mockResolvedValue([{ id: 'seguimiento_cierre_v1', nombre: 'Seguimiento de manifiesto', evento: 'TIEMPO_EXCESIVO', condicion: '{"tipo":"seguimiento_cierre","diasRecepcion":{"gte":0}}', destinatarios: '["OPERADOR"]' }]);
  mocks.cases.mockResolvedValue({ estado: 'PENDIENTE' }); mocks.admins.mockResolvedValue([]);
  mocks.current.mockResolvedValue({ id: 'qa', numero: 'QA', estado: 'RECIBIDO', fechaRecepcion: new Date('2026-10-01T12:00:00Z'), operador: { usuario: { id: 'operator', activo: true } } });
  mocks.transaction.mockImplementation(fn => fn({ manifiesto: { findUnique: mocks.current }, notificacion: { upsert: mocks.upsert }, alertaGenerada: { upsert: mocks.cases }, usuario: { findMany: mocks.admins } }));
});
it('links the operator notice and administrative case without resetting case state on retry', async () => {
  await ejecutarSeguimientoCierre();
  const notice = JSON.parse(mocks.upsert.mock.calls[0][0].create.datos);
  expect(notice.casoId).toBe(mocks.cases.mock.calls[0][0].where.id);
  expect(mocks.cases.mock.calls[0][0].update).not.toHaveProperty('estado');
});
it('disabled rules stop follow-up and do not scan all manifests', async () => {
  mocks.rules.mockResolvedValue([]); expect(await ejecutarSeguimientoCierre()).toBe(0);
  expect(mocks.scan).not.toHaveBeenCalled(); expect(mocks.upsert).not.toHaveBeenCalled();
});
it.each(['RESUELTA', 'DESCARTADA'])('does not re-notify a %s case on the next evaluation', async estado => {
  mocks.cases.mockResolvedValue({ estado }); expect(await ejecutarSeguimientoCierre()).toBe(0); expect(mocks.upsert).not.toHaveBeenCalled();
});
it('requires measured reception age to meet a positive threshold', async () => {
  mocks.rules.mockResolvedValue([{ id: 'custom', nombre: '3 días', evento: 'TIEMPO_EXCESIVO', condicion: '{"tipo":"seguimiento_cierre","diasRecepcion":{"gte":3}}', destinatarios: '["OPERADOR"]' }]);
  expect(await ejecutarSeguimientoCierre(new Date('2026-10-02T12:00:00Z'))).toBe(0);
  expect(await ejecutarSeguimientoCierre(new Date('2026-10-04T12:00:00Z'))).toBe(1);
});
it('preview counts source rows without adopting a rule or writing notices/cases', async () => {
  mocks.count.mockResolvedValue(125);
  expect(await simularSeguimientoCierre(3, new Date('2026-10-04T12:00:00Z'))).toMatchObject({ total: 125, escribeDatos: false, canal: 'interno' });
  expect(mocks.scan.mock.calls[0][0]).toMatchObject({ take: 20, where: { fechaRecepcion: { lte: new Date('2026-10-01T12:00:00Z') } } });
  expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.adopt).not.toHaveBeenCalled(); expect(mocks.cases).not.toHaveBeenCalled();
});
it('adopts the existing follow-up once using an active administrator, preserving default notice identity', async () => {
  mocks.rule.mockResolvedValue(null); mocks.admin.mockResolvedValue({ id: 'admin' });
  await ejecutarSeguimientoCierre(); expect(mocks.adopt.mock.calls[0][0]).toMatchObject({ where: { id: 'seguimiento_cierre_v1' }, update: {}, create: { creadoPorId: 'admin', destinatarios: '["OPERADOR"]' } });
});
it('creates a normal internal follow-up for the responsible operator with measured time and actionable link', async () => {
  expect(await ejecutarSeguimientoCierre(new Date('2026-10-04T12:00:00Z'))).toBe(1);
  expect(mocks.upsert.mock.calls[0][0].create).toMatchObject({ usuarioId: 'operator', manifiestoId: 'qa', tipo: 'INFO_GENERAL', prioridad: 'NORMAL' });
  expect(mocks.upsert.mock.calls[0][0].create.mensaje).toContain('Recibido hace 3 días');
});
it('repeated runs use the same unique key and preserve read state, never creating one notice per day', async () => {
  await ejecutarSeguimientoCierre(); await ejecutarSeguimientoCierre();
  expect(mocks.upsert.mock.calls[0][0].where).toEqual(mocks.upsert.mock.calls[1][0].where);
  expect(mocks.upsert.mock.calls[1][0].update).not.toHaveProperty('leida');
});
it.each(['TRATADO', 'CANCELADO', 'BORRADOR', 'APROBADO'])('does not notify a manifest now in %s', async estado => {
  mocks.current.mockResolvedValue({ estado }); await ejecutarSeguimientoCierre(); expect(mocks.upsert).not.toHaveBeenCalled();
});
it('missing reception time is not zero days or an invented overdue status', async () => {
  mocks.current.mockResolvedValue({ id: 'qa', numero: 'QA', estado: 'EN_TRATAMIENTO', fechaRecepcion: null, operador: { usuario: { id: 'operator', activo: true } } });
  await ejecutarSeguimientoCierre(); expect(mocks.upsert.mock.calls[0][0].create.mensaje).toContain('Sin fecha de recepción válida');
});
it('inactive recipients do not receive follow-up', async () => {
  mocks.current.mockResolvedValue({ estado: 'RECIBIDO', operador: { usuario: { activo: false } } });
  await ejecutarSeguimientoCierre(); expect(mocks.upsert).not.toHaveBeenCalled();
});
it('paginates without losing the records after the first hundred', async () => {
  mocks.scan.mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({ id: String(i) }))).mockResolvedValueOnce([{ id: '100' }]);
  expect(await ejecutarSeguimientoCierre()).toBe(101);
  expect(mocks.scan.mock.calls[1][0]).toMatchObject({ cursor: { id: '99' }, skip: 1, take: 100 });
});
it('a missing record after scanning is not a task', async () => {
  mocks.current.mockResolvedValue(null); expect(await ejecutarSeguimientoCierre()).toBe(0);
  expect(mocks.upsert).not.toHaveBeenCalled();
});
it('storage failures propagate for the scheduler to report rather than reporting success', async () => {
  mocks.upsert.mockRejectedValueOnce(new Error('storage failure'));
  await expect(ejecutarSeguimientoCierre()).rejects.toThrow('storage failure');
});
it('a future reception time does not invent a negative elapsed time', async () => {
  await ejecutarSeguimientoCierre(new Date('2026-09-01T12:00:00Z'));
  expect(mocks.upsert.mock.calls[0][0].create.mensaje).toContain('Sin fecha de recepción válida');
});
it('only the designated process schedules the Mendoza daily sweep', () => {
  const before = process.env.NODE_APP_INSTANCE;
  try {
    process.env.NODE_APP_INSTANCE = 'qa'; iniciarSeguimientoCierreJob(); expect(mocks.schedule).not.toHaveBeenCalled();
    process.env.NODE_APP_INSTANCE = '0'; iniciarSeguimientoCierreJob(); expect(mocks.schedule).toHaveBeenCalledWith('0 8 * * *', expect.any(Function), { timezone: 'America/Argentina/Mendoza' });
  } finally { if (before === undefined) delete process.env.NODE_APP_INSTANCE; else process.env.NODE_APP_INSTANCE = before; }
});
