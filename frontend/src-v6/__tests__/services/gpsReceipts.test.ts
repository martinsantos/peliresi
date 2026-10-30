import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { gpsContextScope,gpsQueueKey } from '../../services/gpsQueue';

const mock = vi.hoisted(() => ({ get: vi.fn(), owner: 'carrier-a', context: 'carrier-a:transportista' }));
vi.mock('../../services/api', () => ({ default: { get: mock.get } }));
vi.mock('../../utils/supportSession', () => ({
  supportRequestContext: () => mock.context,
  supportSessionMatches: (owner: string) => owner === mock.owner,
}));
import { verifyStoredGpsReceipts } from '../../services/gpsReceipts';

const id = 'qa-trip', key = gpsQueueKey('carrier-a', id);
const point = { lat: -33.1, lng: -68.9, speed: null, heading: null, puntoId: '2d65f4f5-6892-42e1-958d-bd23b6d54a76' };
const confirmation = (p = point) => ({ data: { success: true, data: { idempotencia: { version: 1, puntoId: p.puntoId, confirmado: true }, tracking: { latitud: p.lat, longitud: p.lng, velocidad: p.speed, direccion: p.heading } } } });
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); mock.owner = 'carrier-a'; mock.context = 'carrier-a:transportista'; mock.get.mockResolvedValue(confirmation()); });
afterEach(() => localStorage.clear());

it('verifies a receipt without changing the stored GPS queue', async () => {
  const original = JSON.stringify([point]); localStorage.setItem(key, original);
  await expect(verifyStoredGpsReceipts('carrier-a', id)).resolves.toEqual({ checked: 1, confirmed: 1, unconfirmed: 0 });
  expect(localStorage.getItem(key)).toBe(original);
  expect(mock.get).toHaveBeenCalledWith(`/manifiestos/${id}/ubicaciones/${point.puntoId}/confirmacion`);
});

it('does not claim receipt for unknown, changed or older points and keeps them intact', async () => {
  const second = { ...point, puntoId: '3d65f4f5-6892-42e1-958d-bd23b6d54a76' };
  const third = { lat: -33.2, lng: -68.8, speed: null, heading: null };
  const original = JSON.stringify([point, second, third]); localStorage.setItem(key, original);
  mock.get.mockResolvedValueOnce(confirmation()).mockRejectedValueOnce({ response: { status: 404 } });
  await expect(verifyStoredGpsReceipts('carrier-a', id)).resolves.toEqual({ checked: 3, confirmed: 1, unconfirmed: 2 });
  expect(localStorage.getItem(key)).toBe(original); expect(mock.get).toHaveBeenCalledTimes(2);
  mock.get.mockResolvedValueOnce(confirmation({ ...point, lat: -33.5 })); localStorage.setItem(key, JSON.stringify([point]));
  await expect(verifyStoredGpsReceipts('carrier-a', id)).resolves.toEqual({ checked: 1, confirmed: 0, unconfirmed: 1 });
});

it('does not confirm an incomplete receipt whose optional tracking fields are absent', async () => {
  const original = JSON.stringify([point]); localStorage.setItem(key, original);
  const incomplete = confirmation();
  delete (incomplete.data.data.tracking as { velocidad?: number | null }).velocidad;
  mock.get.mockResolvedValueOnce(incomplete);
  await expect(verifyStoredGpsReceipts('carrier-a', id)).resolves.toEqual({ checked: 1, confirmed: 0, unconfirmed: 1 });
  expect(localStorage.getItem(key)).toBe(original);
});

it('retains the queue and reports a changed account or activity while requests are in flight', async () => {
  const original = JSON.stringify([point]); localStorage.setItem(key, original);
  mock.get.mockImplementationOnce(async () => { mock.context = 'carrier-a:otra-actividad'; return confirmation(); });
  await expect(verifyStoredGpsReceipts('carrier-a', id)).rejects.toThrow('cuenta o actividad cambió');
  expect(localStorage.getItem(key)).toBe(original);
});

it('does not query receipts from a stale rendered activity', async () => {
  const scope=gpsContextScope('company-a','old-session'),scopedKey=gpsQueueKey('carrier-a',id,scope);
  localStorage.setItem(scopedKey,JSON.stringify([point]));
  await expect(verifyStoredGpsReceipts('carrier-a',id,scope)).rejects.toThrow('cuenta o actividad cambió');
  expect(mock.get).not.toHaveBeenCalled();expect(JSON.parse(localStorage.getItem(scopedKey)!)).toEqual([point]);
});

it('does not report a stale count if another tab changes the queue while checking', async () => {
  localStorage.setItem(key, JSON.stringify([point]));
  mock.get.mockImplementationOnce(async () => { localStorage.setItem(key, JSON.stringify([point, { ...point, puntoId: '3d65f4f5-6892-42e1-958d-bd23b6d54a76' }])); return confirmation(); });
  await expect(verifyStoredGpsReceipts('carrier-a', id)).rejects.toThrow('cambiaron durante la comprobación');
  expect(JSON.parse(localStorage.getItem(key)!)).toHaveLength(2);
});

it('retains unowned or malformed old queues instead of treating them as empty', async () => {
  localStorage.setItem('gps_pending_qa-trip', JSON.stringify([point]));
  await expect(verifyStoredGpsReceipts('carrier-a', id)).rejects.toThrow('sin titular');
  expect(mock.get).not.toHaveBeenCalled(); expect(localStorage.getItem('gps_pending_qa-trip')).not.toBeNull();
  localStorage.removeItem('gps_pending_qa-trip'); localStorage.setItem(key, '{bad');
  await expect(verifyStoredGpsReceipts('carrier-a', id)).rejects.toThrow('leer'); expect(localStorage.getItem(key)).toBe('{bad');
});
