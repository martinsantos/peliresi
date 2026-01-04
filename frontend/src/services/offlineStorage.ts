/**
 * Offline Storage Service using IndexedDB
 * Implements CU-S05: Sincronización Offline
 * 
 * Features:
 * - Cache manifiestos for offline access
 * - Queue operations when offline
 * - Sync pending operations when back online
 */

import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

// Types
interface Manifiesto {
  id: string;
  numero: string;
  estado: string;
  generadorId: string;
  transportistaId: string;
  operadorId: string;
  tipoResiduoId: string;
  cantidad: number;
  unidad: string;
  fechaCreacion: string;
  fechaActualizacion: string;
  [key: string]: unknown;
}

interface PendingOperation {
  id?: number;
  tipo: 'CREATE' | 'UPDATE' | 'DELETE' | 'SIGN' | 'STATUS_CHANGE';
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  datos: Record<string, unknown>;
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
const DB_NAME = 'sitrep-offline';
const DB_VERSION = 1;
const MAX_RETRIES = 3;

/**
 * Offline Storage Service
 */
class OfflineStorageService {
  private db: IDBPDatabase<OfflineDB> | null = null;
  private isOnline = navigator.onLine;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('📶 Conexión restaurada - iniciando sincronización...');
      this.syncPendingOperations();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📴 Sin conexión - operaciones serán encoladas');
    });
  }

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.db) return;

    try {
      this.db = await openDB<OfflineDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Manifiestos store
          if (!db.objectStoreNames.contains('manifiestos')) {
            const manifiestoStore = db.createObjectStore('manifiestos', { keyPath: 'id' });
            manifiestoStore.createIndex('by-estado', 'estado');
            manifiestoStore.createIndex('by-fecha', 'fechaCreacion');
          }

          // Pending operations store
          if (!db.objectStoreNames.contains('operacionesPendientes')) {
            const opStore = db.createObjectStore('operacionesPendientes', {
              keyPath: 'id',
              autoIncrement: true
            });
            opStore.createIndex('by-timestamp', 'timestamp');
          }

          // Sync metadata store
          if (!db.objectStoreNames.contains('syncMeta')) {
            db.createObjectStore('syncMeta', { keyPath: 'key' });
          }
        }
      });

      console.log('💾 IndexedDB inicializado:', DB_NAME);
    } catch (error) {
      console.error('Error inicializando IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Cache a manifiesto for offline access
   */
  async cacheManifiesto(manifiesto: Manifiesto): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('manifiestos', manifiesto);
    console.log('📥 Manifiesto cacheado:', manifiesto.numero);
  }

  /**
   * Cache multiple manifiestos
   */
  async cacheManifiestos(manifiestos: Manifiesto[]): Promise<void> {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction('manifiestos', 'readwrite');
    await Promise.all([
      ...manifiestos.map(m => tx.store.put(m)),
      tx.done
    ]);
    
    console.log(`📥 ${manifiestos.length} manifiestos cacheados`);
  }

  /**
   * Get all cached manifiestos
   */
  async getManifiestosLocales(): Promise<Manifiesto[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('manifiestos');
  }

  /**
   * Get manifiestos by estado
   */
  async getManifiestosByEstado(estado: string): Promise<Manifiesto[]> {
    if (!this.db) await this.init();
    return this.db!.getAllFromIndex('manifiestos', 'by-estado', estado);
  }

  /**
   * Get a specific manifiesto by ID
   */
  async getManifiesto(id: string): Promise<Manifiesto | undefined> {
    if (!this.db) await this.init();
    return this.db!.get('manifiestos', id);
  }

  /**
   * Queue an operation to be synced later
   */
  async queueOperation(operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retries'>): Promise<number> {
    if (!this.db) await this.init();

    const fullOperation: PendingOperation = {
      ...operation,
      timestamp: Date.now(),
      retries: 0
    };

    const id = await this.db!.add('operacionesPendientes', fullOperation);
    console.log('📤 Operación encolada:', operation.tipo, 'ID:', id);
    
    return id as number;
  }

  /**
   * Get all pending operations
   */
  async getPendingOperations(): Promise<PendingOperation[]> {
    if (!this.db) await this.init();
    return this.db!.getAllFromIndex('operacionesPendientes', 'by-timestamp');
  }

  /**
   * Get count of pending operations
   */
  async getPendingCount(): Promise<number> {
    if (!this.db) await this.init();
    return this.db!.count('operacionesPendientes');
  }

  /**
   * Sync all pending operations with the server
   */
  async syncPendingOperations(): Promise<SyncResult> {
    if (!this.isOnline) {
      console.log('📴 Sin conexión - sincronización pospuesta');
      return { success: false, synced: 0, failed: 0, errors: [] };
    }

    if (!this.db) await this.init();

    const operations = await this.getPendingOperations();
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: []
    };

    console.log(`🔄 Sincronizando ${operations.length} operaciones pendientes...`);

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
          // Remove successful operation
          await this.db!.delete('operacionesPendientes', op.id!);
          result.synced++;
          console.log('✅ Operación sincronizada:', op.tipo);
        } else if (response.status >= 400 && response.status < 500) {
          // Client error - don't retry
          await this.db!.delete('operacionesPendientes', op.id!);
          result.failed++;
          result.errors.push({ id: op.id!, error: `HTTP ${response.status}` });
        } else {
          // Server error - increment retries
          if (op.retries < MAX_RETRIES) {
            await this.db!.put('operacionesPendientes', {
              ...op,
              retries: op.retries + 1
            });
          } else {
            await this.db!.delete('operacionesPendientes', op.id!);
            result.failed++;
            result.errors.push({ id: op.id!, error: 'Max retries exceeded' });
          }
        }
      } catch (error) {
        // Network error - keep for retry
        if (op.retries < MAX_RETRIES) {
          await this.db!.put('operacionesPendientes', {
            ...op,
            retries: op.retries + 1
          });
        }
        result.errors.push({ id: op.id!, error: (error as Error).message });
      }
    }

    // Update sync metadata
    await this.db!.put('syncMeta', {
      key: 'lastSync',
      lastSync: Date.now(),
      version: DB_VERSION
    });

    console.log(`🔄 Sincronización completa: ${result.synced} exitosas, ${result.failed} fallidas`);
    result.success = result.failed === 0;
    
    return result;
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction(['manifiestos', 'operacionesPendientes'], 'readwrite');
    await Promise.all([
      tx.objectStore('manifiestos').clear(),
      tx.objectStore('operacionesPendientes').clear(),
      tx.done
    ]);
    
    console.log('🗑️ Cache limpiado');
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime(): Promise<number | null> {
    if (!this.db) await this.init();
    const meta = await this.db!.get('syncMeta', 'lastSync');
    return meta?.lastSync || null;
  }

  /**
   * Check if online
   */
  get online(): boolean {
    return this.isOnline;
  }
}

// Singleton instance
export const offlineStorage = new OfflineStorageService();

// Export class for testing
export { OfflineStorageService };
export type { Manifiesto, PendingOperation, SyncResult };
