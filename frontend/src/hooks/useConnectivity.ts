/**
 * useConnectivity - Hook for real offline/online sync management
 * Handles automatic sync when coming back online
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineStorage } from '../services/offlineStorage';

interface ConnectivityState {
    isOnline: boolean;
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
}

interface SyncResult {
    success: number;
    failed: number;
    total: number;
}

export const useConnectivity = () => {
    const [state, setState] = useState<ConnectivityState>({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        wasOffline: false,
        lastOnlineAt: null,
        syncPending: false,
        syncProgress: { total: 0, completed: 0, failed: 0 },
        lastSyncResult: null
    });

    const syncInProgressRef = useRef(false);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Handle online/offline events
    useEffect(() => {
        const handleOnline = () => {
            console.log('[Connectivity] Back online - starting sync');
            setState(prev => ({
                ...prev,
                isOnline: true,
                wasOffline: true,
                lastOnlineAt: new Date()
            }));

            // Start sync after a small delay to ensure network is stable
            setTimeout(() => {
                syncAllPending();
            }, 1000);
        };

        const handleOffline = () => {
            console.log('[Connectivity] Gone offline');
            setState(prev => ({
                ...prev,
                isOnline: false,
                wasOffline: true
            }));

            // Clear any pending retries
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check initial state and sync if needed
        if (navigator.onLine) {
            setState(prev => ({ ...prev, isOnline: true, lastOnlineAt: new Date() }));
            // Check if there's pending data on initial load
            offlineStorage.hasPendingData().then(hasPending => {
                if (hasPending) {
                    console.log('[Connectivity] Found pending data on load - syncing');
                    syncAllPending();
                }
            });
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, [syncAllPending]);

    return {
        ...state,
        manualSync,
        syncAllPending
    };
};
