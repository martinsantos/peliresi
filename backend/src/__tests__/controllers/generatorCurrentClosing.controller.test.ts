import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  renewal: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })), reread: vi.fn(async () => ({ id: 'r' })), generatorUpdate: vi.fn(async () => ({})),
  close: vi.fn(async () => []), enabled: vi.fn(() => false), generator: vi.fn(), exceptions: vi.fn(),
}));
vi.mock('../../lib/prisma', () => ({ default: {
  renovacion: { findUnique: m.renewal },
  generador: { findUnique: m.generator },
  excepcionCorrienteGenerador: { findMany: m.exceptions },
  $transaction: async (callback: any) => callback({ renovacion: { updateMany: m.updateMany, findUniqueOrThrow: m.reread }, generador: { update: m.generatorUpdate } }),
} }));
vi.mock('../../services/renovacion-notification.service', () => ({ notifyRenovacion: vi.fn() }));
vi.mock('../../services/generatorCurrentException.service', async original => ({ ...(await original<object>()), closeCoveredGeneratorExceptions: m.close, generatorExceptionsEnabled: m.enabled }));
import { aprobarRenovacion } from '../../controllers/renovacion.controller';
import { generatorCurrentExceptions } from '../../controllers/generatorCurrentException.controller';

const call = async (handler: any, req: any) => { const next = vi.fn(), json = vi.fn(); await handler(req, { json, setHeader: vi.fn() } as any, next); return { next, json }; };
beforeEach(() => vi.clearAllMocks());

describe('closing an exception by an approved renewal', () => {
  it('a renewal that registers streams in the ficha runs the closing with its reference', async () => {
    m.renewal.mockResolvedValue({ id: 'r', estado: 'PENDIENTE', modalidad: 'CON_CAMBIOS', tipoActor: 'GENERADOR', generadorId: 'g1', datosNuevos: JSON.stringify({ corrientesControl: 'Y8, Y34' }) });
    const { next } = await call(aprobarRenovacion, { params: { id: 'r' }, user: { id: 'admin', rol: 'ADMIN' }, body: {} });
    expect(next).not.toHaveBeenCalled();
    expect(m.generatorUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ corrientesControl: 'Y8, Y34' }) }));
    expect(m.close).toHaveBeenCalledWith(expect.anything(), { generadorId: 'g1', userId: 'admin', fuente: 'RENOVACION', referencia: 'r' });
  });
  it('a renewal without stream changes does not run it', async () => {
    m.renewal.mockResolvedValue({ id: 'r', estado: 'PENDIENTE', modalidad: 'CON_CAMBIOS', tipoActor: 'GENERADOR', generadorId: 'g1', datosNuevos: JSON.stringify({ telefono: '261 000' }) });
    await call(aprobarRenovacion, { params: { id: 'r' }, user: { id: 'admin', rol: 'ADMIN' }, body: {} });
    expect(m.close).not.toHaveBeenCalled();
  });
});

describe('generator history with the switch off', () => {
  it('answers from the ficha without touching the exceptions table', async () => {
    m.enabled.mockReturnValue(false);
    m.generator.mockResolvedValue({ id: 'g1', corrientesControl: 'Y8' });
    const { json, next } = await call(generatorCurrentExceptions, { params: { id: 'g1' }, user: { id: 'admin', rol: 'ADMIN' } });
    expect(next).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ success: true, data: { habilitado: false, fichaCorrientes: ['Y8'], disponible: true, excepciones: [] } });
    expect(m.exceptions).not.toHaveBeenCalled();
  });
  it('another actor gets the same answer as for a missing generator', async () => {
    const { next } = await call(generatorCurrentExceptions, { params: { id: 'g1' }, user: { id: 'carrier', rol: 'TRANSPORTISTA' } });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });
});
