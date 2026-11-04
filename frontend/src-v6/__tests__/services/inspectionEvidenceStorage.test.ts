import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', () => ({ default: {} }));

describe('evidence IndexedDB transaction acknowledgement', () => {
  let read: { result?: unknown; onsuccess?: () => void };
  let transaction: { onabort?: () => void; oncomplete?: () => void; onerror?: () => void; error: DOMException | null; abort: () => void; objectStore: () => { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> } };
  beforeEach(() => {
    vi.resetModules();
    read = {};
    const store = { get: vi.fn(() => read), put: vi.fn(), delete: vi.fn() };
    transaction = { error: null, abort: () => transaction.onabort?.(), objectStore: () => store };
    vi.stubGlobal('indexedDB', { open: vi.fn(() => {
      const request: { result: unknown; onsuccess?: () => void } = { result: { transaction: () => transaction } };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    }) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('rejects an aborted save instead of confirming or hanging forever', async () => {
    const { saveOffline } = await import('../../services/indexeddb');
    const result = saveOffline('inspection_evidence_queue', { id: 'photo' });
    const assertion = expect(result).rejects.toThrow('No se confirmó el guardado local');
    await vi.waitFor(() => expect(transaction.onabort).toBeTypeOf('function'));
    transaction.onabort?.();
    await assertion;
  });

  it('rejects an aborted removal so the pending copy is not reported as discarded', async () => {
    const { removeOffline } = await import('../../services/indexeddb');
    const result = removeOffline('inspection_evidence_queue', 'photo');
    const assertion = expect(result).rejects.toThrow('No se confirmó la eliminación local');
    await vi.waitFor(() => expect(transaction.onabort).toBeTypeOf('function'));
    transaction.onabort?.();
    await assertion;
  });

  it('uses one transaction for replacement and rejects the entire replacement on abort', async () => {
    const { replaceOffline } = await import('../../services/indexeddb');
    const result = replaceOffline('inspection_evidence_queue', 'original', { id: 'corrected' });
    const assertion = expect(result).rejects.toThrow('No se confirmó el reemplazo local');
    await vi.waitFor(() => expect(transaction.onabort).toBeTypeOf('function'));
    expect(transaction.objectStore().put).toHaveBeenCalledWith({ id: 'corrected' });
    expect(transaction.objectStore().delete).toHaveBeenCalledWith('original');
    transaction.onabort?.();
    await assertion;
  });

  it('does not acknowledge a command claim until its read/write transaction commits', async () => {
    const { updateOffline } = await import('../../services/indexeddb');
    let acknowledged = false;
    const result = updateOffline<{ id: string }>('inspection_exchange_drafts', 'command', current => current || { id: 'command' }).then(value => { acknowledged = true; return value; });
    await vi.waitFor(() => expect(read.onsuccess).toBeTypeOf('function'));
    read.onsuccess?.();
    expect(transaction.objectStore().get).toHaveBeenCalledWith('command');
    expect(transaction.objectStore().put).toHaveBeenCalledWith({ id: 'command' });
    await Promise.resolve(); expect(acknowledged).toBe(false);
    transaction.oncomplete?.();
    expect(await result).toEqual({ id: 'command' });
  });

  it('rejects an aborted command claim even when put has succeeded', async () => {
    const { updateOffline } = await import('../../services/indexeddb');
    const result = updateOffline('inspection_exchange_drafts', 'command', () => ({ id: 'command' }));
    const assertion = expect(result).rejects.toThrow('No se confirmó la copia del envío');
    await vi.waitFor(() => expect(read.onsuccess).toBeTypeOf('function'));
    read.onsuccess?.(); transaction.onabort?.(); await assertion;
  });

  it('aborts without replacement if the command updater rejects another tab content', async () => {
    const { updateOffline } = await import('../../services/indexeddb');
    const result = updateOffline('inspection_exchange_drafts', 'command', () => { throw new Error('immutable conflict'); });
    const assertion = expect(result).rejects.toThrow('immutable conflict');
    await vi.waitFor(() => expect(read.onsuccess).toBeTypeOf('function'));
    read.onsuccess?.(); await assertion;
    expect(transaction.objectStore().put).not.toHaveBeenCalled();
    expect(transaction.objectStore().delete).not.toHaveBeenCalled();
  });
});
