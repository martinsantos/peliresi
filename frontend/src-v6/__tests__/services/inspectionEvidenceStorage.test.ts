import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', () => ({ default: {} }));

describe('evidence IndexedDB transaction acknowledgement', () => {
  let transaction: { onabort?: () => void; oncomplete?: () => void; onerror?: () => void; error: DOMException | null; objectStore: () => { put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> } };
  beforeEach(() => {
    vi.resetModules();
    const store = { put: vi.fn(), delete: vi.fn() };
    transaction = { error: null, objectStore: () => store };
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
});
