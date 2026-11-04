import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ originals: vi.fn(), legs: vi.fn(), originalCount: vi.fn(), legCount: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  manifiesto: { findMany: mocks.originals, count: mocks.originalCount },
  tramoTransporte: { findMany: mocks.legs, count: mocks.legCount },
} }));
import { transportGpsTargets } from '../../controllers/transport-gps-session.controller';

const req = (user = { rol: 'TRANSPORTISTA', transportista: { id: 'mine' } }, query = {}) => ({ user, query }) as any;
const res = () => ({ json: vi.fn(), setHeader: vi.fn() }) as any;
beforeEach(() => {
  vi.clearAllMocks(); mocks.originals.mockResolvedValue([]); mocks.legs.mockResolvedValue([]);
  mocks.originalCount.mockResolvedValue(0); mocks.legCount.mockResolvedValue(0);
});

it('denies missing carrier associations and other roles before reading any loads', async () => {
  for (const user of [{ rol: 'ADMIN' }, { rol: 'OPERADOR' }, { rol: 'TRANSPORTISTA' }]) {
    const next = vi.fn(); await transportGpsTargets(req(user as any), res(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  }
  expect(mocks.originals).not.toHaveBeenCalled(); expect(mocks.legs).not.toHaveBeenCalled();
});

it('scopes original and replacement loads independently, applies search and excludes handed-off originals', async () => {
  const response = res(), next = vi.fn(); await transportGpsTargets(req(undefined, { search: ' QA-42 ' }), response, next);
  expect(next).not.toHaveBeenCalled();
  expect(mocks.originals).toHaveBeenCalledWith(expect.objectContaining({ where: {
    transportistaId: 'mine', estado: 'EN_TRANSITO', numero: { contains: 'QA-42', mode: 'insensitive' },
    tramosTransporte: { none: { fin: null, tipo: { not: 'ORIGINAL' } } },
  }, take: 100 }));
  expect(mocks.legs).toHaveBeenCalledWith(expect.objectContaining({ where: {
    transportistaId: 'mine', tipo: 'REGISTRADO', fin: null,
    manifiesto: { estado: 'EN_TRANSITO', numero: { contains: 'QA-42', mode: 'insensitive' } },
  } }));
  expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
});

it('returns only limited target information and does not offer an expired replacement link', async () => {
  mocks.originals.mockResolvedValue([{ id: 'a', numero: 'QA-1', fechaRetiro: new Date(), transportistaId: 'mine', asignacionTransporte: null, generador: { razonSocial: 'QA origen' }, operador: { razonSocial: 'QA destino' } }]);
  mocks.legs.mockResolvedValue([{ id: 'b', manifiestoId: 'private-manifest', inicio: new Date(), datos: { patente: 'QA-MOVIL' }, accesoVersion: 'secret', accesoHasta: new Date(0), manifiesto: { numero: 'QA-2', operador: { razonSocial: 'QA destino' } } }]);
  const response = res(); await transportGpsTargets(req(), response, vi.fn());
  const loads = response.json.mock.calls[0][0].data.targets;
  expect(loads.find((l: any) => l.id === 'a')).toMatchObject({ puedeEntregar: true, gpsDisponible: true });
  expect(loads.find((l: any) => l.id === 'b')).toMatchObject({ puedeEntregar: false, gpsDisponible: false, patente: 'QA-MOVIL' });
  expect(JSON.stringify(loads)).not.toMatch(/secret|private-manifest|accesoVersion|usuarioId|residuos/);
});

it('refuses invalid search shapes instead of querying all loads', async () => {
  const next = vi.fn(); await transportGpsTargets(req(undefined, { search: ['a', 'b'] }), res(), next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 })); expect(mocks.originals).not.toHaveBeenCalled();
});
