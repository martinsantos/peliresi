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
}

// Constants
const DB_NAME = 'sitrep-db-v2';
const DB_VERSION = 2;

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

    for (const op of operations) {
      try {
        const response = await fetch(op.endpoint, {
          method: op.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: op.method !== 'DELETE' ? JSON.stringify(op.datos) : undefined
        });

        if (response.ok) {
          await this.db!.delete('operacionesPendientes', op.id!);
          result.synced++;
        } else {
          result.failed++;
          result.errors.push({ id: op.id!, error: `HTTP ${response.status}` });
        }
      } catch (error) {
        result.errors.push({ id: op.id!, error: (error as Error).message });
      }
    }

    await this.db!.put('syncMeta', { key: 'lastSync', lastSync: Date.now(), version: DB_VERSION });
    return result;
  }

  get online(): boolean { return this.isOnline; }
}

export const offlineStorage = new OfflineStorageService();
export type { Manifiesto, PendingOperation, SyncResult };
