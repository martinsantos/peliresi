import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findUser: vi.fn(), findActor: vi.fn(), businessCount: vi.fn(), ticketCount: vi.fn(), messageCount: vi.fn(), eventCount: vi.fn(), deleteActor: vi.fn(), deleteUser: vi.fn(), deleteChildren: vi.fn(), deleteAgent: vi.fn(), transaction: vi.fn(), lock: vi.fn() }));
vi.mock('../../jobs/vencimiento.job', () => ({ verificarVencimientos: vi.fn() }));
vi.mock('../../services/email.service', () => ({ emailService: {} }));
vi.mock('../../controllers/auth.controller', () => ({ generateTokens: vi.fn() }));
vi.mock('../../utils/auditoria', () => ({ auditarActor: vi.fn() }));
vi.mock('../../lib/prisma', () => {
  const db = { usuario: { findUnique: mocks.findUser, delete: mocks.deleteUser },
    generador: { findUnique: mocks.findActor, delete: mocks.deleteActor },
    transportista: { findUnique: mocks.findActor, delete: mocks.deleteActor },
    operador: { findUnique: mocks.findActor, delete: mocks.deleteActor },
    vehiculo: { deleteMany: mocks.deleteChildren }, chofer: { deleteMany: mocks.deleteChildren },
    agenteSoporte: { deleteMany: mocks.deleteAgent },
    manifiesto: { count: mocks.businessCount }, ticketSoporte: { count: mocks.ticketCount },
    mensajeSoporte: { count: mocks.messageCount }, eventoSoporte: { count: mocks.eventCount }, $queryRaw: mocks.lock };
  mocks.transaction.mockImplementation(callback => callback(db));
  return { default: { ...db, $transaction: mocks.transaction } };
});
import { deleteUsuario } from '../../controllers/admin.controller';
import { deleteGenerador, deleteOperador, deleteTransportista } from '../../controllers/actor.controller';
const actor = { id: 'actor', usuarioId: 'user', razonSocial: 'QA sin actividad' };
const request = { params: { id: 'actor' }, user: { id: 'admin', rol: 'ADMIN' }, headers: {} };
const response = () => ({ json: vi.fn() });
describe('support history must not cause a partial account/actor deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.findActor.mockResolvedValue(actor); mocks.findUser.mockResolvedValue({ id: 'user', generador: actor, transportista: null, operador: null });
    mocks.businessCount.mockResolvedValue(0); mocks.ticketCount.mockResolvedValue(1); mocks.messageCount.mockResolvedValue(0); mocks.eventCount.mockResolvedValue(0);
    // Models the actual new PostgreSQL author FK after the actor was deleted.
    mocks.deleteUser.mockRejectedValue({ code: 'P2003', message: 'support author foreign key' });
  });
  it.each([['account', deleteUsuario], ['generator', deleteGenerador], ['carrier', deleteTransportista], ['operator', deleteOperador]] as const)('%s refuses before deleting any actor, fleet or user', async (_name, handler) => {
    const next = vi.fn(); await handler({ ...request, params: { id: _name === 'account' ? 'user' : 'actor' } } as never, response() as never, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
    expect(next.mock.calls[0][0].message).toMatch(/soporte/i);
    expect(mocks.deleteActor).not.toHaveBeenCalled(); expect(mocks.deleteChildren).not.toHaveBeenCalled(); expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it('still deletes an account with no history, including only its ephemeral membership', async () => {
    mocks.ticketCount.mockResolvedValue(0); mocks.deleteUser.mockResolvedValue({ id: 'user' });
    const next = vi.fn(), res = response(); await deleteUsuario({ ...request, params: { id: 'user' } } as never, res as never, next);
    expect(next).not.toHaveBeenCalled(); expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.deleteActor).toHaveBeenCalledWith({ where: { id: 'actor' } });
    expect(mocks.deleteAgent).toHaveBeenCalledWith({ where: { usuarioId: 'user' } });
    expect(mocks.deleteUser).toHaveBeenCalledWith({ where: { id: 'user' } });
  });
  it('keeps actor, membership and user operations inside the same transaction when another FK fails', async () => {
    mocks.ticketCount.mockResolvedValue(0);
    const next = vi.fn(); await deleteGenerador(request as never, response() as never, next);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
    expect(next.mock.calls[0][0].message).toMatch(/referencias pendientes/);
    // Actual PostgreSQL rollback is measured separately by the HTTP integration.
  });
});
