// IndexedDB Manager para almacenamiento offline (CU-T09, CU-S05)

const DB_NAME = 'TrazabilidadRRPP';
const DB_VERSION = 1;

// Stores de IndexedDB
const STORES = {
    MANIFIESTOS: 'manifiestos',
    TIPOS_RESIDUOS: 'tiposResiduos',
    OPERADORES: 'operadores',
    SYNC_QUEUE: 'syncQueue'
};

class IndexedDBManager {
    private db: IDBDatabase | null = null;

    // Inicializar base de datos
    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB inicializada');
                resolve();
            };

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Store de manifiestos
                if (!db.objectStoreNames.contains(STORES.MANIFIESTOS)) {
                    const manifestoStore = db.createObjectStore(STORES.MANIFIESTOS, { keyPath: 'id' });
                    manifestoStore.createIndex('numero', 'numero', { unique: true });
                    manifestoStore.createIndex('estado', 'estado', { unique: false });
                    manifestoStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                }

                // Store de tipos de residuos (catálogo)
                if (!db.objectStoreNames.contains(STORES.TIPOS_RESIDUOS)) {
                    db.createObjectStore(STORES.TIPOS_RESIDUOS, { keyPath: 'id' });
                }

                // Store de operadores (catálogo)
                if (!db.objectStoreNames.contains(STORES.OPERADORES)) {
                    db.createObjectStore(STORES.OPERADORES, { keyPath: 'id' });
                }

                // Store de cola de sincronización
                if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
                    const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                    syncStore.createIndex('type', 'type', { unique: false });
                }

                console.log('✅ IndexedDB schema creado');
            };
        });
    }

    // Guardar manifiesto
    async saveManifiesto(manifiesto: any): Promise<void> {
        if (!this.db) throw new Error('DB no inicializada');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORES.MANIFIESTOS], 'readwrite');
            const store = transaction.objectStore(STORES.MANIFIESTOS);

            const manifestoWithSync = {
                ...manifiesto,
                syncStatus: 'pending',
                lastModified: new Date().toISOString()
            };

            const request = store.put(manifestoWithSync);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Obtener todos los manifiestos
    async getAllManifiestos(): Promise<any[]> {
        if (!this.db) throw new Error('DB no inicializada');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORES.MANIFIESTOS], 'readonly');
            const store = transaction.objectStore(STORES.MANIFIESTOS);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Obtener manifiesto por ID
    async getManifiesto(id: string): Promise<any | null> {
        if (!this.db) throw new Error('DB no inicializada');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORES.MANIFIESTOS], 'readonly');
            const store = transaction.objectStore(STORES.MANIFIESTOS);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    // Guardar catálogo de residuos (para uso offline)
    async saveTiposResiduos(tipos: any[]): Promise<void> {
        if (!this.db) throw new Error('DB no inicializada');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORES.TIPOS_RESIDUOS], 'readwrite');
            const store = transaction.objectStore(STORES.TIPOS_RESIDUOS);

            // Limpiar y recargar
            store.clear();
            tipos.forEach(tipo => store.put(tipo));

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // Obtener tipos de residuos
    async getTiposResiduos(): Promise<any[]> {
        if (!this.db) throw new Error('DB no inicializada');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORES.TIPOS_RESIDUOS], 'readonly');
            const store = transaction.objectStore(STORES.TIPOS_RESIDUOS);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Guardar operadores (para uso offline)
    async saveOperadores(operadores: any[]): Promise<void> {
        if (!this.db) throw new Error('DB no inicializada');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORES.OPERADORES], 'readwrite');
            const store = transaction.objectStore(STORES.OPERADORES);

            store.clear();
            operadores.forEach(op => store.put(op));

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // Agregar operación a la cola de sincronización
    async addToSyncQueue(operation: {
        type: 'CREATE' | 'UPDATE' | 'DELETE';
        entity: 'manifiesto' | 'evento';
        data: any;
    }): Promise<void> {
        if (!this.db) throw new Error('DB no inicializada');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORES.SYNC_QUEUE], 'readwrite');
            const store = transaction.objectStore(STORES.SYNC_QUEUE);

            const queueItem = {
                ...operation,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };

            const request = store.add(queueItem);
            request.onsuccess = () => {
                console.log('➕ Operación agregada a cola de sync:', operation.type);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Obtener operaciones pendientes de sincronización
    async getPendingSyncOperations(): Promise<any[]> {
        if (!this.db) throw new Error('DB no inicializada');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORES.SYNC_QUEUE], 'readonly');
            const store = transaction.objectStore(STORES.SYNC_QUEUE);
            const index = store.index('type');
            const request = store.getAll();

            request.onsuccess = () => {
                const pending = request.result.filter(op => op.status === 'pending');
                resolve(pending);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Marcar operación como sincronizada
    async markSyncComplete(id: number): Promise<void> {
        if (!this.db) throw new Error('DB no inicializada');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORES.SYNC_QUEUE], 'readwrite');
            const store = transaction.objectStore(STORES.SYNC_QUEUE);

            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Limpiar base de datos (para testing)
    async clearAll(): Promise<void> {
        if (!this.db) throw new Error('DB no inicializada');

        const stores = [STORES.MANIFIESTOS, STORES.TIPOS_RESIDUOS, STORES.OPERADORES, STORES.SYNC_QUEUE];

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(stores, 'readwrite');

            stores.forEach(storeName => {
                transaction.objectStore(storeName).clear();
            });

            transaction.oncomplete = () => {
                console.log('🗑️ IndexedDB limpiada');
                resolve();
            };
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

// Singleton
export const db = new IndexedDBManager();

// Auto-inicializar
if (typeof window !== 'undefined') {
    db.init().catch(console.error);
}
