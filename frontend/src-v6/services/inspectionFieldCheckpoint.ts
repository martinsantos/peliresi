/** Confirmed field snapshots, scoped to the existing user/case draft key.
 * localStorage remains a typing journal, never the durable acknowledgment. */
const DATABASE = 'sitrep-inspection-field-v1';
const STORE = 'drafts';
const pending = new Map<string, Promise<void>>();
let lastTime = 0;
type Checkpoint = { value: string | null; recordedAt: number };
const failure = () => new Error('No se confirmó la copia local de la inspección. No cierres esta pantalla.');

function transaction<T>(key: string, mode: IDBTransactionMode, value?: Checkpoint): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let db: IDBDatabase | undefined;
    let tx: IDBTransaction | undefined;
    let result: T;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); db?.close();
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => { try { tx?.abort(); } catch { /* already ended */ } finish(failure()); }, 5000);
    try {
      if (!key.startsWith('sitrep_inspection_draft_') || !globalThis.indexedDB) throw failure();
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
      request.onerror = () => finish(failure());
      request.onsuccess = () => {
        db = request.result;
        if (settled) { db.close(); return; }
        db.onversionchange = () => { db?.close(); finish(failure()); };
        try {
          tx = mode === 'readwrite' ? db.transaction(STORE, mode, { durability: 'strict' }) : db.transaction(STORE, mode);
          tx.onabort = tx.onerror = () => finish(failure());
          tx.oncomplete = () => finish();
          const store = tx.objectStore(STORE);
          if (mode === 'readwrite') {
            const current = store.get(key);
            current.onsuccess = () => {
              const prior = current.result as Checkpoint | undefined;
              if (prior && typeof prior.recordedAt === 'number' && value && prior.recordedAt > value.recordedAt) {
                finish(failure()); try { tx?.abort(); } catch { /* already ended */ } return;
              }
              store.put(value, key);
            };
          }
          else { const read = store.get(key); read.onsuccess = () => { result = read.result as T; }; }
        } catch { finish(failure()); }
      };
    } catch { finish(failure()); }
  });
}

export function writeInspectionFieldCheckpoint(key: string, value: string | null): Promise<void> {
  lastTime = Math.max(Date.now(), lastTime + 1);
  let recordedAt = lastTime;
  if (value) try {
    const parsed = JSON.parse(value);
    if (typeof parsed.checkpointAt === 'number' && Number.isFinite(parsed.checkpointAt)) recordedAt = parsed.checkpointAt;
  } catch { /* Legacy raw text still receives an ordered checkpoint. */ }
  lastTime = Math.max(lastTime, recordedAt);
  const checkpoint = { value, recordedAt };
  const previous = pending.get(key) || Promise.resolve();
  const saving = previous.catch(() => undefined).then(() => transaction<void>(key, 'readwrite', checkpoint));
  pending.set(key, saving);
  // Attach rejection handling immediately, but callers still receive failure.
  void saving.finally(() => { if (pending.get(key) === saving) pending.delete(key); }).catch(() => undefined);
  return saving;
}

export async function readInspectionFieldCheckpoint(key: string): Promise<string | null | undefined> {
  await pending.get(key);
  const value = await transaction<unknown>(key, 'readonly');
  if (value === undefined || value === null || typeof value === 'string') return value;
  if (typeof value === 'object' && 'recordedAt' in value && typeof value.recordedAt === 'number'
    && Number.isFinite(value.recordedAt) && 'value' in value && (value.value === null || typeof value.value === 'string')) {
    lastTime = Math.max(lastTime, value.recordedAt); return value.value;
  }
  throw failure();
}
