import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Manifiesto } from '../types';

// Constants
const DB_NAME = 'sitrep-db-v3';
const DB_VERSION = 3;
const MAX_RETRIES = 5;
const BACKGROUND_SYNC_TAG = 'sitrep-sync';
const BACKOFF_BASE_MS = 1000; // 1 second base for exponential backoff

// Types
export type OperationStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface PendingOperation {
    id: string; // UUID
    tipo: 'CREATE' | 'UPDATE' | 'DELETE' | 'SIGN' | 'STATUS_CHANGE' | 'GPS_UPDATE' | 'CONFIRM_PICKUP' | 'CONFIRM_DELIVERY' | 'INCIDENT';
    endpoint: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    datos: Record<string, any>;
    timestamp: number;
    retries: number;
    status: OperationStatus;
    lastError?: string;
    nextRetryAt?: number;
    manifiestoId?: string; // For grouping related operations
}

export interface SyncResult {
    success: boolean;
    synced: number;
    failed: number;
    pending: number;
    errors: Array<{ id: string; error: string }>;
    nextRetryIn?: number;
}

interface SyncMeta {
    key: string;
    lastSync: number;
    version: number;
    lastSyncResult?: SyncResult;
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
    transportistas: {
        key: string;
        value: any;
    };
    operacionesPendientes: {
        key: string; // Changed from number to string (UUID)
        value: PendingOperation;
        indexes: {
            'by-timestamp': number;
            'by-status': OperationStatus;
            'by-manifiesto': string;
            'by-nextRetry': number;
        };
    };
    syncMeta: {
        key: string;
        value: SyncMeta;
    };
}

// Generate UUID
function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Calculate exponential backoff delay
function calculateBackoff(retries: number): number {
    // 1s, 2s, 4s, 8s, 16s
    return Math.min(BACKOFF_BASE_MS * Math.pow(2, retries), 30000);
}

class OfflineStorageService {
    private db: IDBPDatabase<OfflineDB> | null = null;
    private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    private syncInProgress = false;
    private syncTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                this.isOnline = true;
                this.triggerSync();
            });
            window.addEventListener('offline', () => {
                this.isOnline = false;
            });

            // Initialize on first load
            this.init().catch(console.error);
        }
    }

    async init(): Promise<void> {
        if (this.db) return;

        this.db = await openDB<OfflineDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
                // Drop and recreate for major version changes
                if (oldVersion < 3) {
                    // Clean up old stores if they exist
                    const storeNames = Array.from(db.objectStoreNames);

                    // Delete old operacionesPendientes if exists (schema changed)
                    if (storeNames.includes('operacionesPendientes')) {
                        db.deleteObjectStore('operacionesPendientes');
                    }

                    // Create new operacionesPendientes with UUID key
                    const opStore = db.createObjectStore('operacionesPendientes', {
                        keyPath: 'id'
                    });
                    opStore.createIndex('by-timestamp', 'timestamp');
                    opStore.createIndex('by-status', 'status');
                    opStore.createIndex('by-manifiesto', 'manifiestoId');
                    opStore.createIndex('by-nextRetry', 'nextRetryAt');

                    // Create other stores if they don't exist
                    if (!storeNames.includes('manifiestos')) {
                        const mStore = db.createObjectStore('manifiestos', { keyPath: 'id' });
                        mStore.createIndex('by-estado', 'estado');
                        mStore.createIndex('by-fecha', 'fechaCreacion');
                    }

                    if (!storeNames.includes('tiposResiduos')) {
                        db.createObjectStore('tiposResiduos', { keyPath: 'id' });
                    }

                    if (!storeNames.includes('operadores')) {
                        db.createObjectStore('operadores', { keyPath: 'id' });
                    }

                    if (!storeNames.includes('transportistas')) {
                        db.createObjectStore('transportistas', { keyPath: 'id' });
                    }

                    if (!storeNames.includes('syncMeta')) {
                        db.createObjectStore('syncMeta', { keyPath: 'key' });
                    }
                }
            }
        });

        // Register for Background Sync if available
        this.registerBackgroundSync();
    }

    // --- Background Sync API ---
    private async registerBackgroundSync(): Promise<void> {
        if (!('serviceWorker' in navigator) || !('sync' in ServiceWorkerRegistration.prototype)) {
            console.log('Background Sync not supported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            // Check if there are pending operations
            const pendingCount = await this.getPendingCount();
            if (pendingCount > 0) {
                await (registration as any).sync.register(BACKGROUND_SYNC_TAG);
                console.log('Background sync registered');
            }
        } catch (error) {
            console.warn('Failed to register background sync:', error);
        }
    }

    async triggerSync(): Promise<void> {
        // Try background sync first
        if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await (registration as any).sync.register(BACKGROUND_SYNC_TAG);
                return;
            } catch {
                // Fall through to manual sync
            }
        }

        // Manual sync fallback
        this.syncPendingOperations().catch(console.error);
    }

    // --- Manifiestos ---
    async saveManifiesto(manifiesto: Manifiesto): Promise<void> {
        await this.init();
        await this.db!.put('manifiestos', manifiesto);
    }

    async saveManifiestos(manifiestos: Manifiesto[]): Promise<void> {
        await this.init();
        const tx = this.db!.transaction('manifiestos', 'readwrite');
        await Promise.all([
            ...manifiestos.map(m => tx.store.put(m)),
            tx.done
        ]);
    }

    async getAllManifiestos(): Promise<Manifiesto[]> {
        await this.init();
        return this.db!.getAll('manifiestos');
    }

    async getManifiesto(id: string): Promise<Manifiesto | undefined> {
        await this.init();
        return this.db!.get('manifiestos', id);
    }

    async getManifiestosByEstado(estado: string): Promise<Manifiesto[]> {
        await this.init();
        return this.db!.getAllFromIndex('manifiestos', 'by-estado', estado);
    }

    async deleteManifiesto(id: string): Promise<void> {
        await this.init();
        await this.db!.delete('manifiestos', id);
    }

    // --- Catalogos ---
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

    async saveTransportistas(transportistas: any[]): Promise<void> {
        await this.init();
        const tx = this.db!.transaction('transportistas', 'readwrite');
        await tx.store.clear();
        await Promise.all([
            ...transportistas.map(t => tx.store.put(t)),
            tx.done
        ]);
    }

    async getTransportistas(): Promise<any[]> {
        await this.init();
        return this.db!.getAll('transportistas');
    }

    // --- Cola de Operaciones con UUID y Status ---
    async queueOperation(
        operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retries' | 'status'>
    ): Promise<string> {
        await this.init();

        const fullOp: PendingOperation = {
            ...operation,
            id: generateUUID(),
            timestamp: Date.now(),
            retries: 0,
            status: 'pending'
        };

        await this.db!.put('operacionesPendientes', fullOp);

        // Try to sync immediately if online
        if (this.isOnline) {
            this.triggerSync();
        } else {
            // Register for background sync when we come back online
            this.registerBackgroundSync();
        }

        return fullOp.id;
    }

    async getOperation(id: string): Promise<PendingOperation | undefined> {
        await this.init();
        return this.db!.get('operacionesPendientes', id);
    }

    async updateOperationStatus(
        id: string,
        status: OperationStatus,
        error?: string
    ): Promise<void> {
        await this.init();
        const op = await this.db!.get('operacionesPendientes', id);
        if (op) {
            op.status = status;
            if (error) op.lastError = error;
            if (status === 'failed' && op.retries < MAX_RETRIES) {
                op.nextRetryAt = Date.now() + calculateBackoff(op.retries);
            }
            await this.db!.put('operacionesPendientes', op);
        }
    }

    async getPendingOperations(): Promise<PendingOperation[]> {
        await this.init();
        const all = await this.db!.getAll('operacionesPendientes');
        return all.filter(op => op.status === 'pending' || op.status === 'failed');
    }

    async getPendingCount(): Promise<number> {
        await this.init();
        const pending = await this.db!.getAllFromIndex('operacionesPendientes', 'by-status', 'pending');
        const failed = await this.db!.getAllFromIndex('operacionesPendientes', 'by-status', 'failed');
        return pending.length + failed.length;
    }

    async getOperationsByManifiesto(manifiestoId: string): Promise<PendingOperation[]> {
        await this.init();
        return this.db!.getAllFromIndex('operacionesPendientes', 'by-manifiesto', manifiestoId);
    }

    async deleteOperation(id: string): Promise<void> {
        await this.init();
        await this.db!.delete('operacionesPendientes', id);
    }

    async clearSyncedOperations(): Promise<number> {
        await this.init();
        const synced = await this.db!.getAllFromIndex('operacionesPendientes', 'by-status', 'synced');
        for (const op of synced) {
            await this.db!.delete('operacionesPendientes', op.id);
        }
        return synced.length;
    }

    // --- Sync con Exponential Backoff ---
    async syncPendingOperations(): Promise<SyncResult> {
        if (!this.isOnline) {
            return { success: false, synced: 0, failed: 0, pending: 0, errors: [] };
        }

        if (this.syncInProgress) {
            console.log('Sync already in progress');
            return { success: false, synced: 0, failed: 0, pending: 0, errors: [] };
        }

        this.syncInProgress = true;
        await this.init();

        const result: SyncResult = { success: true, synced: 0, failed: 0, pending: 0, errors: [] };
        const now = Date.now();

        try {
            // Get operations ready for sync (pending or failed with retry time passed)
            const allOps = await this.db!.getAll('operacionesPendientes');
            const readyOps = allOps.filter(op =>
                op.status === 'pending' ||
                (op.status === 'failed' && op.retries < MAX_RETRIES && (!op.nextRetryAt || op.nextRetryAt <= now))
            );

            // Sort by timestamp to maintain order
            readyOps.sort((a, b) => a.timestamp - b.timestamp);

            for (const op of readyOps) {
                // Mark as syncing
                await this.updateOperationStatus(op.id, 'syncing');

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
                        // Mark as synced and remove
                        await this.db!.delete('operacionesPendientes', op.id);
                        result.synced++;
                    } else if (response.status >= 400 && response.status < 500) {
                        // Client error - don't retry
                        await this.updateOperationStatus(op.id, 'failed', `HTTP ${response.status}`);
                        op.retries = MAX_RETRIES; // Prevent further retries
                        await this.db!.put('operacionesPendientes', op);
                        result.failed++;
                        result.errors.push({ id: op.id, error: `HTTP ${response.status} - No retry` });
                    } else {
                        // Server error - retry with backoff
                        op.retries++;
                        const nextRetry = calculateBackoff(op.retries);
                        op.nextRetryAt = Date.now() + nextRetry;
                        op.status = 'failed';
                        op.lastError = `HTTP ${response.status}`;
                        await this.db!.put('operacionesPendientes', op);

                        if (op.retries >= MAX_RETRIES) {
                            result.failed++;
                            result.errors.push({ id: op.id, error: `Max retries exceeded` });
                        } else {
                            result.pending++;
                            if (!result.nextRetryIn || nextRetry < result.nextRetryIn) {
                                result.nextRetryIn = nextRetry;
                            }
                        }
                    }
                } catch (error) {
                    // Network error - retry with backoff
                    op.retries++;
                    const nextRetry = calculateBackoff(op.retries);
                    op.nextRetryAt = Date.now() + nextRetry;
                    op.status = 'failed';
                    op.lastError = (error as Error).message;
                    await this.db!.put('operacionesPendientes', op);

                    if (op.retries >= MAX_RETRIES) {
                        result.failed++;
                        result.errors.push({ id: op.id, error: `Network error - max retries` });
                    } else {
                        result.pending++;
                        if (!result.nextRetryIn || nextRetry < result.nextRetryIn) {
                            result.nextRetryIn = nextRetry;
                        }
                    }
                }
            }

            // Count remaining pending
            const remaining = await this.getPendingCount();
            result.pending = remaining;

            // Schedule next retry if needed
            if (result.nextRetryIn && result.pending > 0) {
                this.scheduleRetry(result.nextRetryIn);
            }

            // Save sync metadata
            await this.db!.put('syncMeta', {
                key: 'lastSync',
                lastSync: Date.now(),
                version: DB_VERSION,
                lastSyncResult: result
            });

        } finally {
            this.syncInProgress = false;
        }

        return result;
    }

    private scheduleRetry(delayMs: number): void {
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }

        this.syncTimeout = setTimeout(() => {
            if (this.isOnline) {
                this.syncPendingOperations().catch(console.error);
            }
        }, delayMs);
    }

    // --- Sync Metadata ---
    async getLastSyncTime(): Promise<number | null> {
        await this.init();
        const meta = await this.db!.get('syncMeta', 'lastSync');
        return meta?.lastSync || null;
    }

    async getLastSyncResult(): Promise<SyncResult | null> {
        await this.init();
        const meta = await this.db!.get('syncMeta', 'lastSync');
        return meta?.lastSyncResult || null;
    }

    // --- Status ---
    get online(): boolean {
        return this.isOnline;
    }

    get syncing(): boolean {
        return this.syncInProgress;
    }

    // --- Cleanup ---
    async clearAll(): Promise<void> {
        await this.init();
        const tx = this.db!.transaction(
            ['manifiestos', 'tiposResiduos', 'operadores', 'transportistas', 'operacionesPendientes', 'syncMeta'],
            'readwrite'
        );
        await Promise.all([
            tx.objectStore('manifiestos').clear(),
            tx.objectStore('tiposResiduos').clear(),
            tx.objectStore('operadores').clear(),
            tx.objectStore('transportistas').clear(),
            tx.objectStore('operacionesPendientes').clear(),
            tx.objectStore('syncMeta').clear(),
            tx.done
        ]);
    }

    // --- Export for debugging ---
    async exportData(): Promise<{
        manifiestos: Manifiesto[];
        pendingOperations: PendingOperation[];
        lastSync: number | null;
    }> {
        await this.init();
        return {
            manifiestos: await this.getAllManifiestos(),
            pendingOperations: await this.db!.getAll('operacionesPendientes'),
            lastSync: await this.getLastSyncTime()
        };
    }
}

// Singleton instance
export const offlineStorage = new OfflineStorageService();

// Export types
export type { Manifiesto, SyncMeta };

// Background Sync handler for Service Worker
// This will be called by the SW when 'sync' event fires
export async function handleBackgroundSync(): Promise<void> {
    const result = await offlineStorage.syncPendingOperations();
    console.log('Background sync completed:', result);

    if (result.failed > 0 || result.pending > 0) {
        // Re-register for another sync attempt
        throw new Error('Sync incomplete, will retry');
    }
}
