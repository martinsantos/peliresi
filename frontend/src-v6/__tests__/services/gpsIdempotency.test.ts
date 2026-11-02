import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushStoredGpsQueue, gpsQueueKey, sendIdempotentGps } from '../../services/gpsQueue';

const key = gpsQueueKey('qa-owner', 'qa-trip');
const point = { lat: -33.1, lng: -68.1, speed: null, heading: null };
const freshPoint = () => ({ ...point, observedAt: Date.now() });
beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

it('persists a point reference before sending and reuses it after an unacknowledged response', async () => {
  localStorage.setItem(key, JSON.stringify([freshPoint()]));
  const send = vi.fn(async (sample: any) => {
    expect(JSON.parse(localStorage.getItem(key)!)[0].puntoId).toBe(sample.puntoId);
    if (send.mock.calls.length === 1) throw new Error('connection lost after server accepted');
  });
  await expect(flushStoredGpsQueue('qa-owner', 'qa-trip', send)).rejects.toThrow('connection lost');
  const saved = JSON.parse(localStorage.getItem(key)!);
  expect(saved[0].puntoId).toMatch(/^[0-9a-f-]{36}$/i);
  await flushStoredGpsQueue('qa-owner', 'qa-trip', send);
  expect(send.mock.calls[0][0].puntoId).toBe(send.mock.calls[1][0].puntoId);
  expect(localStorage.getItem(key)).toBeNull();
});

it('preserves the queue if a backend does not explicitly acknowledge the new GPS protocol', async () => {
  localStorage.setItem(key, JSON.stringify([freshPoint()]));
  const api = { post: vi.fn().mockResolvedValue({ data: { success: true, data: { tracking: { id: 'old-server' } } } }) };
  await expect(flushStoredGpsQueue('qa-owner', 'qa-trip', sample => sendIdempotentGps(api, 'qa-trip', sample)))
    .rejects.toThrow('no confirmó');
  expect(api.post.mock.calls[0][0]).toBe('/manifiestos/qa-trip/ubicacion-idempotente');
  expect(JSON.parse(localStorage.getItem(key)!)).toHaveLength(1);
});

it('keeps the queue retryable with a clear message if the new route is unavailable', async () => {
  localStorage.setItem(key, JSON.stringify([freshPoint()]));
  const api = { post: vi.fn().mockRejectedValue({ response: { status: 404 } }) };
  await expect(flushStoredGpsQueue('qa-owner', 'qa-trip', sample => sendIdempotentGps(api, 'qa-trip', sample)))
    .rejects.toThrow('No se pudo verificar el viaje o el servidor');
  expect(JSON.parse(localStorage.getItem(key)!)).toHaveLength(1);
});

it('does not alter a stored point whose reference is malformed', async () => {
  const saved = JSON.stringify([{ ...point, puntoId: 'invalid' }]);
  localStorage.setItem(key, saved);
  const send = vi.fn();
  await expect(flushStoredGpsQueue('qa-owner', 'qa-trip', send)).rejects.toThrow('No se pudieron leer');
  expect(localStorage.getItem(key)).toBe(saved); expect(send).not.toHaveBeenCalled();
});


it('retains an undated legacy point instead of retransmitting it as current', async () => {
  localStorage.setItem(key, JSON.stringify([point]));
  const send = vi.fn();
  await expect(flushStoredGpsQueue('qa-owner', 'qa-trip', send)).rejects.toThrow('ubicación anterior');
  expect(send).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual([expect.objectContaining({ ...point, puntoId: expect.any(String) })]);
});
