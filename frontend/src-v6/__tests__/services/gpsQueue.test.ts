import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushStoredGpsQueue, gpsPointPayload, gpsQueueKey, gpsTasksForTrip, readPendingGpsQueue, runExclusiveGpsTask, savePendingGpsQueue, trackGpsTask } from '../../services/gpsQueue';

const first = { lat: -33.1, lng: -68.1, speed: null, heading: null };
const second = { lat: -33.2, lng: -68.2, speed: null, heading: null };
const key = gpsQueueKey('carrier-a', 'trip');

describe('GPS queue before an offline delivery', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('omits unavailable optional measurements and preserves valid zero values', () => {
    expect(gpsPointPayload(first)).toEqual({ latitud:-33.1, longitud:-68.1 });
    expect(gpsPointPayload({ ...first, speed:0, heading:0 })).toEqual({ latitud:-33.1, longitud:-68.1, velocidad:0, direccion:0 });
  });

  it('preserves only unacknowledged points if the connection fails partway through', async () => {
    localStorage.setItem(key, JSON.stringify([first, second]));
    const send = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline'));
    await expect(flushStoredGpsQueue('carrier-a', 'trip', send)).rejects.toThrow('offline');
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([{ ...second, puntoId: expect.any(String) }]);
    await flushStoredGpsQueue('carrier-a', 'trip', send);
    expect(send.mock.calls.map(([point]) => point)).toEqual([
      { ...first, puntoId: expect.any(String) }, { ...second, puntoId: expect.any(String) }, { ...second, puntoId: expect.any(String) },
    ]);
    expect(send.mock.calls[1][0].puntoId).toBe(send.mock.calls[2][0].puntoId);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('does not clear malformed GPS data or proceed as if it were empty', async () => {
    localStorage.setItem(key, '{bad json');
    const send = vi.fn();
    await expect(flushStoredGpsQueue('carrier-a', 'trip', send)).rejects.toThrow('No se pudieron leer');
    expect(localStorage.getItem(key)).toBe('{bad json');
    expect(send).not.toHaveBeenCalled();
  });

  it('isolates two accounts and retains unowned legacy data for review', async () => {
    expect(gpsQueueKey('a_b', 'c')).not.toBe(gpsQueueKey('a', 'b_c'));
    expect(savePendingGpsQueue('carrier-a', 'trip', [first])).toBe(true);
    expect(readPendingGpsQueue('carrier-b', 'trip')).toEqual({ ok:true, durable:true, points:[] });
    expect(readPendingGpsQueue('carrier-a', 'trip')).toEqual({ ok:true, durable:true, points:[first] });
    localStorage.setItem('gps_pending_trip', JSON.stringify([second]));
    const send = vi.fn();
    await expect(flushStoredGpsQueue('carrier-b', 'trip', send)).rejects.toThrow('sin titular identificado');
    expect(localStorage.getItem('gps_pending_trip')).toBe(JSON.stringify([second]));
    expect(localStorage.getItem(key)).toBe(JSON.stringify([first]));
    expect(send).not.toHaveBeenCalled();
  });

  it('does not send or remove another account’s pending points before a transition', async () => {
    const foreign = gpsQueueKey('carrier-b', 'trip');
    localStorage.setItem(foreign, JSON.stringify([second]));
    const send = vi.fn();
    await expect(flushStoredGpsQueue('carrier-a', 'trip', send)).rejects.toThrow('otra cuenta');
    expect(send).not.toHaveBeenCalled(); expect(localStorage.getItem(foreign)).toBe(JSON.stringify([second]));
    localStorage.setItem(foreign, '[]');
    await expect(flushStoredGpsQueue('carrier-a', 'trip', send)).resolves.toBeUndefined();
  });

  it('keeps malformed foreign queues for review rather than treating them as empty', async () => {
    const foreign = gpsQueueKey('carrier-b', 'trip');
    localStorage.setItem(foreign, '{incomplete');
    await expect(flushStoredGpsQueue('carrier-a', 'trip', vi.fn())).rejects.toThrow('otra cuenta');
    expect(localStorage.getItem(foreign)).toBe('{incomplete');
  });

  it('waits for an active upload and prevents another same-page task from overlapping', async () => {
    let finish!: () => void;
    const firstTask = new Promise<void>(resolve => { finish = resolve; });
    trackGpsTask('trip', firstTask);
    const work = vi.fn(async () => {});
    const delivery = runExclusiveGpsTask('trip', work);
    expect(gpsTasksForTrip('trip')).toHaveLength(2);
    expect(work).not.toHaveBeenCalled();
    finish(); await delivery;
    expect(work).toHaveBeenCalledOnce();
    expect(gpsTasksForTrip('trip')).toHaveLength(0);
  });
});
