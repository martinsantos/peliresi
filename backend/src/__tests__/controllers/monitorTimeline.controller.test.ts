import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ events: vi.fn(), gps: vi.fn(), manifests: vi.fn(), actors: vi.fn() }));
vi.mock('@prisma/client', () => ({ PrismaClient: class {
  eventoManifiesto = { findMany: db.events };
  manifiesto = { findMany: db.manifests };
  generador = { findMany: db.actors }; transportista = { findMany: db.actors }; operador = { findMany: db.actors };
  $queryRawUnsafe = db.gps;
} }));
import { getTimeline } from '../../controllers/monitor.controller';
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
