import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rules: vi.fn(), manifests: vi.fn(), current: vi.fn(), subscriber: vi.fn(), error: vi.fn(), schedule: vi.fn(), clock: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { reglaAlerta: { findMany: mocks.rules },
  manifiesto: { findMany: mocks.manifests, findUnique: mocks.current }, $queryRaw: mocks.clock } }));
vi.mock('../../subscribers/alerta.subscriber', () => ({ alertaSubscriber: mocks.subscriber }));
vi.mock('../../utils/logger', () => ({ default: { error: mocks.error, info: vi.fn() } }));
vi.mock('node-cron', () => ({ default: { schedule: mocks.schedule } }));

import { evaluarDuracionTransito, iniciarDuracionTransitoJob } from '../../jobs/transitDuration.job';
import { inTrainingSession } from '../../lib/trainingScope';

const now = new Date('2026-10-28T12:00:00.000Z');
const originalInstance = process.env.NODE_APP_INSTANCE;
const rule = (condicion: unknown) => ({ condicion: JSON.stringify(condicion), activa: true });
const trip = (id: string, hours: number, estado = 'EN_TRANSITO') => ({ id, numero: `QA-${id}`, estado,
  fechaRetiro: new Date(now.getTime() - hours * 3600000), isDemoData: false });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rules.mockResolvedValue([]); mocks.manifests.mockResolvedValue([]);
  mocks.clock.mockResolvedValue([{ now }]);
  mocks.current.mockImplementation(async ({ where }) => trip(where.id, 30));
  mocks.subscriber.mockResolvedValue(undefined);
});
afterEach(() => {
  if (originalInstance === undefined) delete process.env.NODE_APP_INSTANCE;
  else process.env.NODE_APP_INSTANCE = originalInstance;
});

describe('configured travel duration independently of GPS reception', () => {
  it('schedules the periodic check only on the designated instance', async () => {
    process.env.NODE_APP_INSTANCE = '1'; iniciarDuracionTransitoJob();
    expect(mocks.schedule).not.toHaveBeenCalled();
    process.env.NODE_APP_INSTANCE = '0'; iniciarDuracionTransitoJob();
    expect(mocks.schedule).toHaveBeenCalledOnce();
    expect(mocks.schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function));
    await mocks.schedule.mock.calls[0][1]();
    expect(mocks.rules).toHaveBeenCalledOnce();
  });
  it('does not scan trips when no valid duration rule is enabled', async () => {
    mocks.rules.mockResolvedValue([rule({}), rule({ tipo: 'seguimiento_cierre', diasRecepcion: { gte: 7 } }),
      rule({ tipo: 'requerimiento_inspeccion' }), { condicion: 'malformed', activa: true }]);
    expect(await evaluarDuracionTransito(now)).toMatchObject({ evaluados: 0, errores: 0 });
    expect(mocks.manifests).not.toHaveBeenCalled(); expect(mocks.subscriber).not.toHaveBeenCalled();
  });

  it('uses the database clock when no evaluation time is supplied', async () => {
    mocks.rules.mockResolvedValue([rule({ horasTransito: { gte: 24 } })]);
    mocks.manifests.mockResolvedValueOnce([{ id: 'clock' }]);
    await evaluarDuracionTransito();
    expect(mocks.clock).toHaveBeenCalledOnce();
    expect(mocks.subscriber).toHaveBeenCalledWith(expect.objectContaining({ manifiestoId: 'clock', horasTransito: 30 }));
  });

  it('does not run inside the training realm', async () => {
    mocks.rules.mockResolvedValue([rule({ horasTransito: { gte: 24 } })]);
    expect(await inTrainingSession(() => evaluarDuracionTransito(now))).toMatchObject({ evaluados: 0, errores: 0 });
    expect(mocks.rules).not.toHaveBeenCalled(); expect(mocks.manifests).not.toHaveBeenCalled();
  });

  it('evaluates an active trip with no GPS observation and skips a trip already delivered', async () => {
    mocks.rules.mockResolvedValue([rule({ horasTransito: { gte: 24 } })]);
    mocks.manifests.mockResolvedValueOnce([{ id: 'active' }, { id: 'delivered' }]);
    mocks.current.mockImplementation(async ({ where }) => where.id === 'active' ? trip('active', 30) : trip('delivered', 30, 'ENTREGADO'));
    expect(await evaluarDuracionTransito(now)).toMatchObject({ evaluados: 1, errores: 0 });
    expect(mocks.subscriber).toHaveBeenCalledOnce();
    expect(mocks.manifests).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isDemoData: false }) }));
    expect(mocks.subscriber).toHaveBeenCalledWith({ type: 'DURACION_TRANSITO_OBSERVADA', manifiestoId: 'active',
      numero: 'QA-active', horasTransito: 30 });
  });

  it('does not invoke rule delivery for trips below the configured threshold', async () => {
    mocks.rules.mockResolvedValue([rule({ horasTransito: { gte: 24 } })]);
    mocks.manifests.mockResolvedValueOnce([{ id: 'early' }]);
    mocks.current.mockResolvedValue(trip('early', 23));
    expect(await evaluarDuracionTransito(now)).toMatchObject({ evaluados: 0, errores: 0 });
    expect(mocks.subscriber).not.toHaveBeenCalled();
  });

  it('continues after one failure and makes incomplete evaluation visible', async () => {
    mocks.rules.mockResolvedValue([rule({ horasTransito: { gte: 24 } })]);
    mocks.manifests.mockResolvedValueOnce([{ id: 'bad' }, { id: 'good' }]);
    mocks.subscriber.mockRejectedValueOnce(new Error('base no disponible')).mockResolvedValueOnce(undefined);
    expect(await evaluarDuracionTransito(now)).toMatchObject({ evaluados: 1, errores: 1 });
    expect(mocks.subscriber).toHaveBeenCalledTimes(2); expect(mocks.error).toHaveBeenCalled();
  });
});
