import { describe, expect, it, vi, beforeEach } from 'vitest';
const list = vi.hoisted(() => vi.fn());
const access = vi.hoisted(() => vi.fn());
const requests = vi.hoisted(() => vi.fn());
vi.mock('../../services/support.service', () => ({ supportService: { access, list } }));
vi.mock('../../services/solicitud.service', () => ({ solicitudService: { list: requests } }));
import { supportPending, applicationTotals } from '../../services/attention.service';
beforeEach(() => vi.resetAllMocks());
describe('attention counts use authorized server totals, never the visible page', () => {
  it('counts the whole support desk for agents, excluding waiting and closed', async () => {
    access.mockResolvedValue({ puedeGestionar: true });
    list.mockImplementation(({ estado }) => Promise.resolve({ total: estado === 'ABIERTO' ? 32 : 7, items: [] }));
    expect(await supportPending()).toBe(39);
    expect(list.mock.calls.map(([p]) => p)).toEqual([{ scope: 'mesa', estado: 'ABIERTO', page: 1 }, { scope: 'mesa', estado: 'EN_CURSO', page: 1 }]);
  });
  it('only counts the current actor tickets waiting for their reply', async () => {
    access.mockResolvedValue({ puedeGestionar: false }); list.mockResolvedValue({ total: 3 });
    expect(await supportPending()).toBe(3);
    expect(list).toHaveBeenCalledExactlyOnceWith({ scope: 'mis', estado: 'ESPERANDO_USUARIO', page: 1 });
  });
  it('counts every state from pagination totals, requesting one row only', async () => {
    const totals: Record<string, number> = { ENVIADA: 24, EN_REVISION: 2, OBSERVADA: 4, APROBADA: 30 };
    requests.mockImplementation(({ estado }) => Promise.resolve({ total: totals[estado], items: [] }));
    expect(await applicationTotals()).toEqual({ ENVIADA: 24, EN_REVISION: 2, OBSERVADA: 4, APROBADA: 30 });
    expect(requests.mock.calls.every(([p]) => p.limit === 1)).toBe(true);
  });
  it('does not turn a connection error into a false zero', async () => {
    access.mockRejectedValue(new Error('offline'));
    await expect(supportPending()).rejects.toThrow('offline');
  });
});
