/**
 * SITREP v6 - IndexedDB Offline Storage
 * ======================================
 * Servicio standalone para almacenamiento offline usando IndexedDB nativo.
 * Stores: manifiestos, catalogos, sync_queue, crypto_keys
 */

const DB_NAME = 'sitrep_offline_db';
const DB_VERSION = 3;
const STORES = ['manifiestos', 'catalogos', 'sync_queue', 'crypto_keys'] as const;

// Catalogs can contain actor and vehicle information. Their persisted cache
// must never be shared across accounts that use the same browser profile.
export const OFFLINE_CATALOG_KEYS = [
  'tipos-residuo',
  'generadores',
  'transportistas',
  'operadores',
  'vehiculos',
  'choferes',
] as const;

export const getOfflineCatalogKey = (userId: string | number, key: typeof OFFLINE_CATALOG_KEYS[number]) =>
  `user_${String(userId)}_${key}`;

export type StoreName = (typeof STORES)[number];

export interface SyncAction {
  id?: number;
  type: string;
  endpoint: string;
  data: unknown;
  createdAt: string;
  userId?: string | number;
}

export interface EncryptedMultipartPayload {
  __kind: 'encrypted-multipart-v1';
  fields: Record<string, string>;
  keyId: string;
  file: {
    ciphertext: ArrayBuffer;
    iv: ArrayBuffer;
    name: string;
    type: string;
    lastModified: number;
  };
}

const MAX_SYNC_QUEUE_SIZE = 500;

// ========================================
// DB CONNECTION
// ========================================

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          if (store === 'sync_queue') {
            db.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
          } else {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        }
      }

      // Version 3 removes plaintext catalog rows from releases that used
      // origin-wide IDs. New code only reads user-scoped keys.
      if (event.oldVersion < 3 && db.objectStoreNames.contains('catalogos')) {
        const catalogos = request.transaction?.objectStore('catalogos');
        OFFLINE_CATALOG_KEYS.forEach((key) => catalogos?.delete(key));
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

// ========================================
// CRUD OPERATIONS
// ========================================

/**
 * Guarda un registro en el store indicado.
 * El objeto debe tener un campo `id` (excepto sync_queue que usa autoIncrement).
 */
export async function saveOffline(store: StoreName, data: unknown): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Obtiene un registro por su clave primaria.
 */
export async function getOffline<T = unknown>(store: StoreName, key: string | number): Promise<T | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene todos los registros de un store.
 */
export async function getAllOffline<T = unknown>(store: StoreName): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Elimina un registro por su clave primaria.
 */
export async function removeOffline(store: StoreName, key: string | number): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key as IDBValidKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ========================================
// SYNC QUEUE
// ========================================

/**
 * Agrega una acción pendiente a la cola de sincronización.
 * Enforces MAX_SYNC_QUEUE_SIZE to prevent unbounded growth.
 */
export async function addToSyncQueue(action: Omit<SyncAction, 'id' | 'createdAt'>): Promise<void> {
  // Check queue size before adding
  const queue = await getSyncQueue();
  if (queue.length >= MAX_SYNC_QUEUE_SIZE) {
    // Drop oldest items to make room
    const toRemove = queue.slice(0, queue.length - MAX_SYNC_QUEUE_SIZE + 1);
    for (const item of toRemove) {
      if (item.id != null) await removeOffline('sync_queue', item.id);
    }
  }
  await saveOffline('sync_queue', {
    ...action,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Retorna todas las acciones pendientes en la cola.
 */
export async function getSyncQueue(): Promise<SyncAction[]> {
  return getAllOffline<SyncAction>('sync_queue');
}

export async function getPendingSyncCount(
  userId?: string | number,
  endpointPrefix?: string,
): Promise<number> {
  const queue = await getSyncQueue();
  return queue.filter((action) => {
    if (userId != null && String(action.userId) !== String(userId)) return false;
    return !endpointPrefix || action.endpoint.startsWith(endpointPrefix);
  }).length;
}

function isEncryptedMultipartPayload(value: unknown): value is EncryptedMultipartPayload {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as EncryptedMultipartPayload).__kind === 'encrypted-multipart-v1',
  );
}

async function getOrCreateQueueKey(userId: string | number): Promise<{ id: string; key: CryptoKey }> {
  const id = `sync_queue_user_${String(userId)}`;
  const existing = await getOffline<{ id: string; key: CryptoKey }>('crypto_keys', id);
  if (existing?.key) return existing;

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const record = { id, key };
  await saveOffline('crypto_keys', record);
  return record;
}

/** Encrypt a pending document before putting it in IndexedDB. */
export async function createEncryptedMultipartPayload(
  fields: Record<string, string>,
  file: File,
  userId: string | number,
): Promise<EncryptedMultipartPayload> {
  if (!crypto?.subtle) throw new Error('El dispositivo no permite cifrar documentos sin conexión');
  const { id: keyId, key } = await getOrCreateQueueKey(userId);
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    await file.arrayBuffer(),
  );
  return {
    __kind: 'encrypted-multipart-v1',
    fields,
    keyId,
    file: {
      ciphertext,
      iv: ivBytes.buffer.slice(ivBytes.byteOffset, ivBytes.byteOffset + ivBytes.byteLength) as ArrayBuffer,
      name: file.name,
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified,
    },
  };
}

async function materializeQueueData(data: unknown): Promise<unknown> {
  if (!isEncryptedMultipartPayload(data)) return data;
  const record = await getOffline<{ key?: CryptoKey }>('crypto_keys', data.keyId);
  if (!record?.key) throw new Error('No se encontró la clave local de la carga pendiente');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(data.file.iv) },
    record.key,
    data.file.ciphertext,
  );
  const form = new FormData();
  Object.entries(data.fields).forEach(([key, value]) => form.append(key, value));
  form.append(
    'file',
    new Blob([plaintext], { type: data.file.type }),
    data.file.name,
  );
  return form;
}

/**
 * Limpia toda la cola de sincronización.
 */
export async function clearSyncQueue(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sync_queue', 'crypto_keys'], 'readwrite');
    tx.objectStore('sync_queue').clear();
    tx.objectStore('crypto_keys').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ========================================
// AUTO-SYNC
// ========================================

/**
 * Procesa la cola de sincronización replayando las llamadas API.
 * If currentUserId is provided, skips actions from other users.
 * Retorna la cantidad de acciones procesadas con éxito.
 */
export async function processSyncQueue(currentUserId?: string | number): Promise<number> {
  const queue = await getSyncQueue();
  if (queue.length === 0) return 0;

  // Importar api de forma dinámica para evitar dependencias circulares
  const { default: api } = await import('./api');
  let processed = 0;

  for (const action of queue) {
    // Skip actions from other users (prevents cross-user data leakage)
    if (currentUserId != null && (
      action.userId == null || String(action.userId) !== String(currentUserId)
    )) {
      continue;
    }

    try {
      const data = await materializeQueueData(action.data);
      switch (action.type) {
        case 'POST':
          await api.post(action.endpoint, data);
          break;
        case 'PUT':
          await api.put(action.endpoint, data);
          break;
        case 'PATCH':
          await api.patch(action.endpoint, data);
          break;
        case 'DELETE':
          await api.delete(action.endpoint);
          break;
        default:
          // Unknown actions stay queued instead of being reported as sent.
          continue;
      }

      // Eliminar la acción procesada individualmente
      if (action.id != null) {
        await removeOffline('sync_queue', action.id);
      }
      processed++;
    } catch {
      // Detenerse en el primer error para mantener el orden
      break;
    }
  }

  return processed;
}
