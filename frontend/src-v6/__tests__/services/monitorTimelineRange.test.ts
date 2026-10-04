import { beforeEach, expect, it, vi } from 'vitest';
const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../services/api', () => ({ default: http }));
import { fetchTimeline } from '../../pages/monitor/api/monitor-api';
const batch = (events: object[], next: number | null = null) => ({ data: { data: {
  eventos: events, actores: { generadores: [], transportistas: [], operadores: [] },
  paginacion: { pagina: 1, siguiente: next }, resumen: { incompleto: next !== null, totalEventos: events.length, totalManifiestos: 1, totalGpsPoints: 0 },
} } });
beforeEach(() => vi.clearAllMocks());
it('collects the whole period in ordered pages and does not count duplicate IDs', async () => {
  const late = { id: 'EVENTO:b', type: 'EVENTO', timestamp: '2026-10-04T12:00:00Z' };
  const early = { id: 'GPS:a', type: 'GPS', timestamp: '2026-09-05T12:00:00Z' };
  http.get.mockResolvedValueOnce(batch([late], 2)).mockResolvedValueOnce(batch([late, early]));
  const abort = new AbortController(); const result = await fetchTimeline('2026-09-05', 30, abort.signal);
  expect(result.eventos).toEqual([early, late]); expect(result.resumen).toMatchObject({ incompleto: false, totalEventos: 2, totalGpsPoints: 1 });
  const cutoff = http.get.mock.calls[0][1].params.corte;
  expect(Number.isFinite(Date.parse(cutoff))).toBe(true);
  expect(http.get).toHaveBeenLastCalledWith('/centro-control/timeline', { params: { fecha: '2026-09-05', dias: 30, pagina: 2, corte: cutoff }, signal: abort.signal });
  expect(result.paginacion).toEqual({ pagina: 2, siguiente: null });
});
it('a failed later page never resolves as a successful partial movie', async () => {
  http.get.mockResolvedValueOnce(batch([], 2)).mockRejectedValueOnce(new Error('offline'));
  await expect(fetchTimeline('2026-09-05', 30)).rejects.toThrow('offline');
});
it('rejects non-advancing pagination instead of looping forever', async () => {
  http.get.mockResolvedValue(batch([], 1)); await expect(fetchTimeline('2026-09-05', 30)).rejects.toThrow('no avanzó');
  expect(http.get).toHaveBeenCalledTimes(1);
});
it('bounds memory without announcing a partial set as complete', async () => {
  http.get.mockResolvedValue(batch(Array.from({ length: 25001 }, () => ({ type: 'GPS', timestamp: '2026-10-04T12:00:00Z' }))));
  await expect(fetchTimeline('2026-09-05', 30)).rejects.toThrow('25.000');
});
