import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Manifiesto } from '../types';

// Types
interface PendingOperation {
  id?: number;
  tipo: 'CREATE' | 'UPDATE' | 'DELETE' | 'SIGN' | 'STATUS_CHANGE';
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  datos: Record<string, any>;
  timestamp: number;
  retries: number;
}

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ id: number; error: string }>;
}

interface GPSPoint {
  id?: number;
  manifiestoId: string;
  latitud: number;
  longitud: number;
  velocidad?: number;
  precision?: number;
  timestamp: string;
  sincronizado: boolean;
}

// Database Schema
interface OfflineDB extends DBSchema {
  manifiestos: {
    key: string;
    value: Manifiesto;
    indexes: {
      'by-estado': string;
      'by-fecha': string;
    };
  };
  tiposResiduos: {
    key: string;
    value: any;
  };
  operadores: {
    key: string;
    value: any;
  };
  operacionesPendientes: {
    key: number;
    value: PendingOperation;
    indexes: {
      'by-timestamp': number;
    };
  };
  syncMeta: {
    key: string;
    value: {
      key: string;
      lastSync: number;
      version: number;
    };
  };
  gpsPoints: {
    key: number;
    value: GPSPoint;
    indexes: {
      'by-manifiesto': string;
      'by-sync': number;
    };
  };
}

// Constants
const DB_NAME = 'sitrep-db-v3';
const DB_VERSION = 3;

class OfflineStorageService {
  private db: IDBPDatabase<OfflineDB> | null = null;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.syncPendingOperations().catch(console.error);
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const mStore = db.createObjectStore('manifiestos', { keyPath: 'id' });
          mStore.createIndex('by-estado', 'estado');
          mStore.createIndex('by-fecha', 'fechaCreacion');

          const opStore = db.createObjectStore('operacionesPendientes', {
            keyPath: 'id',
            autoIncrement: true
          });
          opStore.createIndex('by-timestamp', 'timestamp');
          db.createObjectStore('syncMeta', { keyPath: 'key' });
        }
        
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('tiposResiduos')) {
            db.createObjectStore('tiposResiduos', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('operadores')) {
            db.createObjectStore('operadores', { keyPath: 'id' });
          }
        }

        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('gpsPoints')) {
            const gpsStore = db.createObjectStore('gpsPoints', {
              keyPath: 'id',
              autoIncrement: true
            });
            gpsStore.createIndex('by-manifiesto', 'manifiestoId');
            gpsStore.createIndex('by-sync', 'sincronizado');
          }
        }
      }
    });
  }

  // --- Manifiestos ---
  async saveManifiesto(manifiesto: Manifiesto): Promise<void> {
    await this.init();
    await this.db!.put('manifiestos', manifiesto);
  }

  async getAllManifiestos(): Promise<Manifiesto[]> {
    await this.init();
    return this.db!.getAll('manifiestos');
  }

  async getManifiesto(id: string): Promise<Manifiesto | undefined> {
    await this.init();
    return this.db!.get('manifiestos', id);
  }

  // --- Catálogos (NUEVO) ---
  async saveTiposResiduos(tipos: any[]): Promise<void> {
    await this.init();
    const tx = this.db!.transaction('tiposResiduos', 'readwrite');
    await tx.store.clear();
    await Promise.all([
      ...tipos.map(t => tx.store.put(t)),
      tx.done
    ]);
  }

  async getTiposResiduos(): Promise<any[]> {
    await this.init();
    return this.db!.getAll('tiposResiduos');
  }

  async saveOperadores(operadores: any[]): Promise<void> {
    await this.init();
    const tx = this.db!.transaction('operadores', 'readwrite');
    await tx.store.clear();
    await Promise.all([
      ...operadores.map(o => tx.store.put(o)),
      tx.done
    ]);
  }

  async getOperadores(): Promise<any[]> {
    await this.init();
    return this.db!.getAll('operadores');
  }

  // --- GPS Points (Offline-First Tracking) ---
  async saveGPSPoint(data: {
    manifiestoId: string;
    latitud: number;
    longitud: number;
    velocidad?: number;
    precision?: number;
  }): Promise<number> {
    await this.init();
    const point: GPSPoint = {
      ...data,
      timestamp: new Date().toISOString(),
      sincronizado: false
    };
    return (await this.db!.add('gpsPoints', point)) as number;
  }

  async getUnsyncedGPSPoints(): Promise<GPSPoint[]> {
    await this.init();
    // Get all points where sincronizado = false (using index value 0 for false)
    const allPoints = await this.db!.getAll('gpsPoints');
    return allPoints.filter(p => !p.sincronizado);
  }

  async getGPSPointsByManifiesto(manifiestoId: string): Promise<GPSPoint[]> {
    await this.init();
    return this.db!.getAllFromIndex('gpsPoints', 'by-manifiesto', manifiestoId);
  }

  async markGPSSynced(ids: number[]): Promise<void> {
    await this.init();
    const tx = this.db!.transaction('gpsPoints', 'readwrite');

    for (const id of ids) {
      const point = await tx.store.get(id);
      if (point) {
        point.sincronizado = true;
        await tx.store.put(point);
      }
    }

    await tx.done;
  }

  async deleteGPSPoints(ids: number[]): Promise<void> {
    await this.init();
    const tx = this.db!.transaction('gpsPoints', 'readwrite');
    for (const id of ids) {
      await tx.store.delete(id);
    }
    await tx.done;
  }

  async clearSyncedGPSPoints(): Promise<number> {
    await this.init();
    const allPoints = await this.db!.getAll('gpsPoints');
    const syncedPoints = allPoints.filter(p => p.sincronizado);

    const tx = this.db!.transaction('gpsPoints', 'readwrite');
    for (const point of syncedPoints) {
      if (point.id) {
        await tx.store.delete(point.id);
      }
    }
    await tx.done;

    return syncedPoints.length;
  }

  // --- Cola de Sync ---
  async queueOperation(operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retries'>): Promise<number> {
    await this.init();
    const fullOp: PendingOperation = { ...operation, timestamp: Date.now(), retries: 0 };
    return (await this.db!.add('operacionesPendientes', fullOp)) as number;
  }

  async syncPendingOperations(): Promise<SyncResult> {
    if (!this.isOnline) return { success: false, synced: 0, failed: 0, errors: [] };
    await this.init();

    const operations = await this.db!.getAllFromIndex('operacionesPendientes', 'by-timestamp');
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };
    const MAX_RETRIES = 5;

    for (const op of operations) {
      // Skip if we should wait (exponential backoff)
      if (op.retries > 0) {
        const backoffMs = Math.min(1000 * Math.pow(2, op.retries - 1), 30000); // 1s, 2s, 4s, 8s, 16s, max 30s
        const nextRetryAt = op.timestamp + backoffMs * op.retries;
        if (Date.now() < nextRetryAt) {
          console.log(`[OfflineSync] Skipping op ${op.id}, waiting for backoff (retry ${op.retries})`);
          continue;
        }
      }

      // Check max retries
      if (op.retries >= MAX_RETRIES) {
        console.warn(`[OfflineSync] Max retries reached for op ${op.id}, marking as failed`);
        result.failed++;
        result.errors.push({ id: op.id!, error: `Max retries (${MAX_RETRIES}) exceeded` });
        continue;
      }

      try {
        const response = await fetch(op.endpoint, {
          method: op.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
          },
          body: op.method !== 'DELETE' ? JSON.stringify(op.datos) : undefined
        });

        if (response.ok) {
          await this.db!.delete('operacionesPendientes', op.id!);
          result.synced++;
          console.log(`[OfflineSync] Synced operation ${op.id}`);
        } else if (response.status >= 500) {
          // Server error - retry with backoff
          op.retries++;
          await this.db!.put('operacionesPendientes', op);
          result.failed++;
          result.errors.push({ id: op.id!, error: `HTTP ${response.status} - will retry` });
          console.warn(`[OfflineSync] Server error for op ${op.id}, retry ${op.retries}`);
        } else {
          // Client error (4xx) - don't retry
          result.failed++;
          result.errors.push({ id: op.id!, error: `HTTP ${response.status}` });
          console.error(`[OfflineSync] Client error for op ${op.id}: ${response.status}`);
        }
      } catch (error) {
        // Network error - retry with backoff
        op.retries++;
        await this.db!.put('operacionesPendientes', op);
        result.errors.push({ id: op.id!, error: (error as Error).message });
        console.warn(`[OfflineSync] Network error for op ${op.id}, retry ${op.retries}`);
      }
    }

    await this.db!.put('syncMeta', { key: 'lastSync', lastSync: Date.now(), version: DB_VERSION });
    
    // Register background sync if supported
    if ('serviceWorker' in navigator && 'sync' in (window as any).SyncManager) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await (reg as any).sync.register('sitrep-sync');
      } catch (e) {
        console.warn('[OfflineSync] Background sync registration failed:', e);
      }
    }
    
    return result;
  }

  get online(): boolean { return this.isOnline; }

  // --- Utility methods for useConnectivity ---

  /**
   * Get all pending (unsynced) GPS points
   * Alias for getUnsyncedGPSPoints for consistent naming
   */
  async getPendingGPSPoints(): Promise<GPSPoint[]> {
    return this.getUnsyncedGPSPoints();
  }

  /**
   * Mark a single GPS point as synced
   */
  async markGPSPointSynced(id: number): Promise<void> {
    await this.init();
    const point = await this.db!.get('gpsPoints', id);
    if (point) {
      point.sincronizado = true;
      await this.db!.put('gpsPoints', point);
    }
  }

  /**
   * Check if there's any pending data to sync
   */
  async hasPendingData(): Promise<boolean> {
    await this.init();

    // Check for pending operations
    const pendingOps = await this.db!.count('operacionesPendientes');
    if (pendingOps > 0) return true;

    // Check for unsynced GPS points
    const allPoints = await this.db!.getAll('gpsPoints');
    const unsyncedPoints = allPoints.filter(p => !p.sincronizado);

    return unsyncedPoints.length > 0;
  }

  /**
   * Get count of pending items for UI display
   */
  async getPendingCounts(): Promise<{ operations: number; gpsPoints: number }> {
    await this.init();

    const operations = await this.db!.count('operacionesPendientes');
    const allPoints = await this.db!.getAll('gpsPoints');
    const gpsPoints = allPoints.filter(p => !p.sincronizado).length;

    return { operations, gpsPoints };
  }
}

export const offlineStorage = new OfflineStorageService();
export type { Manifiesto, PendingOperation, SyncResult, GPSPoint };
