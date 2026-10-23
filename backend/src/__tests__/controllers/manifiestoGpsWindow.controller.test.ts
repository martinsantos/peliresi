import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ manifest: vi.fn(), points: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { manifiesto: { findUnique: db.manifest }, trackingGPS: { findMany: db.points } } }));
vi.mock('../../controllers/notification.controller', () => ({ anomaliaDetector: { detectarAnomalias: vi.fn() } }));
vi.mock('../../services/domainEvent.service', () => ({ domainEvents: { emit: vi.fn() } }));
import { getViajeActual } from '../../controllers/manifiesto-gps.controller';
const manifest = { id: 'qa-window', estado: 'EN_TRANSITO', generadorId: 'gen', transportistaId: 'carrier', operadorId: 'op' };
const request = (carrier = 'carrier') => ({ params: { id: manifest.id }, user: { id: 'qa-user', rol: 'TRANSPORTISTA', transportista: { id: carrier } } });
const makePoints = (count: number, tied = false) => Array.from({ length: count }, (_, index) => ({
  id: `qa-${String(index).padStart(6, '0')}`, manifiestoId: manifest.id,
  latitud: -32.88, longitud: -68.84, timestamp: new Date(Date.UTC(2026, 9, 23, 12, 0, tied ? 0 : index)),
  tramoId: index >= 500 ? 'qa-relay' : null,
}));
function store(points: ReturnType<typeof makePoints>) {
  // The mock honors the requested ordering/limit: the former asc+500 query
  // fails the latest-point assertion instead of being accidentally accepted.
  db.points.mockImplementation(async query => {
    const fields = Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy];
    const ordered = [...points].sort((a, b) => {
      for (const field of fields) {
        const [key, direction] = Object.entries(field)[0];
        const av = a[key as keyof typeof a], bv = b[key as keyof typeof b];
        const left = av instanceof Date ? av.getTime() : av;
        const right = bv instanceof Date ? bv.getTime() : bv;
        const comparison = left === right ? 0 : left! < right! ? -1 : 1;
        if (comparison) return direction === 'desc' ? -comparison : comparison;
      }
      return 0;
    });
    return ordered.slice(0, query.take);
  });
}
async function invoke(carrier = 'carrier') {
  const res = { json: vi.fn() }, next = vi.fn();
  await getViajeActual(request(carrier) as never, res as never, next);
  return { body: res.json.mock.calls[0]?.[0], res, next };
}
beforeEach(() => { vi.clearAllMocks(); db.manifest.mockResolvedValue(manifest); db.points.mockResolvedValue([]); });

describe('current trip returns a bounded latest GPS window', () => {
  it.each([0, 1, 499, 500, 501, 1201])('returns the most recent points in chronological order for %s persisted observations', async count => {
    const points = makePoints(count); store(points);
    const { body, next } = await invoke();
    expect(next).not.toHaveBeenCalled();
    expect(body.data).toEqual(points.slice(-500));
    expect(body.ventana).toEqual({ tipo: 'ULTIMOS_PUNTOS', limite: 500, orden: 'timestamp_asc_id_asc', hayAnteriores: count > 500, desde: points.slice(-500)[0]?.timestamp ?? null, hasta: points[count - 1]?.timestamp ?? null });
    expect(db.points).toHaveBeenCalledWith({ where: { manifiestoId: manifest.id }, orderBy: [{ timestamp: 'desc' }, { id: 'desc' }], take: 501 });
  });
  it('resolves equal timestamps by ID consistently across reads and incremental samples', async () => {
    const points = makePoints(501, true); store([...points].reverse());
    const first = (await invoke()).body.data;
    expect(first.map((p: any) => p.id)).toEqual(points.slice(-500).map(p => p.id));
    expect((await invoke()).body.data).toEqual(first);
    const expanded = makePoints(502, true); store(expanded);
    const next = (await invoke()).body.data;
    expect(next.map((p: any) => p.id)).toEqual(expanded.slice(-500).map(p => p.id));
    expect(new Set(next.map((p: any) => p.id)).size).toBe(500);
  });
  it('preserves leg attribution and late old observations cannot displace newer ones', async () => {
    const points = makePoints(520), old = { ...points[0], id: 'late-old' };
    store([...points, old]);
    const { body } = await invoke();
    expect(body.data[body.data.length - 1]).toEqual(points[519]);
    expect(body.data.some((p: any) => p.id === old.id)).toBe(false);
    expect(body.data.filter((p: any) => p.tramoId === 'qa-relay')).toHaveLength(20);
  });
  it('rejects a foreign actor before reading any GPS observation', async () => {
    const { res, next } = await invoke('foreign');
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(db.points).not.toHaveBeenCalled(); expect(res.json).not.toHaveBeenCalled();
  });
  it('reports a query failure without claiming an empty successful route', async () => {
    const error = new Error('QA database unavailable'); db.points.mockRejectedValue(error);
    const { res, next } = await invoke();
    expect(next).toHaveBeenCalledWith(error); expect(res.json).not.toHaveBeenCalled();
  });
});
