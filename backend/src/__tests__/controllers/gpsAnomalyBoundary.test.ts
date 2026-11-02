import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const db = vi.hoisted(() => ({ manifest: vi.fn(), points: vi.fn(), list: vi.fn(), createMany: vi.fn(), emit: vi.fn(),
  transaction: vi.fn(), query: vi.fn(), admins: vi.fn(), existing: vi.fn(), notices: vi.fn(), channels: vi.fn(), inserted: new Set<string>() }));
vi.mock('../../lib/prisma', () => ({ default: {
  manifiesto: { findUnique: db.manifest }, trackingGPS: { findMany: db.points },
  anomaliaTransporte: { findMany: db.list, createMany: db.createMany }, $transaction: db.transaction,
} }));
vi.mock('../../services/domainEvent.service', () => ({ domainEvents: { emit: db.emit } }));
vi.mock('../../services/notification-dispatcher.service', () => ({ notificationService: { programarCanalesDeNotificacion: db.channels } }));
vi.mock('../../jobs/seguimientoCierre.job', () => ({ simularSeguimientoCierre: vi.fn(), ejecutarSeguimientoCierre: vi.fn() }));
import { anomaliaDetector, detectarAnomalias, getAnomalias } from '../../controllers/notification.controller';

const manifest = { id: 'synthetic-trip', numero: 'QA-001', generadorId: 'generator-a', transportistaId: 'carrier-a', operadorId: 'operator-a',
  contextoEmpresa: { empresaId: 'company-a', establecimientoId: 'site-a' }, isDemoData: false };
const response = () => ({ json: vi.fn() });

describe('GPS anomaly access', () => {
  beforeEach(() => { vi.clearAllMocks(); db.manifest.mockResolvedValue(manifest); db.list.mockResolvedValue([{ id: 'synthetic-anomaly' }]); });

  it('does not expose anomalies from another actor\'s manifest', async () => {
    const res = response(), next = vi.fn();
    await getAnomalias({ params: { manifiestoId: manifest.id }, query: {},
      user: { rol: 'GENERADOR', generador: { id: 'generator-b' } } } as never, res as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(db.list).not.toHaveBeenCalled(); expect(res.json).not.toHaveBeenCalled();
  });

  it('does not expose anomalies outside the representative\'s establishment', async () => {
    const res = response(), next = vi.fn();
    await getAnomalias({ params: { manifiestoId: manifest.id }, query: {},
      user: { rol: 'GENERADOR', generador: { id: 'generator-a' },
        empresaContexto: { empresaId: 'company-a', establecimientoId: 'site-b', todasSedes: false } } } as never, res as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(db.list).not.toHaveBeenCalled(); expect(res.json).not.toHaveBeenCalled();
  });

  it('does not expose anomalies if the manifest does not exist', async () => {
    db.manifest.mockResolvedValue(null);
    const res = response(), next = vi.fn();
    await getAnomalias({ params: { manifiestoId: manifest.id }, query: {}, user: { rol: 'ADMIN' } } as never, res as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(db.list).not.toHaveBeenCalled();
  });

  it.each([
    { rol: 'GENERADOR', generador: { id: 'generator-a' } },
    { rol: 'TRANSPORTISTA', transportista: { id: 'carrier-a' } },
    { rol: 'OPERADOR', operador: { id: 'operator-a' } },
    { rol: 'ADMIN' },
  ])('allows an authorized participant or administrator to read anomalies', async user => {
    const res = response(), next = vi.fn();
    await getAnomalias({ params: { manifiestoId: manifest.id }, query: { resuelta: 'false' }, user } as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(db.list).toHaveBeenCalledWith(expect.objectContaining({ where: { manifiestoId: manifest.id, resuelta: false } }));
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 'synthetic-anomaly' }] });
  });
});

describe('GPS anomaly repeated analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks(); db.manifest.mockResolvedValue(manifest);
    db.points.mockResolvedValue([
      { id: 'point-a', latitud: -33, longitud: -69, timestamp: new Date('2026-01-01T00:00:00Z') },
      { id: 'point-b', latitud: -33.1, longitud: -69, timestamp: new Date('2026-01-01T00:00:01Z') },
    ]);
    db.inserted.clear();
    db.createMany.mockImplementation(async ({ data }: { data: Array<{ id: string }> }) => {
      const id = data[0].id;
      if (db.inserted.has(id)) return { count: 0 };
      db.inserted.add(id); return { count: 1 };
    });
    db.query.mockImplementation(async (sql: TemplateStringsArray) => sql.join('').includes('clock_timestamp') ? [{ now: new Date() }] : []);
    db.admins.mockResolvedValue([]); db.existing.mockResolvedValue([]); db.notices.mockResolvedValue({ count: 1 });
    db.transaction.mockImplementation(async work => work({ $queryRaw: db.query, anomaliaTransporte: { createMany: db.createMany },
      usuario: { findMany: db.admins }, notificacion: { findMany: db.existing, createMany: db.notices } }));
  });

  it('does not create and notify the same anomaly again when the same history is analyzed twice', async () => {
    await anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-user');
    await anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-user');
    expect(db.inserted.size).toBe(1);
    expect(db.emit).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])('retains the manifest practice marker on new GPS observations: %s', async isDemoData => {
    db.manifest.mockResolvedValue({ ...manifest, isDemoData });
    await anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-admin');
    expect(db.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ isDemoData })],
    }));
  });

  it('does not compare an original position with a position of a different relay', async () => {
    db.points.mockResolvedValue([
      { id: 'origin', tramoId: null, latitud: -33, longitud: -69, timestamp: new Date('2026-01-01T00:00:00Z') },
      { id: 'relay', tramoId: 'leg-1', tramo: { orden: 1 }, latitud: -33.5, longitud: -69, timestamp: new Date('2026-01-01T00:00:01Z') },
    ]);
    expect(await anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-admin')).toEqual([]);
    expect(db.createMany).not.toHaveBeenCalled();
    expect(db.emit).not.toHaveBeenCalled();
  });

  it('compares interleaved positions only with the preceding position of the same leg', async () => {
    db.points.mockResolvedValue([
      { id: 'original', tramoId: null, latitud: -33, longitud: -69, timestamp: new Date('2026-01-01T00:00:00Z') },
      { id: 'relay-1-a', tramoId: 'leg-1', tramo: { orden: 1 }, latitud: -33, longitud: -69, timestamp: new Date('2026-01-01T00:00:01Z') },
      { id: 'relay-2-a', tramoId: 'leg-2', tramo: { orden: 2 }, latitud: -33, longitud: -69, timestamp: new Date('2026-01-01T00:00:02Z') },
      { id: 'relay-1-b', tramoId: 'leg-1', tramo: { orden: 1 }, latitud: -33.5, longitud: -69, timestamp: new Date('2026-01-01T00:00:03Z') },
      { id: 'relay-2-b', tramoId: 'leg-2', tramo: { orden: 2 }, latitud: -33, longitud: -69, timestamp: new Date('2026-01-01T00:00:04Z') },
    ]);
    const result = await anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-admin');
    expect(result).toHaveLength(1);
    expect(result[0].tipo).toBe('VELOCIDAD_ANORMAL');
    expect(result[0].descripcion).toMatch(/tramo de relevo 1/i);
    const expected = 'gpsan1_' + createHash('sha256').update(JSON.stringify([manifest.id, 'VELOCIDAD_ANORMAL', 'relay-1-a', 'relay-1-b'])).digest('hex');
    expect([...db.inserted]).toEqual([expected]);
  });

  it('does not attribute a relay observation to the original carrier during automatic sampling', async () => {
    db.points.mockResolvedValue([
      { id: 'relay-a', tramoId: 'leg-1', tramo: { orden: 1 }, latitud: -33, longitud: -69, timestamp: new Date('2026-01-01T00:00:00Z') },
      { id: 'relay-b', tramoId: 'leg-1', tramo: { orden: 1 }, latitud: -33.1, longitud: -69, timestamp: new Date('2026-01-01T00:00:01Z') },
    ]);
    await anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-carrier', { automatic: true });
    expect(db.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'ANOMALIA_GPS', userId: undefined }));
  });

  it('attributes a manual relay analysis to the administrator who requested it', async () => {
    db.points.mockResolvedValue([
      { id: 'relay-a', tramoId: 'leg-1', tramo: { orden: 1 }, latitud: -33, longitud: -69, timestamp: new Date('2026-01-01T00:00:00Z') },
      { id: 'relay-b', tramoId: 'leg-1', tramo: { orden: 1 }, latitud: -33.1, longitud: -69, timestamp: new Date('2026-01-01T00:00:01Z') },
    ]);
    await anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-admin');
    expect(db.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'ANOMALIA_GPS', userId: 'synthetic-admin' }));
  });

  it.each([
    ['same sender', 'usuario:synthetic-carrier', 'usuario:synthetic-carrier', 'synthetic-carrier'],
    ['other sender', 'usuario:another', 'usuario:synthetic-carrier', undefined],
    ['legacy sender unknown', null, null, undefined],
  ])('attributes an automatic original observation only with matching receipts: %s', async (_label, first, second, expected) => {
    db.points.mockResolvedValue([
      { id: 'original-a', tramoId: null, emisor: first, latitud: -33, longitud: -69, timestamp: new Date('2026-01-01T00:00:00Z') },
      { id: 'original-b', tramoId: null, emisor: second, latitud: -33.1, longitud: -69, timestamp: new Date('2026-01-01T00:00:01Z') },
    ]);
    await anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-carrier', { automatic: true });
    expect(db.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'ANOMALIA_GPS', userId: expected }));
  });

  it('saves only one anomaly and emits one event when analyses run concurrently', async () => {
    await Promise.all(Array.from({ length: 10 }, () => anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-user')));
    expect(db.inserted.size).toBe(1);
    expect(db.emit).toHaveBeenCalledTimes(1);
  });

  it('preserves separately detected observations for distinct pairs of points', async () => {
    await anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-user');
    db.points.mockResolvedValue([
      { id: 'point-b', latitud: -33.1, longitud: -69, timestamp: new Date('2026-01-01T00:00:01Z') },
      { id: 'point-c', latitud: -33.2, longitud: -69, timestamp: new Date('2026-01-01T00:00:02Z') },
    ]);
    await anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-user');
    expect(db.inserted.size).toBe(2);
    expect(db.emit).toHaveBeenCalledTimes(2);
    expect(db.points).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ timestamp: 'asc' }, { id: 'asc' }] }));
  });

  it('commits default inbox notices with the observation before scheduling external channels', async () => {
    db.admins.mockResolvedValue([{ id: 'qa-admin' }]);
    const transaction = db.transaction.getMockImplementation()!; let committed = false;
    db.transaction.mockImplementation(async (...args: any[]) => {
      const result = await transaction(...args); expect(db.channels).not.toHaveBeenCalled(); committed = true; return result;
    });
    db.channels.mockImplementation(() => expect(committed).toBe(true));
    await anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-carrier');
    expect(db.notices).toHaveBeenCalledOnce(); expect(db.channels).toHaveBeenCalledOnce();
    expect(db.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'ANOMALIA_GPS', avisosConfirmados: true }));
  });

  it('alerts administrators for a relay observation without fabricating an author', async () => {
    db.admins.mockResolvedValue([{ id: 'qa-admin-a' }, { id: 'qa-admin-b' }]);
    await anomaliaDetector.detectarAnomalias(manifest.id);
    expect(db.notices.mock.calls[0][0].data.map((notice: { usuarioId: string }) => notice.usuarioId)).toEqual(['qa-admin-a', 'qa-admin-b']);
    expect(db.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'ANOMALIA_GPS', userId: undefined, avisosConfirmados: true }));
  });

  it('does not emit an event or schedule channels if saving the inbox fails', async () => {
    db.admins.mockResolvedValue([{ id: 'qa-admin' }]); db.notices.mockRejectedValueOnce(new Error('notice insert failed'));
    await expect(anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-carrier')).rejects.toThrow('notice insert failed');
    expect(db.emit).not.toHaveBeenCalled(); expect(db.channels).not.toHaveBeenCalled();
  });

  it('attributes a manual analysis to the authenticated administrator', async () => {
    const detector = vi.spyOn(anomaliaDetector, 'detectarAnomalias').mockResolvedValueOnce([]);
    const res = response(), next = vi.fn();
    await detectarAnomalias({ params: { manifiestoId: manifest.id }, user: { id: 'synthetic-admin' } } as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(detector).toHaveBeenCalledWith(manifest.id, 'synthetic-admin');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
    detector.mockRestore();
  });

  it.each([
    ['VELOCIDAD_ANORMAL', -33.1, 1],
    ['PARADA_PROLONGADA', -33, 3 * 3600],
    ['GPS_PERDIDO', -33.1, 31 * 60],
  ])('explains that %s is inferred from reception, not a confirmed event', async (kind, latitude, seconds) => {
    db.points.mockResolvedValue([
      { id: 'point-a', latitud: -33, longitud: -69, timestamp: new Date('2026-01-01T00:00:00Z') },
      { id: 'point-b', latitud: latitude, longitud: -69, timestamp: new Date(Date.parse('2026-01-01T00:00:00Z') + Number(seconds) * 1000) },
    ]);
    const results = await anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-user');
    const observation = results.find(item => item.tipo === kind);
    expect(observation).toBeDefined();
    expect(observation.descripcion).toMatch(/hora de captura no disponible/i);
    expect(observation.descripcion).toMatch(/verific[aá].*transporte/i);
    expect(observation.descripcion).not.toMatch(/velocidad anormalmente alta detectada|p[eé]rdida de se[nñ]al GPS por|^parada prolongada de/i);
    expect(db.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'ANOMALIA_GPS', numero: 'QA-001', tipoAnomalia: kind, descripcion: observation.descripcion }));
  });
});
