/**
 * useOfflineStorage - Hook para almacenamiento offline con IndexedDB
 * 
 * Proporciona funcionalidades para:
 * - Almacenar manifiestos para uso offline
 * - Cola de acciones pendientes para sincronizar cuando hay conexión
 * - Detección automática de conexión
 */

import { useState, useEffect, useCallback } from 'react';

const DB_NAME = 'sitrep_offline_db';
const DB_VERSION = 1;
const STORES = {
    manifiestos: 'manifiestos',
    pendingActions: 'pendingActions',
    userData: 'userData'
};

interface PendingAction {
    id: string;
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    entity: string;
    data: any;
    timestamp: number;
}

interface OfflineStorage {
    isReady: boolean;
    saveManifiestos: (manifiestos: any[]) => Promise<void>;
    getManifiestos: () => Promise<any[]>;
    addPendingAction: (action: Omit<PendingAction, 'id' | 'timestamp'>) => Promise<void>;
    getPendingActions: () => Promise<PendingAction[]>;
    clearPendingActions: () => Promise<void>;
    saveUserData: (key: string, data: any) => Promise<void>;
    getUserData: (key: string) => Promise<any>;
}

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Store para manifiestos
            if (!db.objectStoreNames.contains(STORES.manifiestos)) {
                const manifestoStore = db.createObjectStore(STORES.manifiestos, { keyPath: 'id' });
                manifestoStore.createIndex('estado', 'estado', { unique: false });
                manifestoStore.createIndex('fechaCreacion', 'fechaCreacion', { unique: false });
            }

            // Store para acciones pendientes
            if (!db.objectStoreNames.contains(STORES.pendingActions)) {
                const actionsStore = db.createObjectStore(STORES.pendingActions, { keyPath: 'id' });
                actionsStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            // Store para datos de usuario
            if (!db.objectStoreNames.contains(STORES.userData)) {
                db.createObjectStore(STORES.userData, { keyPath: 'key' });
            }
        };
    });
};

export const useOfflineStorage = (): OfflineStorage => {
    const [isReady, setIsReady] = useState(false);
    const [db, setDb] = useState<IDBDatabase | null>(null);

    useEffect(() => {
        openDB()
            .then((database) => {
                setDb(database);
                setIsReady(true);
                console.log('📦 IndexedDB inicializado');
            })
            .catch((error) => {
                console.error('❌ Error inicializando IndexedDB:', error);
            });
    }, []);

    const saveManifiestos = useCallback(async (manifiestos: any[]) => {
        if (!db) return;

        const tx = db.transaction(STORES.manifiestos, 'readwrite');
        const store = tx.objectStore(STORES.manifiestos);

        for (const manifiesto of manifiestos) {
            store.put(manifiesto);
        }

        return new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => {
                console.log(`✅ ${manifiestos.length} manifiestos guardados offline`);
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }, [db]);

    const getManifiestos = useCallback(async (): Promise<any[]> => {
        if (!db) return [];

        const tx = db.transaction(STORES.manifiestos, 'readonly');
        const store = tx.objectStore(STORES.manifiestos);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }, [db]);

    const addPendingAction = useCallback(async (action: Omit<PendingAction, 'id' | 'timestamp'>) => {
        if (!db) return;

        const tx = db.transaction(STORES.pendingActions, 'readwrite');
        const store = tx.objectStore(STORES.pendingActions);

        const fullAction: PendingAction = {
            ...action,
            id: crypto.randomUUID(),
            timestamp: Date.now()
        };

        store.add(fullAction);

        return new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => {
                console.log('📝 Acción pendiente guardada:', action.type, action.entity);
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }, [db]);

    const getPendingActions = useCallback(async (): Promise<PendingAction[]> => {
        if (!db) return [];

        const tx = db.transaction(STORES.pendingActions, 'readonly');
        const store = tx.objectStore(STORES.pendingActions);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }, [db]);

    const clearPendingActions = useCallback(async () => {
        if (!db) return;

        const tx = db.transaction(STORES.pendingActions, 'readwrite');
        const store = tx.objectStore(STORES.pendingActions);
        store.clear();

        return new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => {
                console.log('🧹 Acciones pendientes limpiadas');
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }, [db]);

    const saveUserData = useCallback(async (key: string, data: any) => {
        if (!db) return;

        const tx = db.transaction(STORES.userData, 'readwrite');
        const store = tx.objectStore(STORES.userData);
        store.put({ key, data });

        return new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }, [db]);

    const getUserData = useCallback(async (key: string): Promise<any> => {
        if (!db) return null;

        const tx = db.transaction(STORES.userData, 'readonly');
        const store = tx.objectStore(STORES.userData);
        const request = store.get(key);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result?.data || null);
            request.onerror = () => reject(request.error);
        });
    }, [db]);

    return {
        isReady,
        saveManifiestos,
        getManifiestos,
        addPendingAction,
        getPendingActions,
        clearPendingActions,
        saveUserData,
        getUserData
    };
};

export default useOfflineStorage;
