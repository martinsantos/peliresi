/**
 * useConnectivity - FASE 4 REFACTORIZADO
 * Hook para gestión real de conectividad offline/online
 *
 * MEJORAS:
 * - Heartbeat check para verificar conectividad real (no solo navigator.onLine)
 * - Verificación periódica del estado de red
 * - Mejor manejo de reconexión
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineStorage } from '../services/offlineStorage';

const HEARTBEAT_URL = '/api/health';
const HEARTBEAT_INTERVAL_MS = 30000; // Check cada 30 segundos
const HEARTBEAT_TIMEOUT_MS = 5000;

interface ConnectivityState {
    isOnline: boolean;
    isReallyOnline: boolean; // Verificado con heartbeat
    wasOffline: boolean;
    lastOnlineAt: Date | null;
    syncPending: boolean;
    syncProgress: {
        total: number;
        completed: number;
        failed: number;
    };
    lastSyncResult: {
        success: boolean;
        message: string;
        timestamp: Date;
    } | null;
    lastHeartbeat: Date | null;
}

interface SyncResult {
    success: number;
    failed: number;
    total: number;
}

export const useConnectivity = () => {
    const [state, setState] = useState<ConnectivityState>({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        isReallyOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        wasOffline: false,
        lastOnlineAt: null,
        syncPending: false,
        syncProgress: { total: 0, completed: 0, failed: 0 },
        lastSyncResult: null,
        lastHeartbeat: null
    });

    const syncInProgressRef = useRef(false);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // REFACTOR v9.2: Refs estables para evitar recreación de efectos
    const syncAllPendingRef = useRef<(() => Promise<SyncResult>) | undefined>(undefined);
    const checkRealConnectivityRef = useRef<(() => Promise<boolean>) | undefined>(undefined);
    const wasOfflineRef = useRef(false);

    // FIX MEMORY LEAK: Flag para evitar registrar listeners duplicados
    const listenersRegisteredRef = useRef(false);

    /**
     * FASE 4: Heartbeat check para verificar conectividad real
     * navigator.onLine solo detecta si hay interfaz de red, no si hay internet
     */
    const checkRealConnectivity = useCallback(async (): Promise<boolean> => {
        if (!navigator.onLine) {
            setState(prev => ({ ...prev, isReallyOnline: false }));
            return false;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);

            const response = await fetch(HEARTBEAT_URL, {
                method: 'HEAD',
                cache: 'no-store',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const isReallyOnline = response.ok;
            setState(prev => ({
                ...prev,
                isReallyOnline,
                lastHeartbeat: new Date()
            }));

            return isReallyOnline;
        } catch (err) {
            // Si el fetch falla, aún podríamos tener conexión pero el backend está caído
            // Intentamos con un ping alternativo usando Image con cleanup adecuado
            try {
                const testImg = new Image();
                let timeoutId: ReturnType<typeof setTimeout> | null = null;

                const cleanup = () => {
                    testImg.onload = null;
                    testImg.onerror = null;
                    testImg.src = ''; // Cancela la request pendiente
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                };

                const imgPromise = new Promise<boolean>((resolve) => {
                    testImg.onload = () => { cleanup(); resolve(true); };
                    testImg.onerror = () => { cleanup(); resolve(false); };
                    timeoutId = setTimeout(() => { cleanup(); resolve(false); }, HEARTBEAT_TIMEOUT_MS);
                });

                testImg.src = `https://www.google.com/favicon.ico?t=${Date.now()}`;
                const result = await imgPromise;

                setState(prev => ({
                    ...prev,
                    isReallyOnline: result,
                    lastHeartbeat: new Date()
                }));

                return result;
            } catch {
                setState(prev => ({ ...prev, isReallyOnline: false }));
                return false;
            }
        }
    }, []);

    /**
     * Sync all pending operations (operations queue + GPS points)
     */
    const syncAllPending = useCallback(async (): Promise<SyncResult> => {
        if (syncInProgressRef.current || !navigator.onLine) {
            return { success: 0, failed: 0, total: 0 };
        }

        syncInProgressRef.current = true;
        setState(prev => ({ ...prev, syncPending: true }));

        let totalSuccess = 0;
        let totalFailed = 0;
        let totalItems = 0;

        try {
            // 1. Sync pending operations from queue
            console.log('[Sync] Starting pending operations sync...');
            const operationsResult = await offlineStorage.syncPendingOperations();
            totalSuccess += operationsResult.synced;
            totalFailed += operationsResult.failed;
            totalItems += operationsResult.synced + operationsResult.failed;

            console.log(`[Sync] Operations: ${operationsResult.synced} success, ${operationsResult.failed} failed`);

            // 2. Sync pending GPS points
            console.log('[Sync] Starting GPS points sync...');
            const gpsResult = await syncGPSPoints();
            totalSuccess += gpsResult.success;
            totalFailed += gpsResult.failed;
            totalItems += gpsResult.success + gpsResult.failed;

            console.log(`[Sync] GPS Points: ${gpsResult.success} success, ${gpsResult.failed} failed`);

            // Update state with results
            setState(prev => ({
                ...prev,
                syncPending: false,
                syncProgress: {
                    total: totalItems,
                    completed: totalSuccess,
                    failed: totalFailed
                },
                lastSyncResult: {
                    success: totalFailed === 0,
                    message: totalFailed === 0
                        ? `Sincronización completa: ${totalSuccess} items`
                        : `Parcial: ${totalSuccess} OK, ${totalFailed} fallidos`,
                    timestamp: new Date()
                }
            }));

            // If there were failures, schedule a retry
            if (totalFailed > 0) {
                scheduleRetry();
            }

            return { success: totalSuccess, failed: totalFailed, total: totalItems };

        } catch (err) {
            console.error('[Sync] Error during sync:', err);
            setState(prev => ({
                ...prev,
                syncPending: false,
                lastSyncResult: {
                    success: false,
                    message: 'Error de sincronización',
                    timestamp: new Date()
                }
            }));
            scheduleRetry();
            return { success: 0, failed: 1, total: 1 };
        } finally {
            syncInProgressRef.current = false;
        }
    }, []);

    /**
     * Sync GPS points stored in IndexedDB
     */
    const syncGPSPoints = async (): Promise<{ success: number; failed: number }> => {
        let success = 0;
        let failed = 0;

        try {
            const pendingPoints = await offlineStorage.getPendingGPSPoints();

            if (pendingPoints.length === 0) {
                return { success: 0, failed: 0 };
            }

            console.log(`[Sync] Found ${pendingPoints.length} pending GPS points`);

            // Group by manifiestoId for batch processing
            const groupedPoints: Record<string, typeof pendingPoints> = {};
            for (const point of pendingPoints) {
                if (!groupedPoints[point.manifiestoId]) {
                    groupedPoints[point.manifiestoId] = [];
                }
                groupedPoints[point.manifiestoId].push(point);
            }

            // Sync each group
            for (const [manifiestoId, points] of Object.entries(groupedPoints)) {
                try {
                    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/manifiestos/${manifiestoId}/ubicacion-batch`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                        },
                        body: JSON.stringify({
                            puntos: points.map(p => ({
                                latitud: p.latitud,
                                longitud: p.longitud,
                                timestamp: p.timestamp,
                                velocidad: p.velocidad,
                                precision: p.precision
                            }))
                        })
                    });

                    if (response.ok) {
                        // Mark points as synced
                        for (const point of points) {
                            if (point.id !== undefined) {
                                await offlineStorage.markGPSPointSynced(point.id);
                            }
                        }
                        success += points.length;
                        console.log(`[Sync] Synced ${points.length} GPS points for manifiesto ${manifiestoId}`);
                    } else {
                        failed += points.length;
                        console.warn(`[Sync] Failed to sync GPS for manifiesto ${manifiestoId}: ${response.status}`);
                    }
                } catch (err) {
                    failed += points.length;
                    console.error(`[Sync] Error syncing GPS for manifiesto ${manifiestoId}:`, err);
                }
            }
        } catch (err) {
            console.error('[Sync] Error accessing GPS points:', err);
        }

        return { success, failed };
    };

    /**
     * Schedule a retry for failed syncs
     */
    const scheduleRetry = useCallback(() => {
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
        }

        // Retry after 30 seconds
        retryTimeoutRef.current = setTimeout(() => {
            if (navigator.onLine) {
                console.log('[Sync] Retrying failed operations...');
                syncAllPending();
            }
        }, 30000);
    }, [syncAllPending]);

    /**
     * Manually trigger sync (for UI button)
     */
    const manualSync = useCallback(async () => {
        if (!navigator.onLine) {
            console.log('[Sync] Cannot sync - offline');
            return { success: 0, failed: 0, total: 0 };
        }
        return syncAllPending();
    }, [syncAllPending]);

    // REFACTOR v9.2: Actualizar refs cuando cambian los callbacks
    syncAllPendingRef.current = syncAllPending;
    checkRealConnectivityRef.current = checkRealConnectivity;
    wasOfflineRef.current = state.wasOffline;

    // Handle online/offline events - REFACTOR v9.2: Dependencias estables via refs
    // FIX MEMORY LEAK: Evitar registrar listeners duplicados
    useEffect(() => {
        if (listenersRegisteredRef.current) {
            return; // Listeners ya registrados, evitar duplicación
        }
        listenersRegisteredRef.current = true;

        const handleOnline = async () => {
            console.log('[Connectivity] navigator.onLine: true - verificando conexión real...');
            setState(prev => ({
                ...prev,
                isOnline: true,
                wasOffline: true
            }));

            // Verificar conexión real antes de sincronizar
            const isReallyOnline = await checkRealConnectivityRef.current?.();

            if (isReallyOnline) {
                console.log('[Connectivity] Conexión verificada - iniciando sync');
                setState(prev => ({ ...prev, lastOnlineAt: new Date() }));
                // Delay para asegurar estabilidad de red
                setTimeout(() => {
                    syncAllPendingRef.current?.();
                }, 1500);
            } else {
                console.log('[Connectivity] navigator.onLine true pero sin conexión real');
            }
        };

        const handleOffline = () => {
            console.log('[Connectivity] Gone offline');
            setState(prev => ({
                ...prev,
                isOnline: false,
                isReallyOnline: false,
                wasOffline: true
            }));

            // Clear any pending retries
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Heartbeat interval para detectar cambios de conexión - REFACTOR v9.2: Usa refs
        heartbeatIntervalRef.current = setInterval(() => {
            if (navigator.onLine) {
                checkRealConnectivityRef.current?.().then(isOnline => {
                    // Si recuperamos conexión real y teníamos datos pendientes, sincronizar
                    if (isOnline && wasOfflineRef.current) {
                        offlineStorage.hasPendingData().then(hasPending => {
                            if (hasPending && !syncInProgressRef.current) {
                                console.log('[Heartbeat] Conexión recuperada con datos pendientes - syncing');
                                syncAllPendingRef.current?.();
                            }
                        });
                    }
                });
            }
        }, HEARTBEAT_INTERVAL_MS);

        // Check initial state and sync if needed
        if (navigator.onLine) {
            setState(prev => ({ ...prev, isOnline: true }));
            // Verificar conexión real al iniciar
            checkRealConnectivityRef.current?.().then(isReallyOnline => {
                if (isReallyOnline) {
                    setState(prev => ({ ...prev, lastOnlineAt: new Date() }));
                    offlineStorage.hasPendingData().then(hasPending => {
                        if (hasPending) {
                            console.log('[Connectivity] Found pending data on load - syncing');
                            syncAllPendingRef.current?.();
                        }
                    });
                }
            });
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
            }
            // FIX MEMORY LEAK: Reset flag en cleanup para permitir re-registro si se remonta
            listenersRegisteredRef.current = false;
        };
    }, []); // REFACTOR v9.2: Array vacío - callbacks via refs

    return {
        ...state,
        manualSync,
        syncAllPending,
        checkRealConnectivity
    };
};
