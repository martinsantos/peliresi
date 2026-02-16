/**
 * SITREP v6 - IndexedDB Offline Storage
 * ======================================
 * Servicio standalone para almacenamiento offline usando IndexedDB nativo.
 * Stores: manifiestos, catalogos, sync_queue
 */

const DB_NAME = 'sitrep_offline_db';
const DB_VERSION = 1;
const STORES = ['manifiestos', 'catalogos', 'sync_queue'] as const;

export type StoreName = (typeof STORES)[number];

export interface SyncAction {
  id?: number;
  type: string;
  endpoint: string;
  data: unknown;
  createdAt: string;
  userId?: string | number;
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

    request.onupgradeneeded = () => {
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
export async function saveOffline(store: StoreName, data: any): Promise<void> {
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
export async function getOffline(store: StoreName, key: string): Promise<any> {
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
export async function getAllOffline(store: StoreName): Promise<any[]> {
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
  return getAllOffline('sync_queue');
}

/**
 * Limpia toda la cola de sincronización.
 */
export async function clearSyncQueue(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    tx.objectStore('sync_queue').clear();
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
    if (currentUserId && action.userId && action.userId !== currentUserId) {
      continue;
    }

    try {
      switch (action.type) {
        case 'POST':
          await api.post(action.endpoint, action.data);
          break;
        case 'PUT':
          await api.put(action.endpoint, action.data);
          break;
        case 'PATCH':
          await api.patch(action.endpoint, action.data);
          break;
        case 'DELETE':
          await api.delete(action.endpoint);
          break;
        default:
          // Unknown action type - skip
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
