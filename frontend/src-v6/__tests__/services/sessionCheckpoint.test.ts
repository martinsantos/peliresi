import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let stored: unknown;
let tx: any;
let db: any;
beforeEach(() => {
  vi.resetModules();
  stored = undefined;
  tx = undefined;
  db = { close: vi.fn(), objectStoreNames: { contains: () => true }, transaction: vi.fn(() => {
    tx = { error: null, abort: vi.fn(), objectStore: () => ({
      get: () => { const request = { result: stored, onsuccess: undefined as any }; queueMicrotask(() => { request.onsuccess?.(); tx.read = true; }); return request; },
      put: vi.fn((value: unknown) => { tx.pending = value; }),
    }) };
    return tx;
  }) };
  vi.stubGlobal('indexedDB', { open: () => {
    const request = { result: db, onsuccess: undefined as any };
    queueMicrotask(() => request.onsuccess?.()); return request;
  } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('acknowledges the complete credential pair only after a strict transaction commits', async () => {
  const { writeSessionCheckpoint } = await import('../../services/sessionCheckpoint');
  let confirmed = false;
  const saving = writeSessionCheckpoint({ accessToken: 'inspector-access', refreshToken: 'inspector-refresh' }).then(() => { confirmed = true; });
  await vi.waitFor(() => expect(tx?.oncomplete).toBeTypeOf('function'));
  expect(db.transaction).toHaveBeenCalledWith('session', 'readwrite', { durability: 'strict' });
  expect(confirmed).toBe(false);
  expect(tx.pending).toEqual({ accessToken: 'inspector-access', refreshToken: 'inspector-refresh' });
  stored = tx.pending; tx.oncomplete(); await saving;
  expect(confirmed).toBe(true); expect(db.close).toHaveBeenCalledOnce();
});

it('rejects aborted writes instead of allowing navigation with an unconfirmed identity', async () => {
  const { writeSessionCheckpoint } = await import('../../services/sessionCheckpoint');
  const saving = writeSessionCheckpoint(null);
  const rejection = expect(saving).rejects.toThrow('sesión');
  await vi.waitFor(() => expect(tx?.onabort).toBeTypeOf('function'));
  tx.onabort(); await rejection; expect(db.close).toHaveBeenCalledOnce();
});

it.each([undefined, null, { accessToken: 'inspector', refreshToken: 'refresh' }])('distinguishes legacy absence, logout tombstone and committed session (%j)', async value => {
  stored = value;
  const { readSessionCheckpoint } = await import('../../services/sessionCheckpoint');
  const reading = readSessionCheckpoint();
  await vi.waitFor(() => expect(tx?.read).toBe(true));
  tx.oncomplete(); expect(await reading).toEqual(value);
});

it('rejects a torn credential pair rather than falling back to an older administrator', async () => {
  stored = { accessToken: 'inspector' };
  const { readSessionCheckpoint } = await import('../../services/sessionCheckpoint');
  const reading = readSessionCheckpoint();
  const rejection = expect(reading).rejects.toThrow('sesión');
  await vi.waitFor(() => expect(tx?.read).toBe(true));
  tx.oncomplete(); await rejection;
});

it('does not silently degrade to localStorage when durable storage is unavailable', async () => {
  vi.stubGlobal('indexedDB', undefined);
  const { writeSessionCheckpoint } = await import('../../services/sessionCheckpoint');
  await expect(writeSessionCheckpoint(null)).rejects.toThrow('sesión');
});

it('rejects an old tab refresh atomically when durable storage already belongs to another account', async () => {
  stored = { accessToken: 'new-inspector', refreshToken: 'new-refresh' };
  const { writeSessionCheckpoint } = await import('../../services/sessionCheckpoint');
  await expect(writeSessionCheckpoint({ accessToken: 'old-admin-renewed', refreshToken: 'old-admin-refresh-2' },
    { accessToken: 'old-admin', refreshToken: 'old-admin-refresh' })).rejects.toThrow('Session changed');
  expect(tx.pending).toBeUndefined(); expect(tx.abort).toHaveBeenCalledOnce();
});

it('renews only the matching durable pair inside the same strict transaction', async () => {
  const previous = { accessToken: 'inspector', refreshToken: 'refresh' };
  const next = { accessToken: 'inspector-2', refreshToken: 'refresh-2' };
  stored = previous;
  const { writeSessionCheckpoint } = await import('../../services/sessionCheckpoint');
  const saving = writeSessionCheckpoint(next, previous);
  await vi.waitFor(() => expect(tx?.pending).toEqual(next));
  tx.oncomplete(); await saving;
  expect(db.transaction).toHaveBeenCalledOnce();
});

it('bounds a blocked database open and closes a late connection', async () => {
  vi.useFakeTimers();
  const request: any = { result: db };
  vi.stubGlobal('indexedDB', { open: () => request });
  const { readSessionCheckpoint } = await import('../../services/sessionCheckpoint');
  const reading = readSessionCheckpoint();
  const rejection = expect(reading).rejects.toThrow('sesión');
  await vi.advanceTimersByTimeAsync(5000); await rejection;
  request.onsuccess(); expect(db.close).toHaveBeenCalledOnce();
});
