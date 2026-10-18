import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { beginSessionEvidence } from '../../../cloud-qa/session-evidence';

let open: ReturnType<typeof vi.fn>;
let request: any;
let transaction: any;
let read: any;
let database: any;
let store: any;
const journal = () => (window as Window & { __sitrepQaSessionEvidence?: unknown[] }).__sitrepQaSessionEvidence;
const token = (id: string, iat: number) => `header.${btoa(JSON.stringify({ id, iat, email: 'not-to-be-exported', exp: iat + 3600 }))}.secret-signature`;
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear();
  delete (window as Window & { __sitrepQaSessionEvidence?: unknown[] }).__sitrepQaSessionEvidence;
  vi.stubGlobal('location', { origin: 'http://127.0.0.1:4177', pathname: '/app/inspecciones/qa' });
  read = {};
  store = { get: vi.fn(() => read), put: vi.fn(), delete: vi.fn(), clear: vi.fn() };
  transaction = { objectStore: vi.fn(() => store), abort: vi.fn() };
  database = { objectStoreNames: { contains: () => true }, transaction: vi.fn(() => transaction), close: vi.fn(), createObjectStore: vi.fn() };
  request = { result: database, transaction: { abort: vi.fn() } };
  open = vi.fn(() => request); vi.stubGlobal('indexedDB', { open });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('cannot inspect or create a journal outside the guarded synthetic origin', () => {
  vi.stubGlobal('location', { origin: 'https://sitrep.ultimamilla.com.ar', pathname: '/app/' });
  beginSessionEvidence(); expect(open).not.toHaveBeenCalled(); expect(journal()).toBeUndefined();
});

it('records startup identity metadata read-only, without leaking any token, refresh or unrelated claim', () => {
  const older = token('qa-admin', 10), saved = token('qa-inspector', 20);
  localStorage.setItem('sitrep_access_token', older); localStorage.setItem('sitrep_refresh_token', 'local-secret-refresh');
  const set = vi.spyOn(Storage.prototype, 'setItem'), remove = vi.spyOn(Storage.prototype, 'removeItem');
  beginSessionEvidence(); request.onsuccess();
  read.result = { accessToken: saved, refreshToken: 'durable-secret-refresh' }; read.onsuccess(); transaction.oncomplete();
  expect(database.transaction).toHaveBeenCalledWith('session', 'readonly'); expect(store.get).toHaveBeenCalledWith('current');
  expect(store.put).not.toHaveBeenCalled(); expect(store.delete).not.toHaveBeenCalled(); expect(store.clear).not.toHaveBeenCalled();
  expect(set).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  const encoded = JSON.stringify(journal());
  for (const secret of [older, saved, 'secret-signature', 'local-secret-refresh', 'durable-secret-refresh', 'not-to-be-exported']) expect(encoded).not.toContain(secret);
  expect(journal()).toEqual([
    expect.objectContaining({ stage: 'before-application-modules', local: { access: { present: true, validClaims: true, id: 'qa-admin', issuedAt: 10 }, refreshPresent: true } }),
    expect.objectContaining({ stage: 'durable-read', state: 'credential-pair', access: { present: true, validClaims: true, id: 'qa-inspector', issuedAt: 20 }, matchesLocalAccess: false, matchesLocalRefresh: false }),
  ]);
  expect(database.close).toHaveBeenCalledOnce();
});

it.each([null, undefined])('keeps logout and absence distinct without changing storage (%s)', value => {
  beginSessionEvidence(); request.onsuccess(); read.result = value; read.onsuccess(); transaction.oncomplete();
  expect(journal()?.[1]).toEqual(expect.objectContaining({ state: value === null ? 'logout-tombstone' : 'legacy-absence' }));
  expect(store.put).not.toHaveBeenCalled();
});

it('aborts a nonexistent database upgrade rather than creating a checkpoint', () => {
  beginSessionEvidence(); request.onupgradeneeded(); request.onerror();
  expect(request.transaction.abort).toHaveBeenCalledOnce(); expect(database.createObjectStore).not.toHaveBeenCalled();
  expect(journal()?.[1]).toEqual(expect.objectContaining({ state: 'database-absent' }));
  expect(journal()).toHaveLength(2);
});

it('bounds a blocked diagnostic open and closes its late connection without changing credentials', async () => {
  beginSessionEvidence(); await vi.advanceTimersByTimeAsync(2000); request.onsuccess();
  expect(journal()?.[1]).toEqual(expect.objectContaining({ state: 'diagnostic-timeout' }));
  expect(database.close).toHaveBeenCalledOnce(); expect(database.transaction).not.toHaveBeenCalled();
});
