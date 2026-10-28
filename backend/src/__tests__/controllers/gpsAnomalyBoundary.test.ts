import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ manifest: vi.fn(), points: vi.fn(), list: vi.fn(), createMany: vi.fn(), emit: vi.fn(), inserted: new Set<string>() }));
vi.mock('../../lib/prisma', () => ({ default: {
  manifiesto: { findUnique: db.manifest }, trackingGPS: { findMany: db.points },
  anomaliaTransporte: { findMany: db.list, createMany: db.createMany },
} }));
vi.mock('../../services/domainEvent.service', () => ({ domainEvents: { emit: db.emit } }));
vi.mock('../../services/notification-dispatcher.service', () => ({ notificationService: {} }));
vi.mock('../../jobs/seguimientoCierre.job', () => ({ simularSeguimientoCierre: vi.fn(), ejecutarSeguimientoCierre: vi.fn() }));
import { anomaliaDetector, detectarAnomalias, getAnomalias } from '../../controllers/notification.controller';

const manifest = { id: 'synthetic-trip', numero: 'QA-001', generadorId: 'generator-a', transportistaId: 'carrier-a', operadorId: 'operator-a',
  contextoEmpresa: { empresaId: 'company-a', establecimientoId: 'site-a' } };
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
  });

  it('does not create and notify the same anomaly again when the same history is analyzed twice', async () => {
    await anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-user');
    await anomaliaDetector.detectarAnomalias(manifest.id, 'synthetic-user');
    expect(db.inserted.size).toBe(1);
    expect(db.emit).toHaveBeenCalledTimes(1);
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
