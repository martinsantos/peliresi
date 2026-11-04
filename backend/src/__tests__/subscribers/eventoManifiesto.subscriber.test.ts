import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvent } from '../../services/domainEvent.service';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  query: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
}));
vi.mock('../../lib/prisma', () => ({ default: { $transaction: mocks.transaction } }));
import { eventoManifiestoSubscriber } from '../../subscribers/eventoManifiesto.subscriber';

const tx = {
  $queryRaw: mocks.query,
  eventoManifiesto: { findFirst: mocks.find, create: mocks.create },
};
const windowMs = 30 * 60 * 1000;
const dbNow = new Date('2026-10-23T13:00:00.000Z');
type Incident = { id: string; manifiestoId: string; usuarioId: string; tipo: string; descripcion: string; createdAt: Date };
let rows: Incident[];

const anomaly = (tipoAnomalia: string, descripcion = 'Misma observación'): DomainEvent => ({
  type: 'ANOMALIA_GPS', manifiestoId: 'manifest-1', userId: 'carrier-1', tipoAnomalia, descripcion, severidad: 'ALTA',
});
const corridor = (manifiestoId = 'manifest-1', descripcion = 'Misma observación'): DomainEvent => ({
  type: 'ANOMALIA_GPS', manifiestoId, userId: 'carrier-1', tipoAnomalia: 'FUERA_CORREDOR_GEOGRAFICO', descripcion, severidad: 'ALTA',
});
const sql = (query: TemplateStringsArray) => query.join('');
const lockCalls = () => mocks.query.mock.calls.filter(([query]) => sql(query).includes('pg_advisory_xact_lock'));

beforeEach(() => {
  vi.resetAllMocks();
  rows = [];
  mocks.transaction.mockImplementation((work: (client: typeof tx) => unknown) => work(tx));
  mocks.query.mockImplementation(async (query: TemplateStringsArray) => sql(query).includes('clock_timestamp') ? [{ now: dbNow }] : []);
  mocks.find.mockImplementation(async ({ where }) => {
    // Model the literal LIKE prefix and inclusive cutoff, not PostgreSQL locking.
    // Cross-process atomicity is exercised separately against the preview DB.
    const prefix = where.descripcion.startsWith.replace(/\\([\\%_])/g, '$1');
    return rows.find(row => row.manifiestoId === where.manifiestoId && row.tipo === where.tipo
      && row.descripcion.startsWith(prefix) && row.createdAt >= where.createdAt.gte) || null;
  });
  mocks.create.mockImplementation(async ({ data }) => {
    const row = { id: `event-${rows.length + 1}`, ...data };
    rows.push(row);
    return row;
  });
});
afterEach(() => vi.restoreAllMocks());

describe('GPS incident deduplication transaction', () => {
  it('does not attribute an anonymous relay observation to an unrelated user', async () => {
    await eventoManifiestoSubscriber({ type: 'ANOMALIA_GPS', manifiestoId: 'manifest-1',
      tipoAnomalia: 'GPS_PERDIDO', descripcion: 'Verificar recepción', severidad: 'MEDIA' });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });
  it.each([
    [anomaly('FUERA_CORREDOR_GEOGRAFICO'), 'Anomalía GPS detectada (FUERA_CORREDOR_GEOGRAFICO): Misma observación'],
    [{ type: 'DESVIO_RUTA', manifiestoId: 'manifest-1', userId: 'carrier-1', numero: 'QA-1', distanciaKm: 3.26, latActual: -32.9, lonActual: -68.8 } as DomainEvent,
      'Desvío de ruta detectado: 3.3 km fuera del corredor'],
  ])('retains the incident contents for $type', async (event, descripcion) => {
    await eventoManifiestoSubscriber(event);
    expect(rows).toEqual([{ id: 'event-1', manifiestoId: 'manifest-1', usuarioId: 'carrier-1', tipo: 'INCIDENTE', descripcion, createdAt: dbNow }]);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted', maxWait: 10_000, timeout: 10_000,
    });
  });

  it('awaits the database lock before reading the clock or the existing incident', async () => {
    let unlock!: () => void;
    const blocked = new Promise<void>(resolve => { unlock = resolve; });
    mocks.query.mockImplementation(async (query: TemplateStringsArray) => {
      if (sql(query).includes('pg_advisory_xact_lock')) { await blocked; return []; }
      return [{ now: dbNow }];
    });
    const pending = eventoManifiestoSubscriber(corridor());
    await Promise.resolve();
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    unlock();
    await pending;
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(rows).toHaveLength(1);
  });

  it.each([
    [windowMs - 1, false],
    [windowMs, false],
    [windowMs + 1, true],
  ])('keeps the inclusive 30 minute window at age %i ms', async (age, shouldCreate) => {
    const historical = {
      id: 'historical', manifiestoId: 'manifest-1', usuarioId: 'carrier-1', tipo: 'INCIDENTE',
      descripcion: 'Anomalía GPS detectada (FUERA_CORREDOR_GEOGRAFICO): observación anterior', createdAt: new Date(dbNow.getTime() - age),
    };
    rows.push(historical);
    await eventoManifiestoSubscriber(corridor());
    expect(mocks.create).toHaveBeenCalledTimes(shouldCreate ? 1 : 0);
    expect(rows[0]).toBe(historical);
    expect(rows[0].createdAt.getTime()).toBe(dbNow.getTime() - age);
  });

  it('uses the database clock after locking instead of an ahead-of-time worker clock', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(dbNow.getTime() + 2 * windowMs);
    await eventoManifiestoSubscriber(corridor());
    expect(mocks.find.mock.calls[0][0].where.createdAt.gte).toEqual(new Date(dbNow.getTime() - windowMs));
    expect(rows[0].createdAt).toEqual(dbNow);
  });

  it('deduplicates the same class despite an updated measurement or another user', async () => {
    await eventoManifiestoSubscriber(corridor());
    await eventoManifiestoSubscriber({ ...corridor('manifest-1', 'Otra medición'), userId: 'carrier-2' });
    expect(rows).toHaveLength(1);
    expect(lockCalls()[0][1]).toBe(lockCalls()[1][1]);
  });

  it('separates manifests and anomaly classes even when their descriptions match', async () => {
    await eventoManifiestoSubscriber(corridor());
    await eventoManifiestoSubscriber(corridor('manifest-2'));
    await eventoManifiestoSubscriber(anomaly('DETENCION_PROLONGADA'));
    await eventoManifiestoSubscriber(anomaly('GPS_PERDIDO'));
    expect(rows).toHaveLength(4);
    expect(new Set(lockCalls().map(call => call[1])).size).toBe(4);
  });

  it('treats underscores, percent signs and backslashes in class names literally', async () => {
    await eventoManifiestoSubscriber(anomaly('GPS_X%\\Y'));
    expect(mocks.find.mock.calls[0][0].where.descripcion.startsWith).toBe('Anomalía GPS detectada (GPS\\_X\\%\\\\Y)');
    expect(rows[0].descripcion).toBe('Anomalía GPS detectada (GPS_X%\\Y): Misma observación');
    await eventoManifiestoSubscriber(anomaly('GPSAX%\\Y'));
    expect(rows).toHaveLength(2);
  });

  it('propagates a lock failure without checking or creating an incident', async () => {
    mocks.query.mockRejectedValueOnce(new Error('lock timeout'));
    await expect(eventoManifiestoSubscriber(corridor())).rejects.toThrow('lock timeout');
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('propagates a create failure and lets a later invocation retry', async () => {
    mocks.create.mockRejectedValueOnce(new Error('insert failed'));
    await expect(eventoManifiestoSubscriber(corridor())).rejects.toThrow('insert failed');
    expect(rows).toHaveLength(0);
    await eventoManifiestoSubscriber(corridor());
    expect(rows).toHaveLength(1);
  });

  it.each(['MANIFIESTO_ESTADO_CAMBIADO', 'INCIDENTE_REGISTRADO', 'RECHAZO_CARGA', 'DIFERENCIA_PESO', 'VENCIMIENTO_PROXIMO', 'TIEMPO_EXCESIVO', 'DURACION_TRANSITO_OBSERVADA'])('does not create an unconfigured incident for %s', async (type) => {
    await eventoManifiestoSubscriber({ type } as DomainEvent);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });
});
