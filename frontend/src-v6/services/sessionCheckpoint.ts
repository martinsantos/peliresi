/** A single acknowledged credential pair, independent of Chrome's delayed
 * localStorage flush. Never store passwords or use this as authorization. */
export interface SessionCheckpoint { accessToken: string; refreshToken: string }
export class SessionCheckpointConflict extends Error {
  constructor() { super('Session changed in durable storage'); this.name = 'SessionCheckpointConflict'; }
}
const DB_NAME = 'sitrep-session-v1';
const STORE = 'session';
const failure = () => new Error('No se confirmó el almacenamiento de la sesión. Reintentá el ingreso.');

function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, result: (value: T) => void, fail: (error: Error) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let db: IDBDatabase | undefined;
    let tx: IDBTransaction | undefined;
    let result: T;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      db?.close();
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => {
      try { tx?.abort(); } catch { /* already complete */ }
      finish(failure());
    }, 5000);
    try {
      if (!globalThis.indexedDB) throw failure();
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onerror = () => finish(failure());
      request.onsuccess = () => {
        db = request.result;
        if (settled) { db.close(); return; }
        db.onversionchange = () => { db?.close(); finish(failure()); };
        try {
          tx = mode === 'readwrite'
            ? db.transaction(STORE, mode, { durability: 'strict' })
            : db.transaction(STORE, mode);
          tx.onabort = tx.onerror = () => finish(failure());
          tx.oncomplete = () => finish();
          operation(tx.objectStore(STORE), value => { result = value; }, error => {
            finish(error);
            try { tx?.abort(); } catch { /* already terminated */ }
          });
        } catch { finish(failure()); }
      };
    } catch { finish(failure()); }
  });
}

export const writeSessionCheckpoint = (value: SessionCheckpoint | null, expected?: SessionCheckpoint): Promise<void> =>
  transaction('readwrite', (store, _result, fail) => {
    if (!expected) { store.put(value, 'current'); return; }
    // A refresh from an older tab cannot overwrite a newer login, even before
    // its storage event arrives. Compare and replace in the SAME transaction.
    const request = store.get('current');
    request.onsuccess = () => {
      const current = request.result as SessionCheckpoint | null | undefined;
      if (current?.accessToken !== expected.accessToken || current?.refreshToken !== expected.refreshToken) {
        fail(new SessionCheckpointConflict()); return;
      }
      store.put(value, 'current');
    };
  });

export const readSessionCheckpoint = (): Promise<SessionCheckpoint | null | undefined> =>
  transaction<unknown>('readonly', (store, result) => {
    const request = store.get('current');
    request.onsuccess = () => result(request.result);
  }).then(value => {
    // undefined means legacy install; null is an explicit logout, not absence.
    if (value === undefined || value === null) return value;
    if (typeof value === 'object' && 'accessToken' in value && 'refreshToken' in value
      && typeof value.accessToken === 'string' && value.accessToken.length > 0
      && typeof value.refreshToken === 'string' && value.refreshToken.length > 0) {
      return { accessToken: value.accessToken, refreshToken: value.refreshToken };
    }
    throw failure();
  });
