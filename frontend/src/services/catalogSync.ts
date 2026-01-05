/**
 * catalogSync.ts - Catalog Synchronization Service
 * Handles offline-first synchronization of reference data catalogs
 *
 * Features:
 * - Download tipos de residuos on app start
 * - Cache transportistas/operadores assigned to user
 * - ETag/Last-Modified versioning for incremental updates
 * - Automatic refresh on network reconnect
 */

import { offlineStorage } from './offlineStorage';

// Constants
const CATALOG_VERSION_KEY = 'sitrep_catalog_versions';
const CATALOG_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface CatalogVersion {
    catalog: string;
    etag?: string;
    lastModified?: string;
    lastFetch: number;
    count: number;
}

interface CatalogVersions {
    tiposResiduos?: CatalogVersion;
    operadores?: CatalogVersion;
    transportistas?: CatalogVersion;
    generadores?: CatalogVersion;
}

interface TipoResiduo {
    id: string;
    codigo: string;
    nombre: string;
    categoria: string;
    descripcion?: string;
    activo: boolean;
}

interface Actor {
    id: string;
    razonSocial: string;
    cuit: string;
    domicilio?: string;
    telefono?: string;
    email?: string;
}

interface SyncStatus {
    catalog: string;
    status: 'idle' | 'syncing' | 'success' | 'error';
    lastSync?: number;
    error?: string;
    count?: number;
}

class CatalogSyncService {
    private versions: CatalogVersions = {};
    private syncStatuses: Map<string, SyncStatus> = new Map();
    private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    private isInitialized = false;

    constructor() {
        this.loadVersions();
    }

    private loadVersions(): void {
        try {
            const stored = localStorage.getItem(CATALOG_VERSION_KEY);
            if (stored) {
                this.versions = JSON.parse(stored);
            }
        } catch {
            this.versions = {};
        }
    }

    private saveVersions(): void {
        try {
            localStorage.setItem(CATALOG_VERSION_KEY, JSON.stringify(this.versions));
        } catch {
            // Storage full, ignore
        }
    }

    private getAuthHeaders(): HeadersInit {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };
    }

    private updateSyncStatus(catalog: string, status: Partial<SyncStatus>): void {
        const current = this.syncStatuses.get(catalog) || { catalog, status: 'idle' };
        this.syncStatuses.set(catalog, { ...current, ...status });
    }

    /**
     * Initialize catalogs - call on app startup
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        // Load cached data first (instant)
        await offlineStorage.init();

        // Then fetch updates in background if online
        if (navigator.onLine) {
            this.refreshAllCatalogs().catch(console.error);
        }

        // Set up periodic refresh
        this.scheduleRefresh();

        // Listen for online events
        window.addEventListener('online', () => {
            this.refreshAllCatalogs().catch(console.error);
        });

        this.isInitialized = true;
    }

    private scheduleRefresh(): void {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }

        this.refreshTimeout = setTimeout(() => {
            if (navigator.onLine) {
                this.refreshAllCatalogs().catch(console.error);
            }
            this.scheduleRefresh();
        }, CATALOG_REFRESH_INTERVAL_MS);
    }

    /**
     * Refresh all catalogs
     */
    async refreshAllCatalogs(): Promise<void> {
        await Promise.allSettled([
            this.syncTiposResiduos(),
            this.syncOperadores(),
            this.syncTransportistas()
        ]);
    }

    /**
     * Sync tipos de residuos catalog
     */
    async syncTiposResiduos(): Promise<TipoResiduo[]> {
        this.updateSyncStatus('tiposResiduos', { status: 'syncing' });

        try {
            const headers: HeadersInit = this.getAuthHeaders();
            const version = this.versions.tiposResiduos;

            // Add conditional headers if we have a cached version
            if (version?.etag) {
                (headers as Record<string, string>)['If-None-Match'] = version.etag;
            }
            if (version?.lastModified) {
                (headers as Record<string, string>)['If-Modified-Since'] = version.lastModified;
            }

            const response = await fetch(`${API_BASE_URL}/api/catalogo/tipos-residuos`, {
                headers
            });

            if (response.status === 304) {
                // Not modified, use cached data
                this.updateSyncStatus('tiposResiduos', {
                    status: 'success',
                    lastSync: Date.now(),
                    count: version?.count
                });
                return offlineStorage.getTiposResiduos();
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const tipos: TipoResiduo[] = data.data || data;

            // Save to IndexedDB
            await offlineStorage.saveTiposResiduos(tipos);

            // Update version info
            this.versions.tiposResiduos = {
                catalog: 'tiposResiduos',
                etag: response.headers.get('ETag') || undefined,
                lastModified: response.headers.get('Last-Modified') || undefined,
                lastFetch: Date.now(),
                count: tipos.length
            };
            this.saveVersions();

            this.updateSyncStatus('tiposResiduos', {
                status: 'success',
                lastSync: Date.now(),
                count: tipos.length
            });

            return tipos;
        } catch (error) {
            this.updateSyncStatus('tiposResiduos', {
                status: 'error',
                error: (error as Error).message
            });

            // Return cached data on error
            return offlineStorage.getTiposResiduos();
        }
    }

    /**
     * Sync operadores catalog (filtered by user's assignments)
     */
    async syncOperadores(): Promise<Actor[]> {
        this.updateSyncStatus('operadores', { status: 'syncing' });

        try {
            const response = await fetch(`${API_BASE_URL}/api/catalogo/operadores`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const operadores: Actor[] = data.data || data;

            await offlineStorage.saveOperadores(operadores);

            this.versions.operadores = {
                catalog: 'operadores',
                lastFetch: Date.now(),
                count: operadores.length
            };
            this.saveVersions();

            this.updateSyncStatus('operadores', {
                status: 'success',
                lastSync: Date.now(),
                count: operadores.length
            });

            return operadores;
        } catch (error) {
            this.updateSyncStatus('operadores', {
                status: 'error',
                error: (error as Error).message
            });

            return offlineStorage.getOperadores();
        }
    }

    /**
     * Sync transportistas catalog (filtered by user's assignments)
     */
    async syncTransportistas(): Promise<Actor[]> {
        this.updateSyncStatus('transportistas', { status: 'syncing' });

        try {
            const response = await fetch(`${API_BASE_URL}/api/catalogo/transportistas`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const transportistas: Actor[] = data.data || data;

            await offlineStorage.saveTransportistas(transportistas);

            this.versions.transportistas = {
                catalog: 'transportistas',
                lastFetch: Date.now(),
                count: transportistas.length
            };
            this.saveVersions();

            this.updateSyncStatus('transportistas', {
                status: 'success',
                lastSync: Date.now(),
                count: transportistas.length
            });

            return transportistas;
        } catch (error) {
            this.updateSyncStatus('transportistas', {
                status: 'error',
                error: (error as Error).message
            });

            return offlineStorage.getTransportistas();
        }
    }

    // --- Getters (offline-first) ---

    /**
     * Get tipos de residuos (from cache, syncs in background if stale)
     */
    async getTiposResiduos(): Promise<TipoResiduo[]> {
        const cached = await offlineStorage.getTiposResiduos();

        // Check if we need to refresh
        const version = this.versions.tiposResiduos;
        const isStale = !version || (Date.now() - version.lastFetch > CATALOG_REFRESH_INTERVAL_MS);

        if (isStale && navigator.onLine) {
            // Refresh in background, return cached immediately
            this.syncTiposResiduos().catch(console.error);
        }

        return cached;
    }

    /**
     * Get operadores (from cache)
     */
    async getOperadores(): Promise<Actor[]> {
        const cached = await offlineStorage.getOperadores();

        const version = this.versions.operadores;
        const isStale = !version || (Date.now() - version.lastFetch > CATALOG_REFRESH_INTERVAL_MS);

        if (isStale && navigator.onLine) {
            this.syncOperadores().catch(console.error);
        }

        return cached;
    }

    /**
     * Get transportistas (from cache)
     */
    async getTransportistas(): Promise<Actor[]> {
        const cached = await offlineStorage.getTransportistas();

        const version = this.versions.transportistas;
        const isStale = !version || (Date.now() - version.lastFetch > CATALOG_REFRESH_INTERVAL_MS);

        if (isStale && navigator.onLine) {
            this.syncTransportistas().catch(console.error);
        }

        return cached;
    }

    /**
     * Get tipo residuo by ID
     */
    async getTipoResiduoById(id: string): Promise<TipoResiduo | undefined> {
        const tipos = await this.getTiposResiduos();
        return tipos.find(t => t.id === id);
    }

    /**
     * Get tipo residuo by codigo
     */
    async getTipoResiduoByCodigo(codigo: string): Promise<TipoResiduo | undefined> {
        const tipos = await this.getTiposResiduos();
        return tipos.find(t => t.codigo === codigo);
    }

    /**
     * Search tipos residuos
     */
    async searchTiposResiduos(query: string): Promise<TipoResiduo[]> {
        const tipos = await this.getTiposResiduos();
        const q = query.toLowerCase();
        return tipos.filter(t =>
            t.codigo.toLowerCase().includes(q) ||
            t.nombre.toLowerCase().includes(q) ||
            t.categoria.toLowerCase().includes(q)
        );
    }

    // --- Status ---

    /**
     * Get sync status for all catalogs
     */
    getSyncStatuses(): SyncStatus[] {
        return Array.from(this.syncStatuses.values());
    }

    /**
     * Get version info for all catalogs
     */
    getVersions(): CatalogVersions {
        return { ...this.versions };
    }

    /**
     * Check if catalogs are loaded
     */
    async isLoaded(): Promise<boolean> {
        const tipos = await offlineStorage.getTiposResiduos();
        return tipos.length > 0;
    }

    /**
     * Force refresh all catalogs
     */
    async forceRefresh(): Promise<void> {
        // Clear versions to force full fetch
        this.versions = {};
        this.saveVersions();
        await this.refreshAllCatalogs();
    }

    /**
     * Clear all cached catalogs
     */
    async clearCache(): Promise<void> {
        await offlineStorage.saveTiposResiduos([]);
        await offlineStorage.saveOperadores([]);
        await offlineStorage.saveTransportistas([]);
        this.versions = {};
        this.saveVersions();
    }
}

// Singleton instance
export const catalogSync = new CatalogSyncService();

// Export types
export type { TipoResiduo, Actor, SyncStatus, CatalogVersions };
