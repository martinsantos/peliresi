import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ list: vi.fn(), current: vi.fn(), transaction: vi.fn(), lock: vi.fn(), prior: vi.fn(),
  insert: vi.fn(), oldCount: vi.fn(), oldCreate: vi.fn(), company: vi.fn(), push: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { manifiesto: { findMany: mocks.list }, notificacion: { count: mocks.oldCount }, $transaction: mocks.transaction } }));
vi.mock('../../controllers/notification.controller', () => ({ notificationService: { crearNotificacion: mocks.oldCreate } }));
vi.mock('../../lib/trainingScope', () => ({ isTrainingSession: () => false }));
vi.mock('../../services/manifestCompanyRecipients.service', () => ({ manifestCompanyRecipients: mocks.company }));
vi.mock('../../services/committed-manifest-push.service', () => ({ scheduleCommittedManifestPush: mocks.push }));
import { ejecutarRecordatorios } from '../../jobs/recordatorio.job';

const now = new Date('2026-10-30T12:00:00Z'), planned = new Date('2026-10-31T03:00:00Z');
const access = { empresaId: 'company', actividadId: 'activity', rol: 'GENERADOR', razonSocial: 'QA Empresa' };
const manifest = { id: 'm', numero: 'QA-M-1', estado: 'APROBADO', modalidad: 'FIJO', isDemoData: false, fechaEstimadaRetiro: planned,
  generador: { activo: true, razonSocial: 'QA Generador', domicilio: 'QA', latitud: -33, longitud: -68, usuario: { id: 'g', activo: true } },
  transportista: { activo: true, razonSocial: 'QA Transporte', usuario: { id: 't', activo: true } },
  operador: { activo: true, razonSocial: 'QA Operador', usuario: { id: 'o', activo: true } } };

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
  mocks.list.mockResolvedValue([manifest]); mocks.current.mockResolvedValue(manifest); mocks.lock.mockResolvedValue([{ id: 'm' }]);
  mocks.prior.mockResolvedValue([]); mocks.oldCount.mockResolvedValue(0); mocks.oldCreate.mockResolvedValue({});
  mocks.insert.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
  mocks.company.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [access] }]);
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    manifiesto: { findUnique: mocks.current }, notificacion: { findMany: mocks.prior, createMany: mocks.insert }, $queryRaw: mocks.lock,
  }));
});
afterEach(() => vi.useRealTimers());

function records(): any[] { return [...mocks.oldCreate.mock.calls.map(call => call[0]), ...mocks.insert.mock.calls.flatMap(call => call[0].data)]; }

describe('recordatorios de operación', () => {
  it('en origen avisa a las tres partes y al representante sin inventar un retiro', async () => {
    const inSitu = { ...manifest, modalidad: 'IN_SITU' }; mocks.list.mockResolvedValue([inSitu]); mocks.current.mockResolvedValue(inSitu);
    await ejecutarRecordatorios();
    const sent = records(); expect(sent.map(n => n.usuarioId).sort()).toEqual(['g', 'o', 'rep', 't']);
    for (const n of sent) {
      expect(n.titulo).toMatch(/tratamiento en origen/i);
      expect(n.mensaje).toMatch(/no hay retiro, traslado ni GPS/i);
      expect(n.mensaje).not.toMatch(/retirará|retirara|retiro mañana|retiro manana/i);
      expect(JSON.parse(n.datos).mapsUrl).toBeUndefined();
    }
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.current.mock.invocationCallOrder[0]);
  });
  it('en traslado identifica la fecha prevista sin afirmar que es mañana', async () => {
    await ejecutarRecordatorios();
    const sent = records(); expect(sent.map(n => n.usuarioId).sort()).toEqual(['g', 'o', 'rep', 't']);
    for (const n of sent) { expect(n.titulo).toMatch(/retiro previsto/i); expect(n.mensaje).not.toMatch(/mañana|manana/i); }
    expect(JSON.parse(sent.find(n => n.usuarioId === 't').datos).mapsUrl).toBe('https://maps.google.com/?q=-33,-68');
    for (const n of sent.filter(n => n.usuarioId !== 't')) expect(JSON.parse(n.datos).mapsUrl).toBeUndefined();
    const rep = sent.find(n => n.usuarioId === 'rep');
    expect(JSON.parse(rep.datos)).toMatchObject({ tipo: 'recordatorio_operacion', version: 1, destino: 'representante', accesosEmpresa: [access] });
  });
  it('no publica un mapa cuando faltan coordenadas válidas', async () => {
    mocks.current.mockResolvedValue({ ...manifest, generador: { ...manifest.generador, latitud: 91 } });
    await ejecutarRecordatorios();
    expect(records().every(n => !JSON.parse(n.datos).mapsUrl)).toBe(true);
  });
  it('usa las coordenadas de la sede declarada cuando el generador actúa por empresa', async () => {
    mocks.current.mockResolvedValue({ ...manifest, contextoEmpresa: { rol: 'GENERADOR', establecimientoId: 's1',
      establecimiento: { id: 's1', latitud: -32.9, longitud: -68.8 } } });
    await ejecutarRecordatorios();
    expect(JSON.parse(records().find(n => n.usuarioId === 't').datos).mapsUrl).toBe('https://maps.google.com/?q=-32.9,-68.8');
  });
  it('no reemplaza la sede ausente o distinta por las coordenadas generales', async () => {
    for (const site of [{ id: 's1', latitud: null, longitud: null }, { id: 'otra', latitud: -32.9, longitud: -68.8 }]) {
      mocks.current.mockResolvedValue({ ...manifest, contextoEmpresa: { rol: 'GENERADOR', establecimientoId: 's1', establecimiento: site } });
      await ejecutarRecordatorios();
      expect(JSON.parse(records().filter(n => n.usuarioId === 't').slice(-1)[0].datos).mapsUrl).toBeUndefined();
    }
  });
  it('omite el mapa cuando un contexto de empresa anterior no identifica el rol', async () => {
    mocks.current.mockResolvedValue({ ...manifest, contextoEmpresa: { establecimientoId: 's1' } });
    await ejecutarRecordatorios();
    expect(JSON.parse(records().find(n => n.usuarioId === 't').datos).mapsUrl).toBeUndefined();
  });
  it('repara una falta por destinatario sin duplicar un aviso anterior para la misma fecha', async () => {
    mocks.prior.mockImplementation(async (args: any) => args.where.id ? [] : [{ usuarioId: 'g', datos: JSON.stringify({ tipo: 'recordatorio_retiro', fechaRetiro: '31/10/2026' }) }]);
    await ejecutarRecordatorios();
    expect(records().map(n => n.usuarioId).sort()).toEqual(['o', 'rep', 't']);
  });
  it('no duplica al reintentar y produce una nueva referencia si cambia el día previsto', async () => {
    const saved = new Set<string>();
    mocks.prior.mockImplementation(async (args: any) => args.where.id
      ? args.where.id.in.filter((id: string) => saved.has(id)).map((id: string) => ({ id })) : []);
    mocks.insert.mockImplementation(async ({ data }: { data: Array<{ id: string }> }) => {
      for (const item of data) saved.add(item.id); return { count: data.length };
    });
    expect(await ejecutarRecordatorios()).toBe(1); expect(await ejecutarRecordatorios()).toBe(0);
    expect(saved.size).toBe(4); const previous = new Set(saved);
    vi.setSystemTime(new Date(now.getTime() + 86400000));
    mocks.current.mockResolvedValue({ ...manifest, fechaEstimadaRetiro: new Date(planned.getTime() + 86400000) });
    expect(await ejecutarRecordatorios()).toBe(1); expect(saved.size).toBe(8);
    expect([...saved].filter(id => !previous.has(id))).toHaveLength(4);
    expect(mocks.push).toHaveBeenCalledTimes(2);
  });
  it('continúa con otros manifiestos ante un fallo y señala que el barrido quedó incompleto', async () => {
    mocks.list.mockResolvedValue([{ id: 'blocked' }, manifest]);
    mocks.transaction.mockRejectedValueOnce(new Error('QA bloqueo vencido'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(ejecutarRecordatorios()).rejects.toThrow(/evaluación.*incompleta/i);
      expect(mocks.transaction).toHaveBeenCalledTimes(2); expect(mocks.insert).toHaveBeenCalledOnce(); expect(log).toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it('no crea avisos al cambiar a tránsito durante la evaluación ni para datos de capacitación', async () => {
    mocks.current.mockResolvedValue({ ...manifest, estado: 'EN_TRANSITO' });
    await ejecutarRecordatorios(); expect(records()).toEqual([]); expect(mocks.push).not.toHaveBeenCalled();
    mocks.current.mockResolvedValue({ ...manifest, isDemoData: true });
    await ejecutarRecordatorios(); expect(records()).toEqual([]); expect(mocks.push).not.toHaveBeenCalled();
  });
});
