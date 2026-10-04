import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ scan: vi.fn(), current: vi.fn(), upsert: vi.fn(), transaction: vi.fn(), schedule: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { manifiesto: { findMany: mocks.scan }, $transaction: mocks.transaction } }));
vi.mock('node-cron', () => ({ default: { schedule: mocks.schedule } }));
import { ejecutarSeguimientoCierre, iniciarSeguimientoCierreJob } from '../../jobs/seguimientoCierre.job';
beforeEach(() => {
  vi.clearAllMocks(); mocks.scan.mockResolvedValue([{ id: 'qa' }]);
  mocks.current.mockResolvedValue({ id: 'qa', numero: 'QA', estado: 'RECIBIDO', fechaRecepcion: new Date('2026-10-01T12:00:00Z'), operador: { usuario: { id: 'operator', activo: true } } });
  mocks.transaction.mockImplementation(fn => fn({ manifiesto: { findUnique: mocks.current }, notificacion: { upsert: mocks.upsert } }));
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
