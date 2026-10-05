import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ events: vi.fn(), gps: vi.fn(), manifests: vi.fn(), actors: vi.fn() }));
vi.mock('@prisma/client', () => ({ PrismaClient: class {
  eventoManifiesto = { findMany: db.events };
  manifiesto = { findMany: db.manifests };
  generador = { findMany: db.actors }; transportista = { findMany: db.actors }; operador = { findMany: db.actors };
  $queryRawUnsafe = db.gps;
} }));
import { getActiveDays, getTimeline } from '../../controllers/monitor.controller';
beforeEach(() => { vi.clearAllMocks(); for (const f of Object.values(db)) f.mockResolvedValue([]); });
const run = async (query: object) => {
  const res = { status: vi.fn(), json: vi.fn() }; res.status.mockReturnValue(res);
  await getTimeline({ query } as any, res as any); return res;
};
it('30 calendar days use Mendoza midnight and an exclusive next-day boundary, not seven days or 31 days', async () => {
  const res = await run({ fecha: '2026-09-05', dias: '30' });
  expect(res.status).not.toHaveBeenCalled();
  expect(db.events.mock.calls[0][0].where.createdAt).toEqual({
    gte: new Date('2026-09-05T00:00:00-03:00'), lt: new Date('2026-10-05T00:00:00-03:00'),
  });
  expect(db.gps.mock.calls[0].slice(1)).toEqual([new Date('2026-09-05T00:00:00-03:00'), new Date('2026-10-05T00:00:00-03:00'), 0]);
});
it.each([{ fecha: '2026-02-30' }, { fecha: 'junk' }, { fecha: '2026-10-04', dias: '31' }, { fecha: '2026-10-04', dias: '0' }, { fecha: '2026-10-04', dias: '3junk' }])('rejects invalid calendar/range before DB access: %j', async query => {
  const res = await run(query); expect(res.status).toHaveBeenCalledWith(400); expect(db.events).not.toHaveBeenCalled();
});
it('reports a clipped history explicitly instead of certifying a complete movie', async () => {
  db.gps.mockResolvedValue(Array.from({ length: 2001 }, (_, i) => ({ id: String(i), manifiestoId: 'qa', manifiestoNumero: 'QA', latitud: -32, longitud: -68, timestamp: new Date('2026-10-04T12:00:00Z') })));
  const res = await run({ fecha: '2026-10-04' });
  expect(res.json.mock.calls[0][0].data.resumen).toMatchObject({ incompleto: true, gpsRecortados: true, eventosRecortados: false, totalGpsPoints: 2000 });
  expect(res.json.mock.calls[0][0].data.paginacion.siguiente).toBe(2);
});
it('second page advances each stream independently without replaying its first page', async () => {
  const res = await run({ fecha: '2026-09-05', dias: '30', pagina: '2' });
  expect(db.events.mock.calls[0][0]).toMatchObject({ skip: 3000, take: 3001 });
  expect(db.gps.mock.calls[0][3]).toBe(2000);
  expect(res.json.mock.calls[0][0].data.paginacion.siguiente).toBeNull();
});
it('uses the identical cutoff for observations on later pages of a running month', async () => {
  await run({ fecha: '2026-09-05', dias: '30', pagina: '2', corte: '2026-10-04T12:00:00Z' });
  expect(db.events.mock.calls[0][0].where.createdAt.lt).toEqual(new Date('2026-10-04T12:00:00Z'));
  expect(db.gps.mock.calls[0][2]).toEqual(new Date('2026-10-04T12:00:00Z'));
});
it('rejects an invalid cutoff without querying the database', async () => {
  const res = await run({ fecha: '2026-10-04', corte: 'junk' });
  expect(res.status).toHaveBeenCalledWith(400); expect(db.events).not.toHaveBeenCalled();
});
it('active days use the same Mendoza calendar as playback, including observations with only GPS', async () => {
  db.gps.mockResolvedValue([{ fecha: '2026-10-04' }, { fecha: '2026-10-05' }]);
  const res = { status: vi.fn(), json: vi.fn() }; res.status.mockReturnValue(res);
  await getActiveDays({} as any, res as any);
  const [sql, cutoff] = db.gps.mock.calls[0];
  expect(sql.match(/AT TIME ZONE 'UTC' AT TIME ZONE 'America\/Argentina\/Mendoza'/g)).toHaveLength(3);
  for (const table of ['manifiestos', 'eventos_manifiesto', 'tracking_gps']) expect(sql).toContain('FROM ' + table);
  expect(sql).not.toContain('DATE("createdAt")');
  expect(cutoff).toBeInstanceOf(Date);
  expect(res.json).toHaveBeenCalledWith({ success: true, data: { days: ['2026-10-04', '2026-10-05'] } });
  expect(res.status).not.toHaveBeenCalled();
});
it('an empty active calendar stays empty, without inventing days or activity', async () => {
  const res = { status: vi.fn(), json: vi.fn() }; res.status.mockReturnValue(res);
  await getActiveDays({} as any, res as any);
  expect(res.json).toHaveBeenCalledWith({ success: true, data: { days: [] } });
});
it('active calendar query failure is explicit rather than a successful empty history', async () => {
  db.gps.mockRejectedValue(new Error('QA unavailable'));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const res = { status: vi.fn(), json: vi.fn() }; res.status.mockReturnValue(res);
    await getActiveDays({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Error al obtener días activos' });
  } finally { log.mockRestore(); }
});
