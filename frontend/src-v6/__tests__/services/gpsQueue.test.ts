import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushStoredGpsQueue, gpsContextScope, gpsScopeMatchesRequest, gpsPointPayload, gpsQueueKey, gpsTasksForTrip, hasVolatileGpsQueue, readPendingGpsQueue, runExclusiveGpsTask, savePendingGpsQueue, trackGpsTask } from '../../services/gpsQueue';

const first = { lat: -33.1, lng: -68.1, speed: null, heading: null };
const second = { lat: -33.2, lng: -68.2, speed: null, heading: null };
const key = gpsQueueKey('carrier-a', 'trip');

describe('GPS queue before an offline delivery', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('warns before closing while a point exists only in page memory', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(savePendingGpsQueue('carrier-a', 'volatile-test', [first])).toBe(false);
    expect(hasVolatileGpsQueue('carrier-a', 'volatile-test')).toBe(true);
    const closing = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(closing);
    expect(closing.defaultPrevented).toBe(true);
    set.mockRestore(); expect(savePendingGpsQueue('carrier-a', 'volatile-test', [first])).toBe(true);
    expect(hasVolatileGpsQueue('carrier-a', 'volatile-test')).toBe(false);
    const safe = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(safe);
    expect(safe.defaultPrevented).toBe(false);
  });

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

  it('keeps each activity queue separate and blocks a transition until the other is synchronized', async () => {
    const keyA = gpsQueueKey('carrier-a', 'trip', 'company-a');
    const keyB = gpsQueueKey('carrier-a', 'trip', 'company-b');
    expect(keyA).not.toBe(keyB);
    expect(savePendingGpsQueue('carrier-a', 'trip', [first], 'company-a')).toBe(true);
    expect(readPendingGpsQueue('carrier-a', 'trip', 'company-b')).toMatchObject({ ok: true, points: [] });
    const sendB = vi.fn();
    await expect(flushStoredGpsQueue('carrier-a', 'trip', sendB, 'company-b')).rejects.toThrow('otra actividad');
    expect(sendB).not.toHaveBeenCalled(); expect(JSON.parse(localStorage.getItem(keyA)!)).toEqual([first]);
    const sendA = vi.fn().mockResolvedValue(undefined);
    await flushStoredGpsQueue('carrier-a', 'trip', sendA, 'company-a');
    expect(sendA).toHaveBeenCalledOnce(); expect(localStorage.getItem(keyA)).toBeNull();
  });

  it('distinguishes a temporary view from a personal session without storing credentials', () => {
    const personal = gpsContextScope('same-user-and-activity', '["user","TRANSPORTISTA",null,false,null,null]');
    const temporary = gpsContextScope('same-user-and-activity', '["user","TRANSPORTISTA","admin",false,null,null]');
    expect(personal).not.toBe(temporary);
    expect(gpsContextScope('', 'session')).toBe(''); expect(gpsContextScope('owner', '')).toBe('');
    expect(gpsScopeMatchesRequest(personal,'["user","TRANSPORTISTA",null,false,null,null]')).toBe(true);
    expect(gpsScopeMatchesRequest(personal,'["user","TRANSPORTISTA","admin",false,null,null]')).toBe(false);
  });

  it('preserves an old account-only queue without assigning it to the current activity', async () => {
    const raw = JSON.stringify([first]); localStorage.setItem(key, raw);
    expect(readPendingGpsQueue('carrier-a', 'trip', 'company-a')).toEqual({ ok: false, reason: 'unscoped' });
    const send = vi.fn();
    await expect(flushStoredGpsQueue('carrier-a', 'trip', send, 'company-a')).rejects.toThrow('sin actividad identificada');
    expect(send).not.toHaveBeenCalled(); expect(localStorage.getItem(key)).toBe(raw);
    localStorage.setItem(key, '[]');
    expect(readPendingGpsQueue('carrier-a', 'trip', 'company-a')).toMatchObject({ ok: true, points: [] });
  });

  it('does not send points belonging to a different account or authorization scope', async () => {
    const foreign = gpsQueueKey('carrier-b', 'trip', 'other-company');
    localStorage.setItem(foreign, JSON.stringify([second]));
    const send = vi.fn();
    await expect(flushStoredGpsQueue('carrier-a', 'trip', send, 'company-a')).rejects.toThrow('otra cuenta');
    expect(send).not.toHaveBeenCalled(); expect(localStorage.getItem(foreign)).not.toBeNull();
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
