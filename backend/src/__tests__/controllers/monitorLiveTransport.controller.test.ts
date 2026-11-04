import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ manifests: vi.fn(), events: vi.fn(), actors: vi.fn(), count: vi.fn(), sql: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  manifiesto: { findMany: db.manifests, count: db.count },
  eventoManifiesto: { findMany: db.events },
  generador: { findMany: db.actors }, transportista: { findMany: db.actors }, operador: { findMany: db.actors },
  $queryRawUnsafe: db.sql,
} }));
import { getMonitorLive } from '../../controllers/monitor.controller';

const assignment = (plate: string, driver: string, carrier = 'carrier-1') => ({
  version: 1, transportistaId: carrier,
  vehiculo: { id: `vehicle-${plate}`, patente: plate, marca: 'QA', modelo: 'Carga' },
  chofer: { id: `driver-${driver}`, nombre: driver, apellido: 'QA', dni: '00000000' },
});
const point = (minute: number) => ({ latitud: -32.88, longitud: -68.84, velocidad: 20, direccion: 90, timestamp: new Date(`2026-10-23T12:${String(minute).padStart(2, '0')}:00Z`) });
const trip = (id: string, selection: unknown = assignment('QA001', 'Ana')) => ({
  id, numero: id, transportistaId: 'carrier-1', asignacionTransporte: selection,
  transportista: { razonSocial: 'QA Original', vehiculos: [{ patente: 'FLEET-WRONG' }], choferes: [{ nombre: 'Otra', apellido: 'Persona' }] },
  generador: { razonSocial: 'QA Generador', latitud: -32.9, longitud: -68.8 },
  operador: { razonSocial: 'QA Operador', latitud: -33.1, longitud: -68.7 },
  fechaRetiro: new Date('2026-10-23T11:00:00Z'), residuos: [], tracking: [point(2), point(1)], tramosTransporte: [] as any[],
});
const leg = (datos: unknown, tipo = 'EXTERNO', tracking: ReturnType<typeof point>[] = [point(5), point(4)]) => ({
  id: 'leg-1', orden: 1, tipo, transportistaId: tipo === 'REGISTRADO' ? 'carrier-2' : null,
  inicio: new Date('2026-10-23T12:03:00Z'), datos, tracking,
});
async function invoke(manifests: ReturnType<typeof trip>[]) {
  db.manifests.mockResolvedValue(manifests);
  const res = { status: vi.fn(), json: vi.fn() }; res.status.mockReturnValue(res);
  await getMonitorLive({} as never, res as never);
  expect(res.status).not.toHaveBeenCalled();
  return res.json.mock.calls[0][0].data.enTransito;
}
beforeEach(() => {
  vi.clearAllMocks(); db.manifests.mockResolvedValue([]); db.events.mockResolvedValue([]);
  db.actors.mockResolvedValue([]); db.sql.mockResolvedValue([]); db.count.mockResolvedValue(0);
});

describe('Monitor identifies the actual load assignment without guessing from fleet order', () => {
  it('distinguishes two vehicles and drivers from the same carrier and never changes the signed snapshot', async () => {
    const first = trip('QA-1', assignment('QA001', 'Ana'));
    const second = trip('QA-2', assignment('QA002', 'Bruno'));
    const before = JSON.stringify([first, second]);
    const rows = await invoke([first, second]);
    expect(rows.map((row: any) => [row.vehiculo.patente, row.chofer.nombre])).toEqual([['QA001', 'Ana QA'], ['QA002', 'Bruno QA']]);
    expect(JSON.stringify([first, second])).toBe(before);
    const select = db.manifests.mock.calls[0][0].select;
    expect(select.asignacionTransporte).toBe(true);
    expect(select.transportista.select).toEqual({ razonSocial: true });
  });
  it.each([null, { version: 1 }, assignment('FOREIGN', 'Ajeno', 'carrier-other')])('leaves missing or mismatched historical assignments absent: %j', async value => {
    const [row] = await invoke([trip('QA-legacy', value)]);
    expect(row.vehiculo).toBeNull(); expect(row.chofer).toBeNull();
    expect(row.transportista).toBe('QA Original');
  });
  it('preserves independent partial assignments instead of requiring both vehicle and driver', async () => {
    const vehicleOnly = { ...assignment('QA003', 'Ana'), chofer: null };
    const driverOnly = { ...assignment('QA004', 'Bruno'), vehiculo: null };
    const rows = await invoke([trip('QA-vehicle', vehicleOnly), trip('QA-driver', driverOnly)]);
    expect(rows[0].vehiculo.patente).toBe('QA003'); expect(rows[0].chofer).toBeNull();
    expect(rows[1].vehiculo).toBeNull(); expect(rows[1].chofer.nombre).toBe('Bruno QA');
  });
  it('uses a registered replacement snapshot and only that leg GPS without mutating its input', async () => {
    const manifest = trip('QA-relay');
    manifest.tramosTransporte = [leg({ empresa: 'QA Reemplazo', patente: 'DECLARED-OLD', chofer: 'Dato anterior', registro: assignment('QA009', 'Carla', 'carrier-2') }, 'REGISTRADO')];
    const before = JSON.stringify(manifest);
    const [row] = await invoke([manifest]);
    expect(row).toMatchObject({ transportista: 'QA Reemplazo', transportistaOriginal: 'QA Original', vehiculo: { patente: 'QA009', descripcion: 'QA Carga' }, chofer: { nombre: 'Carla QA' }, tramoActual: { id: 'leg-1', tipo: 'REGISTRADO', gpsRecibido: true } });
    expect(row.ultimaPosicion).toEqual(point(5));
    expect(row.ruta.map((p: any) => p.timestamp)).toEqual([point(4).timestamp, point(5).timestamp]);
    expect(JSON.stringify(manifest)).toBe(before);
    expect(db.manifests.mock.calls[0][0].select.tramosTransporte).toMatchObject({ where: { fin: null }, orderBy: { orden: 'desc' }, take: 1, select: { tracking: { orderBy: [{ timestamp: 'desc' }, { id: 'desc' }], take: 30 } } });
  });
  it('uses external declared vehicle/driver and does not attribute original GPS before its first signal', async () => {
    const manifest = trip('QA-external');
    manifest.tramosTransporte = [leg({ empresa: 'QA Eventual', patente: 'EXT008', chofer: 'Diego QA' }, 'EXTERNO', [])];
    const [row] = await invoke([manifest]);
    expect(row).toMatchObject({ transportista: 'QA Eventual', vehiculo: { patente: 'EXT008', descripcion: '' }, chofer: { nombre: 'Diego QA' }, tramoActual: { gpsRecibido: false } });
    expect(row.ultimaPosicion).toBeNull(); expect(row.ruta).toEqual([]);
  });
  it('does not fall back to original vehicle/driver when an external declaration is incomplete', async () => {
    const manifest = trip('QA-incomplete'); manifest.tramosTransporte = [leg({})];
    const [row] = await invoke([manifest]);
    expect(row.vehiculo).toBeNull(); expect(row.chofer).toBeNull();
    expect(row.transportista).toBe('Transportista eventual sin nombre declarado');
  });
  it('uses deterministic recent original points and leaves the route in chronological order', async () => {
    const [row] = await invoke([trip('QA-original')]);
    expect(row.ultimaPosicion).toEqual(point(2));
    expect(row.ruta.map((p: any) => p.timestamp)).toEqual([point(1).timestamp, point(2).timestamp]);
    expect(db.manifests.mock.calls[0][0].select.tracking).toMatchObject({ where: { tramoId: null }, orderBy: [{ timestamp: 'desc' }, { id: 'desc' }], take: 30 });
  });
});
