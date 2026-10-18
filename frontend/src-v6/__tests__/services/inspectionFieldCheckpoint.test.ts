import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const key = 'sitrep_inspection_draft_inspector_case';
let records: Map<string, unknown>;
let transactions: any[];
let db: any;
beforeEach(() => {
  vi.resetModules(); records = new Map(); transactions = [];
  db = { close: vi.fn(), objectStoreNames: { contains: () => true }, transaction: vi.fn(() => {
    const tx: any = { abort: vi.fn(), objectStore: () => ({
      get: (id: string) => { const request: any = { result: records.get(id) }; queueMicrotask(() => { request.onsuccess?.(); tx.read = true; }); return request; },
      put: (value: unknown, id: string) => { tx.pending = { value, id }; },
    }) }; transactions.push(tx); return tx;
  }) };
  vi.stubGlobal('indexedDB', { open: () => { const request: any = { result: db }; queueMicrotask(() => request.onsuccess?.()); return request; } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
async function latest() { await vi.waitFor(() => expect(transactions.at(-1)?.oncomplete).toBeTypeOf('function')); return transactions.at(-1); }
function commit(tx: any) { if (tx.pending) records.set(tx.pending.id, tx.pending.value); tx.oncomplete(); }

it('confirms scoped field text only after a strict transaction completes', async () => {
  const { writeInspectionFieldCheckpoint } = await import('../../services/inspectionFieldCheckpoint');
  let acknowledged = false;
  const saving = writeInspectionFieldCheckpoint(key, 'unsent testimony').then(() => { acknowledged = true; });
  const tx = await latest();
  expect(db.transaction).toHaveBeenCalledWith('drafts', 'readwrite', { durability: 'strict' });
  expect(tx.pending).toEqual({ id: key, value: { value: 'unsent testimony', recordedAt: expect.any(Number) } }); expect(acknowledged).toBe(false);
  commit(tx); await saving; expect(acknowledged).toBe(true); expect(db.close).toHaveBeenCalled();
});

it('retains the preceding confirmed copy when the replacement aborts', async () => {
  records.set(key, 'original testimony');
  const { writeInspectionFieldCheckpoint } = await import('../../services/inspectionFieldCheckpoint');
  const saving = writeInspectionFieldCheckpoint(key, 'replacement'); const rejection = expect(saving).rejects.toThrow('copia local');
  const tx = await latest(); tx.onabort(); await rejection;
  expect(records.get(key)).toBe('original testimony');
});

it.each([undefined, null, 'committed unsent text'])('distinguishes legacy absence, discard and durable text (%j)', async value => {
  records.set(key, value);
  const { readInspectionFieldCheckpoint } = await import('../../services/inspectionFieldCheckpoint');
  const reading = readInspectionFieldCheckpoint(key); const tx = await latest();
  await vi.waitFor(() => expect(tx.read).toBe(true)); commit(tx); expect(await reading).toBe(value);
});

it('does not read another inspector or another inspection copy', async () => {
  records.set('sitrep_inspection_draft_other_case', 'foreign testimony');
  const { readInspectionFieldCheckpoint } = await import('../../services/inspectionFieldCheckpoint');
  const reading = readInspectionFieldCheckpoint(key); const tx = await latest();
  await vi.waitFor(() => expect(tx.read).toBe(true)); commit(tx); expect(await reading).toBeUndefined();
});

it('serializes updates and a discard so an earlier pending write cannot resurrect the draft', async () => {
  const { writeInspectionFieldCheckpoint } = await import('../../services/inspectionFieldCheckpoint');
  const first = writeInspectionFieldCheckpoint(key, 'pending edit'); const discarded = writeInspectionFieldCheckpoint(key, null);
  const tx = await latest(); await vi.waitFor(() => expect(tx.pending).toBeDefined()); expect(transactions).toHaveLength(1); commit(tx); await first;
  await vi.waitFor(() => expect(transactions).toHaveLength(2)); const second = transactions[1]; await vi.waitFor(() => expect(second.pending).toBeDefined()); commit(second); await discarded;
  expect(records.get(key)).toMatchObject({ value: null });
});

it('rejects a delayed former-owner write instead of replacing a newer committed field copy', async () => {
  records.set(key, { value: 'new owner testimony', recordedAt: 200 });
  const { writeInspectionFieldCheckpoint } = await import('../../services/inspectionFieldCheckpoint');
  await expect(writeInspectionFieldCheckpoint(key, JSON.stringify({ checkpointAt: 100, observaciones: 'old owner edit' }))).rejects.toThrow('copia local');
  expect(records.get(key)).toEqual({ value: 'new owner testimony', recordedAt: 200 });
});

it('fails rather than claiming a durable copy when IndexedDB is unavailable', async () => {
  vi.stubGlobal('indexedDB', undefined);
  const { writeInspectionFieldCheckpoint } = await import('../../services/inspectionFieldCheckpoint');
  await expect(writeInspectionFieldCheckpoint(key, 'text')).rejects.toThrow('copia local');
});

it('bounds a blocked open and closes a late database connection', async () => {
  vi.useFakeTimers(); const request: any = { result: db };
  vi.stubGlobal('indexedDB', { open: () => request });
  const { readInspectionFieldCheckpoint } = await import('../../services/inspectionFieldCheckpoint');
  const reading = readInspectionFieldCheckpoint(key); const rejection = expect(reading).rejects.toThrow('copia local');
  await vi.advanceTimersByTimeAsync(5000); await rejection; request.onsuccess(); expect(db.close).toHaveBeenCalledOnce();
});
