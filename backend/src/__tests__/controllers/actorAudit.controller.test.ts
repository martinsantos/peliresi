import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ before: vi.fn(), update: vi.fn(), audit: vi.fn(), lock: vi.fn(), transaction: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { $transaction: mock.transaction } }));
vi.mock('../../utils/logger', () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
import { updateGenerador, updateOperador, updateTransportista } from '../../controllers/actor.controller';

describe('actor data and its exact history share one transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.before.mockResolvedValue({ id: 'actor', domicilio: 'Anterior' });
    mock.update.mockResolvedValue({ id: 'actor', domicilio: 'Nuevo' });
    mock.audit.mockResolvedValue({ id: 'audit' });
    const delegate = { findUnique: mock.before, update: mock.update };
    mock.transaction.mockImplementation(callback => callback({ $queryRaw: mock.lock, generador: delegate, operador: delegate, transportista: delegate, auditoria: { create: mock.audit } }));
  });
  for (const [kind, handler] of [['GENERADOR', updateGenerador], ['OPERADOR', updateOperador], ['TRANSPORTISTA', updateTransportista]] as const) {
    it(`${kind}: records previous/new address and actual author before acknowledging`, async () => {
      const response = { json: vi.fn() }, next = vi.fn();
      await handler({ params: { id: 'actor' }, body: { domicilio: 'Nuevo' }, user: { id: 'staff' }, headers: {}, ip: '127.0.0.1' } as never, response as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(mock.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ modulo: kind, accion: 'UPDATE', usuarioId: 'staff', datosAntes: JSON.stringify({ id: 'actor', domicilio: 'Anterior' }), datosDespues: JSON.stringify({ id: 'actor', domicilio: 'Nuevo' }) }) });
      expect(mock.lock.mock.invocationCallOrder[0]).toBeLessThan(mock.before.mock.invocationCallOrder[0]);
      expect(mock.audit.mock.invocationCallOrder[0]).toBeLessThan(response.json.mock.invocationCallOrder[0]);
    });
    it(`${kind}: propagates an audit failure to abort the transaction, without a false save response`, async () => {
      const failure = new Error('audit unavailable'); mock.audit.mockRejectedValueOnce(failure);
      const response = { json: vi.fn() }, next = vi.fn();
      await handler({ params: { id: 'actor' }, body: { domicilio: 'Nuevo' }, user: { id: 'staff' }, headers: {} } as never, response as never, next);
      expect(next).toHaveBeenCalledWith(failure); expect(response.json).not.toHaveBeenCalled();
    });
  }
  it('an administrative type change updates the exact runtime mode as part of the audited transaction', async () => {
    mock.before.mockResolvedValue({ id: 'actor', tipoOperador: 'FIJO', modalidades: ['FIJO'] });
    const response = { json: vi.fn() }, next = vi.fn();
    await updateOperador({ params: { id: 'actor' }, body: { tipoOperador: 'IN_SITU' }, user: { id: 'staff', rol: 'ADMIN_OPERADOR' }, headers: {} } as never, response as never, next);
    expect(next).not.toHaveBeenCalled(); expect(mock.update.mock.calls[0][0].data).toMatchObject({ tipoOperador: 'IN_SITU', modalidades: ['IN_SITU'] });
  });
  it('does not silently remove a historical second mode when only an address changes', async () => {
    mock.before.mockResolvedValue({ id: 'actor', tipoOperador: 'FIJO', modalidades: ['FIJO', 'IN_SITU'] });
    const response = { json: vi.fn() }, next = vi.fn();
    await updateOperador({ params: { id: 'actor' }, body: { tipoOperador: 'FIJO', domicilio: 'Nuevo' }, user: { id: 'staff', rol: 'ADMIN_OPERADOR' }, headers: {} } as never, response as never, next);
    expect(next).not.toHaveBeenCalled(); expect(mock.update.mock.calls[0][0].data).not.toHaveProperty('modalidades');
  });
  it('a common operator cannot self-grant a new runtime mode', async () => {
    mock.before.mockResolvedValue({ id: 'actor', tipoOperador: 'FIJO', modalidades: ['FIJO'] });
    const response = { json: vi.fn() }, next = vi.fn();
    await updateOperador({ params: { id: 'actor' }, body: { tipoOperador: 'IN_SITU' }, user: { id: 'owner', rol: 'OPERADOR' }, headers: {} } as never, response as never, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 }); expect(mock.update).not.toHaveBeenCalled();
  });
});
