/**
 * SITREP v6 - IndexedDB Offline Storage
 * ======================================
 * Servicio standalone para almacenamiento offline usando IndexedDB nativo.
 * Stores: manifiestos, catalogos, sync_queue, inspection_evidence_queue
 */

import {
  isSupportedSyncMethod,
  isSyncActionOwnedBy,
  queuedDeliveryManifestId,
  type SyncMethod,
} from './syncQueuePolicy';
import api from './api';

const DB_NAME = 'sitrep_offline_db';
const DB_VERSION = 5;
const STORES = ['manifiestos', 'catalogos', 'sync_queue', 'inspection_evidence_queue', 'inspection_cases', 'inspection_exchange_drafts', 'inspection_spontaneous_drafts'] as const;

export type StoreName = (typeof STORES)[number];

export interface SyncAction {
  id?: number;
  type: SyncMethod;
  endpoint: string;
  data: unknown;
  createdAt: string;
  userId: string | number;
  attempts?: number;
  lastError?: string;
  failureKind?: 'retryable' | 'terminal' | 'auth';
  nextRetryAt?: string;
}

export interface SyncQueueResult {
  processed: number;
  pending: number;
  retryable: number;
  terminal: number;
  auth: number;
  skipped: number;
  lastError?: string;
}

export function classifySyncFailure(error: unknown): { failureKind: NonNullable<SyncAction['failureKind']>; lastError: string } {
  const response = (error as { response?: { status?: number; data?: { message?: string } }; message?: string } | null)?.response;
  const status = response?.status;
  const failureKind: NonNullable<SyncAction['failureKind']> = status === 401 || status === 403
    ? 'auth'
    : status !== undefined && status >= 400 && status < 500 && ![408, 425, 429].includes(status)
      ? 'terminal'
      : 'retryable';
  return {
    failureKind,
    lastError: response?.data?.message || (error instanceof Error ? error.message : 'No se pudo sincronizar este cambio.'),
  };
}

const MAX_SYNC_QUEUE_SIZE = 500;

// ========================================
// DB CONNECTION
// ========================================

let dbPromise: Promise<IDBDatabase> | null = null;
const DB_OPEN_TIMEOUT_MS = 12_000;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  let pending: Promise<IDBDatabase>;
  pending = new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    let blocked = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };
    const timeout = setTimeout(() => fail(new Error(blocked
      ? 'La copia local está esperando a que se cierre otra pestaña de SITREP.'
      : 'La copia local no respondió a tiempo.')), DB_OPEN_TIMEOUT_MS);
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DB_NAME, DB_VERSION); }
    catch (error) { fail(error instanceof Error ? error : new Error('No se pudo abrir la copia local.')); return; }

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

    request.onblocked = () => { blocked = true; };
    request.onsuccess = () => {
      const db = request.result;
      if (settled) { db.close(); return; }
      settled = true;
      clearTimeout(timeout);
      db.onversionchange = () => {
        db.close();
        if (dbPromise === pending) dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => fail(request.error || new Error('No se pudo abrir la copia local.'));
  });

  dbPromise = pending;
  void pending.catch(() => { if (dbPromise === pending) dbPromise = null; });
  return pending;
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
    tx.onabort = () => reject(tx.error || new Error('No se confirmó el guardado local.'));
  });
}

/**
 * Obtiene un registro por su clave primaria.
 */
export async function getOffline<T = unknown>(store: StoreName, key: string): Promise<T | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
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
    request.onsuccess = () => resolve(request.result as T[]);
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
    tx.onabort = () => reject(tx.error || new Error('No se confirmó la eliminación local.'));
  });
}

/** Commits a replacement and removal together; an abort preserves the original. */
export async function replaceOffline(store: StoreName, previousKey: string, replacement: unknown): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const records = tx.objectStore(store);
    records.put(replacement);
    records.delete(previousKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('No se confirmó el reemplazo local.'));
  });
}

// ========================================
// SYNC QUEUE
// ========================================

/**
 * Agrega una acción pendiente a la cola de sincronización.
 * Enforces MAX_SYNC_QUEUE_SIZE without deleting earlier unsent actions.
 */
export async function addToSyncQueue(action: Omit<SyncAction, 'id' | 'createdAt'>): Promise<void> {
  if (action.userId == null) throw new Error('Offline actions require an owning user');
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const records = tx.objectStore('sync_queue');
    let full = false;
    const count = records.count();
    count.onsuccess = () => {
      if (count.result >= MAX_SYNC_QUEUE_SIZE) {
        full = true;
        tx.abort();
        return;
      }
      records.add({ ...action, createdAt: new Date().toISOString(), attempts: action.attempts ?? 0 });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('No se confirmó el guardado local.'));
    tx.onabort = () => reject(full
      ? new Error('La cola local está llena. Los cambios pendientes se conservaron; sincronizá antes de agregar otro.')
      : tx.error || new Error('No se confirmó el guardado local.'));
  });
}

/**
 * Retorna todas las acciones pendientes en la cola.
 */
export async function getSyncQueue(): Promise<SyncAction[]> {
  return getAllOffline<SyncAction>('sync_queue');
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
export async function processSyncQueue(currentUserId: string | number, manual = false): Promise<SyncQueueResult> {
  const queue = await getSyncQueue();
  const owned = queue.filter((action) => isSyncActionOwnedBy(action.userId, currentUserId));
  const result: SyncQueueResult = { processed: 0, pending: owned.length, retryable: 0, terminal: 0, auth: 0, skipped: 0 };
  if (owned.length === 0) return result;

  for (const action of owned) {
    // Skip actions from other users (prevents cross-user data leakage)
    if (!isSyncActionOwnedBy(action.userId, currentUserId)) {
      continue;
    }

    if (!isSupportedSyncMethod(action.type)) {
      result.terminal += 1;
      result.skipped += 1;
      result.lastError = 'La acción guardada usa un método no compatible.';
      if (action.id != null) await saveOffline('sync_queue', { ...action, failureKind: 'terminal', lastError: result.lastError });
      continue;
    }
    if (!manual && action.failureKind === 'terminal') {
      result.terminal += 1;
      result.skipped += 1;
      result.lastError = action.lastError || result.lastError;
      continue;
    }
    if (!manual && action.failureKind === 'auth') {
      result.auth += 1;
      result.skipped += 1;
      result.lastError = action.lastError || result.lastError;
      continue;
    }
    if (!manual && action.nextRetryAt && Date.parse(action.nextRetryAt) > Date.now()) {
      result.retryable += 1;
      result.skipped += 1;
      result.lastError = action.lastError || result.lastError;
      continue;
    }

    try {
      switch (action.type) {
        case 'POST':
          await flushGpsBeforeQueuedDelivery(api, action.endpoint);
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
        default: {
          const exhaustive: never = action.type;
          void exhaustive;
          continue;
        }
      }

      // Eliminar la acción procesada individualmente
      if (action.id != null) {
        await removeOffline('sync_queue', action.id);
      }
      cleanupAfterSuccessfulSync(action.endpoint);
      result.processed += 1;
      result.pending -= 1;
    } catch (error) {
      const response = (error as { response?: { status?: number; data?: { message?: string } }; message?: string } | null)?.response;
      const { failureKind, lastError } = classifySyncFailure(error);
      const attempts = (action.attempts || 0) + 1;
      if (action.id != null) {
        await saveOffline('sync_queue', {
          ...action,
          attempts,
          failureKind,
          lastError,
          nextRetryAt: failureKind === 'retryable' ? new Date(Date.now() + 30_000 * 2 ** Math.min(attempts, 6)).toISOString() : undefined,
        });
      }
      result[failureKind] += 1;
      result.lastError = lastError;
      // A lost connection or expired authorization affects every following
      // request. Data/validation failures stay attached to their own action so
      // unrelated queued work can continue.
      if (failureKind === 'auth' || response === undefined || !navigator.onLine) break;
    }
  }

  return result;
}

type ApiClient = { post: (endpoint: string, data?: unknown) => Promise<unknown> };

async function flushGpsBeforeQueuedDelivery(api: ApiClient, endpoint: string): Promise<void> {
  const manifiestoId = queuedDeliveryManifestId(endpoint);
  if (!manifiestoId || typeof localStorage === 'undefined') return;

  const key = `gps_pending_${manifiestoId}`;
  const stored = localStorage.getItem(key);
  if (!stored) return;

  let points: Array<{ lat: number; lng: number; speed?: number; heading?: number }>;
  try {
    const parsed: unknown = JSON.parse(stored);
    points = Array.isArray(parsed)
      ? parsed.filter((point): point is { lat: number; lng: number; speed?: number; heading?: number } => {
          if (!point || typeof point !== 'object') return false;
          const candidate = point as { lat?: unknown; lng?: unknown };
          return Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng);
        })
      : [];
  } catch {
    points = [];
  }
  for (const point of points) {
    await api.post(`/manifiestos/${manifiestoId}/ubicacion`, {
      latitud: point.lat,
      longitud: point.lng,
      velocidad: point.speed,
      direccion: point.heading,
    });
  }
  localStorage.removeItem(key);
}

function cleanupAfterSuccessfulSync(endpoint: string): void {
  const manifiestoId = queuedDeliveryManifestId(endpoint);
  if (!manifiestoId || typeof localStorage === 'undefined') return;
  localStorage.removeItem(`viaje_snapshot_${manifiestoId}`);
  localStorage.removeItem(`viaje_status_${manifiestoId}`);
  localStorage.removeItem(`gps_pending_${manifiestoId}`);
  if (localStorage.getItem('sitrep_active_trip_id') === manifiestoId) {
    localStorage.removeItem('sitrep_active_trip_id');
  }
}
