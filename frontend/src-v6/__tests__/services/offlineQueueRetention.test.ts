import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', () => ({ default: {} }));

describe('offline queue retention', () => {
  let transaction: {
    oncomplete?: () => void; onabort?: () => void; onerror?: () => void;
    error: DOMException | null; abort: ReturnType<typeof vi.fn>;
    objectStore: () => { count: ReturnType<typeof vi.fn>; add: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  };
  let countRequest: { result: number; onsuccess?: () => void };
  let records: ReturnType<typeof transaction.objectStore>;

  beforeEach(() => {
    vi.resetModules();
    countRequest = { result: 0 };
    records = { count: vi.fn(() => countRequest), add: vi.fn(), delete: vi.fn() };
    transaction = { error: null, abort: vi.fn(() => transaction.onabort?.()), objectStore: () => records };
    vi.stubGlobal('indexedDB', { open: vi.fn(() => {
      const request: { result: unknown; onsuccess?: () => void } = { result: { transaction: () => transaction } };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    }) });
  });
  afterEach(() => vi.unstubAllGlobals());

  const action = { type: 'POST' as const, endpoint: '/manifiestos/1/incidente', data: { detalle: 'Prueba' }, userId: 'inspector-1' };

  it('rejects a full queue and preserves every prior unsent action', async () => {
    const { addToSyncQueue } = await import('../../services/indexeddb');
    const pending = addToSyncQueue(action);
    const assertion = expect(pending).rejects.toThrow('Los cambios pendientes se conservaron');
    await vi.waitFor(() => expect(countRequest.onsuccess).toBeTypeOf('function'));
    countRequest.result = 500;
    countRequest.onsuccess?.();
    await assertion;
    expect(records.add).not.toHaveBeenCalled();
    expect(records.delete).not.toHaveBeenCalled();
    expect(transaction.abort).toHaveBeenCalledTimes(1);
  });

  it('acknowledges a new action only after the write transaction commits', async () => {
    const { addToSyncQueue } = await import('../../services/indexeddb');
    const pending = addToSyncQueue(action);
    let settled = false;
    void pending.then(() => { settled = true; });
    await vi.waitFor(() => expect(countRequest.onsuccess).toBeTypeOf('function'));
    countRequest.result = 499;
    countRequest.onsuccess?.();
    expect(records.add).toHaveBeenCalledWith(expect.objectContaining(action));
    expect(settled).toBe(false);
    transaction.oncomplete?.();
    await pending;
    expect(settled).toBe(true);
  });
});
