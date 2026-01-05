/**
 * tripPersistence.ts - Trip State Persistence Service
 * Provides robust persistence for active trips across page reloads
 * and app restarts. Works in conjunction with useTripTracking hook.
 *
 * Features:
 * - IndexedDB storage for large trip data
 * - localStorage fallback for quick access
 * - Auto-recovery of active trips
 * - Trip draft saving for interrupted sessions
 */

import type { RoutePoint, TripEvent } from '../types/mobile.types';

// Storage keys
const ACTIVE_TRIP_KEY = 'sitrep_active_trip';
const TRIP_DRAFTS_KEY = 'sitrep_trip_drafts';
const DB_NAME = 'sitrep_trips_db';
const DB_VERSION = 1;
const STORE_NAME = 'active_trips';

export interface PersistedTrip {
    id: string;
    manifiestoId?: string;
    role?: string;
    isActive: boolean;
    isPaused: boolean;
    startTime: string;
    elapsedSeconds: number;
    events: TripEvent[];
    route: RoutePoint[];
    lastUpdate: string;
    deviceId?: string;
}

export interface TripDraft {
    id: string;
    manifiestoId?: string;
    savedAt: string;
    reason: 'page_unload' | 'app_background' | 'manual' | 'error_recovery';
    tripData: PersistedTrip;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize IndexedDB for trip persistence
 */
async function initDB(): Promise<IDBDatabase> {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('manifiestoId', 'manifiestoId', { unique: false });
                store.createIndex('isActive', 'isActive', { unique: false });
                store.createIndex('lastUpdate', 'lastUpdate', { unique: false });
            }
        };
    });
}

/**
 * Save trip to IndexedDB
 */
async function saveTripToIDB(trip: PersistedTrip): Promise<void> {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        await new Promise<void>((resolve, reject) => {
            const request = store.put(trip);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn('Failed to save trip to IndexedDB:', error);
        // Fallback to localStorage
        saveToLocalStorage(trip);
    }
}

/**
 * Get active trip from IndexedDB
 */
async function getActiveTripFromIDB(): Promise<PersistedTrip | null> {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('isActive');

        return new Promise((resolve, reject) => {
            const request = index.get(IDBKeyRange.only(true));
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn('Failed to get trip from IndexedDB:', error);
        return getFromLocalStorage();
    }
}

/**
 * Delete trip from IndexedDB
 */
async function deleteTripFromIDB(tripId: string): Promise<void> {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        await new Promise<void>((resolve, reject) => {
            const request = store.delete(tripId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn('Failed to delete trip from IndexedDB:', error);
    }
}

/**
 * Fallback: Save to localStorage
 */
function saveToLocalStorage(trip: PersistedTrip): void {
    try {
        localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(trip));
    } catch (error) {
        console.error('Failed to save trip to localStorage:', error);
    }
}

/**
 * Fallback: Get from localStorage
 */
function getFromLocalStorage(): PersistedTrip | null {
    try {
        const data = localStorage.getItem(ACTIVE_TRIP_KEY);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

/**
 * Clear localStorage trip
 */
function clearLocalStorage(): void {
    localStorage.removeItem(ACTIVE_TRIP_KEY);
}

// ============ Public API ============

/**
 * Save the current active trip state
 */
export async function saveActiveTrip(trip: PersistedTrip): Promise<void> {
    trip.lastUpdate = new Date().toISOString();

    // Save to both IDB and localStorage for redundancy
    await saveTripToIDB(trip);
    saveToLocalStorage(trip);
}

/**
 * Retrieve any active trip (for recovery on app start)
 */
export async function getActiveTrip(): Promise<PersistedTrip | null> {
    // Try IDB first, then localStorage
    const idbTrip = await getActiveTripFromIDB();
    if (idbTrip) return idbTrip;

    return getFromLocalStorage();
}

/**
 * Clear the active trip (when trip is finalized)
 */
export async function clearActiveTrip(tripId: string): Promise<void> {
    await deleteTripFromIDB(tripId);
    clearLocalStorage();
}

/**
 * Check if there's an active trip without loading full data
 */
export function hasActiveTrip(): boolean {
    return localStorage.getItem(ACTIVE_TRIP_KEY) !== null;
}

/**
 * Save a trip draft (for interrupted sessions)
 */
export function saveTripDraft(trip: PersistedTrip, reason: TripDraft['reason']): void {
    try {
        const draft: TripDraft = {
            id: `draft_${Date.now()}`,
            manifiestoId: trip.manifiestoId,
            savedAt: new Date().toISOString(),
            reason,
            tripData: trip
        };

        const drafts = getTripDrafts();
        drafts.push(draft);

        // Keep only last 5 drafts
        const recentDrafts = drafts.slice(-5);
        localStorage.setItem(TRIP_DRAFTS_KEY, JSON.stringify(recentDrafts));
    } catch (error) {
        console.error('Failed to save trip draft:', error);
    }
}

/**
 * Get all saved trip drafts
 */
export function getTripDrafts(): TripDraft[] {
    try {
        const data = localStorage.getItem(TRIP_DRAFTS_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

/**
 * Clear all trip drafts
 */
export function clearTripDrafts(): void {
    localStorage.removeItem(TRIP_DRAFTS_KEY);
}

/**
 * Calculate elapsed time for a persisted trip
 */
export function calculateElapsedTime(trip: PersistedTrip): number {
    if (trip.isPaused) {
        return trip.elapsedSeconds;
    }

    const startTime = new Date(trip.startTime).getTime();
    const now = Date.now();
    return Math.floor((now - startTime) / 1000);
}

/**
 * Generate a unique device ID for this browser/device
 */
export function getDeviceId(): string {
    const key = 'sitrep_device_id';
    let deviceId = localStorage.getItem(key);

    if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(key, deviceId);
    }

    return deviceId;
}

/**
 * Set up beforeunload handler to save trip on page close
 */
export function setupUnloadHandler(getTripState: () => PersistedTrip | null): () => void {
    const handler = () => {
        const trip = getTripState();
        if (trip && trip.isActive) {
            saveTripDraft(trip, 'page_unload');
            // Synchronous localStorage save for reliability
            saveToLocalStorage(trip);
        }
    };

    window.addEventListener('beforeunload', handler);

    // Return cleanup function
    return () => window.removeEventListener('beforeunload', handler);
}

/**
 * Set up visibility change handler for background/foreground transitions
 */
export function setupVisibilityHandler(
    onHidden: () => void,
    onVisible: () => void
): () => void {
    const handler = () => {
        if (document.hidden) {
            onHidden();
        } else {
            onVisible();
        }
    };

    document.addEventListener('visibilitychange', handler);

    return () => document.removeEventListener('visibilitychange', handler);
}

/**
 * Export trip data for backup/debugging
 */
export async function exportTripData(): Promise<{
    activeTrip: PersistedTrip | null;
    drafts: TripDraft[];
    deviceId: string;
}> {
    return {
        activeTrip: await getActiveTrip(),
        drafts: getTripDrafts(),
        deviceId: getDeviceId()
    };
}

// Export service object for convenience
export const tripPersistenceService = {
    saveActiveTrip,
    getActiveTrip,
    clearActiveTrip,
    hasActiveTrip,
    saveTripDraft,
    getTripDrafts,
    clearTripDrafts,
    calculateElapsedTime,
    getDeviceId,
    setupUnloadHandler,
    setupVisibilityHandler,
    exportTripData
};

export default tripPersistenceService;
