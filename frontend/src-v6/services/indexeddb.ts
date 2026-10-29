/**
 * SITREP v6 - IndexedDB Offline Storage
 * ======================================
 * Servicio standalone para almacenamiento offline usando IndexedDB nativo.
 * Stores: manifiestos, catalogos, sync_queue, inspection_evidence_queue
 */

import {
  isSupportedSyncMethod,
  isSyncActionOwnedBy,
  isTransportQueueAction,
  queuedDeliveryManifestId,
  type SyncMethod,
} from './syncQueuePolicy';
import api from './api';
import { GpsPendingError, flushStoredGpsQueue, runExclusiveGpsTask, sendIdempotentGps } from './gpsQueue';
import { withGpsTransitionLock } from './gpsCoordination';
import { clearTripSnapshot } from './tripSnapshot';
import { notifyDeliveryConfirmed, notifyOfflineQueueChanged } from './offlineSyncEvents';

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
  contextOwner?: string;
  attempts?: number;
  lastError?: string;
  failureKind?: 'retryable' | 'terminal' | 'auth';
  lastFailureUncertain?: boolean;
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
  contextBlocked?: number;
  legacyBlocked?: number;
  cleanupError?: boolean;
}

export interface SyncExecutionContext { owner: string; role: string; companyScoped: boolean }

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

/** Read/modify/write in one transaction, including across browser tabs.
 * The updater is synchronous so the transaction cannot become inactive.
 */
export async function updateOffline<T>(store: StoreName, key: string, update: (current: T | null) => T | null): Promise<T | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const records = tx.objectStore(store);
    let result: T | null = null;
    let failure: unknown;
    const request = records.get(key);
    request.onsuccess = () => {
      try {
        result = update(request.result ?? null);
        if (result === null) records.delete(key); else records.put(result);
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(failure || tx.error || new Error('No se confirmó la copia del envío.'));
    tx.onabort = () => reject(failure || tx.error || new Error('No se confirmó la copia del envío.'));
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

/** Serialize lookup and insertion in one IndexedDB transaction across tabs.
 * A previous delivery is never replaced with a new reference or other data. */
export async function enqueueDeliveryOnce(action: Omit<SyncAction, 'id' | 'createdAt'>): Promise<{ action: SyncAction; legacy: boolean; reused: boolean }> {
  const manifestId = queuedDeliveryManifestId(action.endpoint);
  const reference = (action.data as { referencia?: unknown } | null)?.referencia;
  if (action.type !== 'POST' || !manifestId || !action.endpoint.endsWith('/confirmar-entrega-idempotente')
    || action.userId == null || !action.contextOwner || typeof reference !== 'string') {
    throw new Error('No se pudo identificar la entrega y su actividad.');
  }
  const db = await getDB();
  const result = await new Promise<{ action: SyncAction; legacy: boolean; reused: boolean }>((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite'), records = tx.objectStore('sync_queue');
    let value: { action: SyncAction; legacy: boolean; reused: boolean } | undefined, failure: Error | undefined;
    const all = records.getAll();
    all.onsuccess = () => {
      const entries = all.result as SyncAction[];
      const existing = entries.find(item => item.type === 'POST' && queuedDeliveryManifestId(item.endpoint) === manifestId);
      if (existing) {
        if (!isSyncActionOwnedBy(existing.userId, action.userId) || (existing.contextOwner && existing.contextOwner !== action.contextOwner) || existing.id == null) {
          failure = new Error('Este dispositivo conserva una entrega pendiente de otra cuenta o actividad. Volvé a ese contexto para revisarla.');
          tx.abort(); return;
        }
        value = { action: existing, legacy: !existing.contextOwner || !existing.endpoint.endsWith('/confirmar-entrega-idempotente'), reused: true };
        return;
      }
      if (entries.length >= MAX_SYNC_QUEUE_SIZE) {
        failure = new Error('La cola local está llena. Los cambios pendientes se conservaron; sincronizá antes de agregar otro.');
        tx.abort(); return;
      }
      const created: SyncAction = { ...action, createdAt: new Date().toISOString(), attempts: 0 };
      const write = records.add(created);
      write.onsuccess = () => {
        if (typeof write.result !== 'number') { failure = new Error('No se pudo identificar el envío guardado.'); tx.abort(); return; }
        value = { action: { ...created, id: write.result }, legacy: false, reused: false };
      };
    };
    tx.oncomplete = () => value ? resolve(value) : reject(new Error('No se confirmó el guardado local.'));
    tx.onerror = () => reject(failure || tx.error || new Error('No se confirmó el guardado local.'));
    tx.onabort = () => reject(failure || tx.error || new Error('No se confirmó el guardado local.'));
  });
  notifyOfflineQueueChanged();
  return result;
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
class SyncContextChangedError extends Error {}

export async function processSyncQueue(currentUserId: string | number, context: SyncExecutionContext, manual = false, isCurrent: () => boolean = () => true, onlyId?: number): Promise<SyncQueueResult> {
  const empty = (): SyncQueueResult => ({ processed: 0, pending: 0, retryable: 0, terminal: 0, auth: 0, skipped: 0 });
  const cannotSync = async (message: string): Promise<SyncQueueResult> => {
    if (!isCurrent()) return empty();
    const owned = (await getSyncQueue()).filter(action => isSyncActionOwnedBy(action.userId, currentUserId) && (onlyId === undefined || action.id === onlyId));
    if (!isCurrent()) return empty();
    const terminal = owned.filter(action => action.failureKind === 'terminal').length;
    const auth = owned.filter(action => action.failureKind === 'auth').length;
    return { ...empty(), pending: owned.length, retryable: owned.length - terminal - auth, terminal, auth, skipped: owned.length,
      ...(owned.length ? { lastError: message } : {}) };
  };
  const unavailable = () => cannotSync('Este navegador no puede coordinar la sincronización entre ventanas. Actualizalo o usá un navegador compatible.');
  const busy = () => cannotSync('Otra ventana está sincronizando esta cuenta. Esperá a que termine y reintentá.');
  if (!context?.owner || !context.role) return cannotSync('No se pudo identificar la actividad. Volvé a ingresar antes de sincronizar.');
  if (typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function') return unavailable();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let entered = false;
  try {
    // Acquire before reading the queue and retain the lock through each
    // acknowledged deletion or failure update. A waiting page reads fresh
    // actions instead of replaying another page's stale snapshot.
    return await navigator.locks.request<Promise<SyncQueueResult>>(`sitrep:offline-sync:${encodeURIComponent(String(currentUserId))}`,
      { mode: 'exclusive', signal: controller.signal }, async lock => {
        entered = true;
        clearTimeout(timer);
        if (!lock) return unavailable();
        if (!isCurrent()) return empty();
        return processSyncQueueLocked(currentUserId, context, manual, isCurrent, onlyId);
      });
  } catch (error) {
    if (entered) throw error;
    return controller.signal.aborted ? busy() : unavailable();
  } finally { clearTimeout(timer); }
}

async function processSyncQueueLocked(currentUserId: string | number, context: SyncExecutionContext, manual: boolean, isCurrent: () => boolean, onlyId?: number): Promise<SyncQueueResult> {
  const queue = await getSyncQueue();
  const owned = queue.filter((action) => isSyncActionOwnedBy(action.userId, currentUserId) && (onlyId === undefined || action.id === onlyId));
  const result: SyncQueueResult = { processed: 0, pending: owned.length, retryable: 0, terminal: 0, auth: 0, skipped: 0 };
  if (owned.length === 0) return result;

  for (const action of owned) {
    if (!isCurrent()) break;
    // Skip actions from other users (prevents cross-user data leakage)
    if (!isSyncActionOwnedBy(action.userId, currentUserId)) {
      continue;
    }

    if (action.contextOwner && action.contextOwner !== context.owner) {
      result.retryable += 1; result.skipped += 1;
      result.contextBlocked = (result.contextBlocked || 0) + 1;
      result.lastError = isTransportQueueAction(action)
        ? 'Volvé a Transporte y, si corresponde, a la empresa o establecimiento donde guardaste los cambios.'
        : 'Hay cambios guardados en otra actividad o establecimiento. Volvé a ese contexto para sincronizarlos.';
      continue;
    }
    if (!action.contextOwner) {
      if (isTransportQueueAction(action) && !context.companyScoped && ['TRANSPORTISTA', 'ADMIN'].includes(context.role)) {
        // Legacy personal transport actions have no stored context. The server
        // still validates the actor and manifest before applying them.
      } else {
        result.retryable += 1; result.skipped += 1;
        if (isTransportQueueAction(action) && !context.companyScoped) {
          result.contextBlocked = (result.contextBlocked || 0) + 1;
          result.lastError = 'Hay cambios anteriores de Transporte. Volvé a Transporte para sincronizarlos.';
        } else {
          result.legacyBlocked = (result.legacyBlocked || 0) + 1;
          result.lastError = 'Un cambio anterior no identifica su actividad o empresa. Se conservó: consultá a soporte antes de sincronizarlo.';
        }
        continue;
      }
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
      const legacyTransport = !action.contextOwner && isTransportQueueAction(action);
      if (legacyTransport) result.retryable += 1; else result.auth += 1;
      result.skipped += 1;
      result.lastError = legacyTransport
        ? 'El intento anterior no se pudo autorizar. Revisá tu sesión y usá Reintentar.'
        : action.lastError || result.lastError;
      continue;
    }
    if (!manual && action.nextRetryAt && Date.parse(action.nextRetryAt) > Date.now()) {
      result.retryable += 1;
      result.skipped += 1;
      result.lastError = action.lastError || result.lastError;
      continue;
    }

    let deliveryAttempted = false, checkingGps = false;
    try {
      switch (action.type) {
        case 'POST':
          {
            const deliveryId = queuedDeliveryManifestId(action.endpoint);
            if (deliveryId) {
              await runExclusiveGpsTask(deliveryId, () => withGpsTransitionLock(deliveryId, async () => {
                if (!isCurrent()) throw new SyncContextChangedError();
                checkingGps = true;
                await flushGpsBeforeQueuedDelivery(api, action.endpoint, currentUserId, isCurrent);
                checkingGps = false;
                if (!isCurrent()) throw new SyncContextChangedError();
                deliveryAttempted = true;
                const response = await api.post(action.endpoint, action.data);
                if (action.endpoint.endsWith('/confirmar-entrega-idempotente')) {
                  const answer = response?.data?.data;
                  const reference = (action.data as { referencia?: unknown } | null)?.referencia;
                  if (response?.data?.success !== true || typeof reference !== 'string' || answer?.idempotencia?.version !== 1
                    || String(answer.idempotencia.referencia).toLowerCase() !== reference.toLowerCase()
                    || typeof answer.idempotencia.repetido !== 'boolean' || answer?.manifiesto?.id !== deliveryId
                    || !['ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO', 'RECHAZADO', 'CANCELADO'].includes(answer?.manifiesto?.estado)
                    || !answer.manifiesto.fechaEntrega) {
                    throw new Error('No se recibió una confirmación verificable de la entrega. La copia se conservó.');
                  }
                }
                notifyDeliveryConfirmed(deliveryId, String(currentUserId));
              }));
            } else {
              if (!isCurrent()) throw new SyncContextChangedError();
              await api.post(action.endpoint, action.data);
            }
          }
          break;
        case 'PUT':
          if (!isCurrent()) throw new SyncContextChangedError();
          await api.put(action.endpoint, action.data);
          break;
        case 'PATCH':
          if (!isCurrent()) throw new SyncContextChangedError();
          await api.patch(action.endpoint, action.data);
          break;
        case 'DELETE':
          if (!isCurrent()) throw new SyncContextChangedError();
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
      notifyOfflineQueueChanged();
      try { cleanupAfterSuccessfulSync(action.endpoint, context.owner); }
      catch {
        // The server already confirmed this action and it was removed from the
        // queue. A cache failure must never put it back and replay the delivery.
        result.cleanupError = true;
        result.lastError = 'La entrega se confirmó, pero no se pudo actualizar la copia local. Consultá el manifiesto al reconectar.';
      }
      result.processed += 1;
      result.pending -= 1;
    } catch (error) {
      if (error instanceof SyncContextChangedError) break;
      const response = (error as { response?: { status?: number; data?: { message?: string } }; message?: string } | null)?.response;
      const classified = classifySyncFailure(error);
      const uncertain = deliveryAttempted && !response
        && (error as { isAxiosError?: boolean } | null)?.isAxiosError === true;
      const failureKind = classified.failureKind;
      const lastError = uncertain ? 'No recibimos confirmación de la entrega. Se conservó para comprobarla al reintentar.'
        : checkingGps && failureKind === 'retryable' && !(error instanceof GpsPendingError)
          ? 'Hay ubicaciones pendientes. Revisá la conexión y volvé a sincronizarlas antes de entregar.' : classified.lastError;
      const attempts = (action.attempts || 0) + 1;
      if (action.id != null) {
        await saveOffline('sync_queue', {
          ...action,
          attempts,
          failureKind,
          lastError,
          lastFailureUncertain: uncertain,
          nextRetryAt: failureKind === 'retryable' ? new Date(Date.now() + 30_000 * 2 ** Math.min(attempts, 6)).toISOString() : undefined,
        });
        notifyOfflineQueueChanged();
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

async function flushGpsBeforeQueuedDelivery(api: ApiClient, endpoint: string, owner: string | number, isCurrent: () => boolean): Promise<void> {
  const manifiestoId = queuedDeliveryManifestId(endpoint);
  if (!manifiestoId || typeof localStorage === 'undefined') return;
  await flushStoredGpsQueue(owner, manifiestoId, point => {
    if (!isCurrent()) throw new SyncContextChangedError();
    return sendIdempotentGps(api, manifiestoId, point);
  });
}

function cleanupAfterSuccessfulSync(endpoint: string, owner: string): void {
  const manifiestoId = queuedDeliveryManifestId(endpoint);
  if (!manifiestoId || typeof localStorage === 'undefined') return;
  clearTripSnapshot(owner, manifiestoId);
}
