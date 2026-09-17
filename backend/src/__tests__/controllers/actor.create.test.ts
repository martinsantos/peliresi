import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  usuario: { create: vi.fn(), findUnique: vi.fn() },
  generador: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  transportista: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  operador: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  readiness: vi.fn(),
  audit: vi.fn(),
}));
vi.mock('../../lib/prisma', () => ({ default: mocks }));
vi.mock('../../utils/auditoria', () => ({ auditarActor: mocks.audit }));
vi.mock('../../controllers/certificate.controller', () => ({ assertActorDocumentationReady: mocks.readiness }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed-test-only') } }));

import { createGenerador, createOperador, createTransportista, updateGenerador, updateOperador, updateTransportista } from '../../controllers/actor.controller';

describe('atomic administrative actor creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usuario.findUnique.mockResolvedValue(null);
    for (const model of [mocks.generador, mocks.operador, mocks.transportista]) {
      model.findFirst.mockResolvedValue(null);
      model.create.mockResolvedValue({ id: 'qa-actor' });
      model.findUnique.mockResolvedValue({ id: 'qa-actor', activo: false });
      model.update.mockResolvedValue({ id: 'qa-actor', activo: true });
    }
    mocks.audit.mockResolvedValue(undefined);
    mocks.readiness.mockResolvedValue(undefined);
  });
  const cases = [
    ['generador', createGenerador, 'GENERADOR'],
    ['operador', createOperador, 'OPERADOR'],
    ['transportista', createTransportista, 'TRANSPORTISTA'],
  ] as const;
  const validBody = { razonSocial: 'QA', cuit: '30123456789', email: 'qa@example.invalid', telefono: '2610000000', domicilio: 'QA', numeroInscripcion: 'QA', numeroHabilitacion: 'QA', categoria: 'QA' };

  it.each(cases)('%s creates its user in the same database write', async (model, handler, role) => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await handler({ body: validBody, user: { id: 'qa-admin' }, headers: {} } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(mocks.usuario.create).not.toHaveBeenCalled();
    expect(mocks[model].create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ activo: false, usuario: { create: expect.objectContaining({ rol: role, password: 'hashed-test-only', forcePasswordChange: true }) } }) }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it.each([['generador', updateGenerador], ['operador', updateOperador], ['transportista', updateTransportista]] as const)('%s cannot be activated without approved documentation', async (model, handler) => {
    const failure = new Error('Documentacion incompleta');
    mocks.readiness.mockRejectedValueOnce(failure);
    const next = vi.fn();
    await handler({ params: { id: 'qa-actor' }, body: { activo: true }, user: { id: 'qa-admin' }, headers: {} } as any, { json: vi.fn() } as any, next);
    expect(mocks.readiness).toHaveBeenCalledWith(model, 'qa-actor');
    expect(mocks[model].update).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(failure);
  });

  it.each(cases)('%s failure cannot leave a separately created user or success audit', async (model, handler) => {
    const failure = new Error('database constraint');
    mocks[model].create.mockRejectedValueOnce(failure);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await handler({ body: validBody, user: { id: 'qa-admin' }, headers: {} } as any, res as any, next);
    expect(next).toHaveBeenCalledWith(failure);
    expect(mocks.usuario.create).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
  it.each(cases)('%s rejects missing mandatory fields before any write', async (model, handler) => {
    const next = vi.fn();
    await handler({ body: { ...validBody, telefono: undefined }, user: { id: 'qa-admin' }, headers: {} } as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(mocks[model].create).not.toHaveBeenCalled();
  });
});
