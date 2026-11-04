/** Device-local support journal. Separate from API caches and automatic sync queues. */
let connection: Promise<IDBDatabase> | null = null;
function open() {
  if (connection) return connection;
  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    let done = false;
    const timeout = setTimeout(() => { done = true; reject(new Error('La copia local no respondió. Conservá esta pantalla y reintentá.')); }, 12000);
    const request = indexedDB.open('sitrep_support_recovery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('commands', { keyPath: 'id' });
    request.onerror = () => { clearTimeout(timeout); reject(request.error); };
    request.onsuccess = () => {
      clearTimeout(timeout);
      if (done) { request.result.close(); return; }
      const db = request.result;
      db.onversionchange = () => { db.close(); connection = null; };
      resolve(db);
    };
  });
  connection = pending;
  void pending.catch(() => { if (connection === pending) connection = null; });
  return pending;
}
export async function readSupportCommandRecord<T>(id: string): Promise<T | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('commands', 'readonly');
    const request = tx.objectStore('commands').get(id);
    let record: T | null = null;
    request.onsuccess = () => { record = request.result ?? null; };
    tx.oncomplete = () => resolve(record);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('No se pudo leer el envío guardado.'));
  });
}
/** Atomic across tabs; callers only resolve after commit, never after put(). */
export async function updateSupportCommandRecord<T>(id: string, change: (current: T | null) => T | null): Promise<T | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('commands', 'readwrite');
    const store = tx.objectStore('commands');
    const request = store.get(id);
    let result: T | null = null, failure: unknown;
    request.onsuccess = () => {
      try { result = change(request.result ?? null); if (result) store.put(result); else store.delete(id); }
      catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(failure || tx.error || new Error('No se confirmó la copia del envío.'));
  });
}
