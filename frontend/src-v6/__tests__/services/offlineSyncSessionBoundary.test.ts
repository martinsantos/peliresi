import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { gpsQueueKey } from '../../services/gpsQueue';
import { installMockGpsLocks } from '../utils/mockGpsLocks';

const mock = vi.hoisted(() => ({ post:vi.fn() }));
vi.mock('../../services/api', () => ({ default:{ post:mock.post } }));

let restoreLocks: () => void;
beforeEach(() => { restoreLocks = installMockGpsLocks(); vi.resetModules(); vi.clearAllMocks(); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); restoreLocks(); });

it('stops a queued delivery before sending another point under a different session', async () => {
  const actions = [{ id:1, type:'POST', endpoint:'/manifiestos/trip/confirmar-entrega', data:{}, userId:'account-a', createdAt:'2026-10-28T00:00:00Z' }];
  const writes = vi.fn();
  vi.stubGlobal('indexedDB', { open:vi.fn(() => {
    const request: { result:unknown; onsuccess?:()=>void } = { result:{ transaction:() => {
      const transaction: { oncomplete?:()=>void; objectStore:()=>unknown } = { objectStore:() => ({
        getAll:() => { const read: { result:unknown; onsuccess?:()=>void } = { result:[...actions] }; queueMicrotask(() => read.onsuccess?.()); return read; },
        delete:() => { writes(); queueMicrotask(() => transaction.oncomplete?.()); },
        put:() => { writes(); queueMicrotask(() => transaction.oncomplete?.()); },
      }) };
      return transaction;
    } } };
    queueMicrotask(() => request.onsuccess?.()); return request;
  }) });
  const first = { lat:-33.1, lng:-68.1, speed:null, heading:null }, second = { lat:-33.2, lng:-68.2, speed:null, heading:null };
  const key = gpsQueueKey('account-a', 'trip');
  localStorage.setItem(key, JSON.stringify([first, second]));
  let acknowledge!: (value: unknown) => void;
  mock.post.mockImplementationOnce(() => new Promise<unknown>(resolve => { acknowledge = resolve; }));
  let current = true;
  const { processSyncQueue } = await import('../../services/indexeddb');
  const processing = processSyncQueue('account-a', false, () => current);
  await vi.waitFor(() => expect(mock.post).toHaveBeenCalledOnce());
  current = false;
  const reference = mock.post.mock.calls[0][1].puntoId;
  acknowledge({ data: { success: true, data: { idempotencia: { version: 1, puntoId: reference } } } });
  const result = await processing;
  expect(result.pending).toBe(1);
  expect(mock.post).toHaveBeenCalledExactlyOnceWith('/manifiestos/trip/ubicacion-idempotente', { latitud:-33.1, longitud:-68.1, puntoId: expect.any(String) });
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual([{ ...second, puntoId: expect.any(String) }]);
  expect(writes).not.toHaveBeenCalled();
});

it('retains a queued delivery when another account has pending GPS on this device', async () => {
  const actions = [{ id:1, type:'POST', endpoint:'/manifiestos/trip/confirmar-entrega', data:{}, userId:'account-a', createdAt:'2026-10-28T00:00:00Z' }];
  const writes: unknown[] = [];
  vi.stubGlobal('indexedDB', { open:vi.fn(() => {
    const request: { result:unknown; onsuccess?:()=>void } = { result:{ transaction:() => {
      const transaction: { oncomplete?:()=>void; objectStore:()=>unknown } = { objectStore:() => ({
        getAll:() => { const read: { result:unknown; onsuccess?:()=>void } = { result:[...actions] }; queueMicrotask(() => read.onsuccess?.()); return read; },
        delete:() => { throw new Error('A pending delivery must not be removed'); },
        put:(value:unknown) => { writes.push(value); queueMicrotask(() => transaction.oncomplete?.()); },
      }) };
      return transaction;
    } } };
    queueMicrotask(() => request.onsuccess?.()); return request;
  }) });
  const foreignKey = gpsQueueKey('account-b', 'trip');
  const points = [{ lat:-33.2, lng:-68.2, speed:null, heading:null }];
  localStorage.setItem(foreignKey, JSON.stringify(points));
  const { processSyncQueue } = await import('../../services/indexeddb');
  const result = await processSyncQueue('account-a', false, () => true);
  expect(result.pending).toBe(1); expect(result.retryable).toBe(1); expect(result.lastError).toMatch(/otra cuenta/i);
  expect(mock.post).not.toHaveBeenCalled(); expect(writes).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem(foreignKey)!)).toEqual(points);
});

it('keeps an offline delivery pending while another page has this trip GPS, then retries', async () => {
  let actions = [{ id:1, type:'POST', endpoint:'/manifiestos/trip/confirmar-entrega', data:{}, userId:'account-a', createdAt:'2026-10-28T00:00:00Z' }];
  vi.stubGlobal('indexedDB', { open:vi.fn(() => {
    const request: { result:unknown; onsuccess?:()=>void } = { result:{ transaction:() => {
      const transaction: { oncomplete?:()=>void; objectStore:()=>unknown } = { objectStore:() => ({
        getAll:() => { const read: { result:unknown; onsuccess?:()=>void } = { result:[...actions] }; queueMicrotask(() => read.onsuccess?.()); return read; },
        delete:() => { actions = []; queueMicrotask(() => transaction.oncomplete?.()); },
        put:(value:typeof actions[number]) => { actions = [value]; queueMicrotask(() => transaction.oncomplete?.()); },
      }) };
      return transaction;
    } } };
    queueMicrotask(() => request.onsuccess?.()); return request;
  }) });
  const { startGpsLease } = await import('../../services/gpsCoordination');
  const { processSyncQueue } = await import('../../services/indexeddb');
  const tracker = startGpsLease('trip', () => {}, () => { throw new Error('expected tracker lease'); });
  const blocked = await processSyncQueue('account-a', true, () => true);
  expect(blocked.pending).toBe(1); expect(blocked.lastError).toMatch(/otra pestaña/i);
  expect(mock.post).not.toHaveBeenCalled();
  await tracker.release();
  mock.post.mockResolvedValue({});
  const retried = await processSyncQueue('account-a', true, () => true);
  expect(retried.processed).toBe(1); expect(retried.pending).toBe(0);
  expect(mock.post).toHaveBeenCalledExactlyOnceWith('/manifiestos/trip/confirmar-entrega', {});
});
