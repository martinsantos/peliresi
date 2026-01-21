/**
 * Manifiesto Transformers - Data transformation and defaults
 *
 * This file contains data normalization, default values, and transformation logic.
 */

import type { DashboardEstadisticas, Pagination, PesajeResult } from './manifiesto.types';
import type { DashboardStats } from '../types';

// ===== Default Values =====
export const defaults = {
    pagination: (): Pagination => ({
        page: 1,
        limit: 10,
        total: 0,
        pages: 1,
    }),

    estadisticas: (): DashboardEstadisticas => ({
        total: 0,
        borradores: 0,
        pendientesAprobacion: 0,
        aprobados: 0,
        enTransito: 0,
        entregados: 0,
        recibidos: 0,
        enTratamiento: 0,
        tratados: 0,
    }),

    dashboardStats: (): DashboardStats => ({
        estadisticas: defaults.estadisticas(),
        recientes: [],
        enTransitoList: [],
    }),

    pesajeResult: (): PesajeResult => ({
        pesoDeclarado: 0,
        pesoReal: 0,
        diferencia: 0,
        porcentajeDif: 0,
    }),
};

// ===== Transformers =====

/**
 * Transform raw dashboard API response to normalized DashboardStats
 * Backend uses "stats", frontend uses "estadisticas"
 */
export function transformDashboardResponse(data: any): DashboardStats {
    if (!data) return defaults.dashboardStats();

    // Normalizar respuesta: backend usa "stats", frontend usa "estadisticas"
    const estadisticas = data.estadisticas || data.stats || {};

    return {
        estadisticas: {
            total: estadisticas.total ?? 0,
            borradores: estadisticas.borradores ?? 0,
            pendientesAprobacion: estadisticas.pendientesAprobacion ?? 0,
            aprobados: estadisticas.aprobados ?? 0,
            enTransito: estadisticas.enTransito ?? 0,
            entregados: estadisticas.entregados ?? 0,
            recibidos: estadisticas.recibidos ?? 0,
            enTratamiento: estadisticas.enTratamiento ?? 0,
            tratados: estadisticas.tratados ?? 0,
        },
        recientes: data.recientes || [],
        enTransitoList: data.enTransitoList || [],
    };
}

/**
 * Transform paginated manifiesto response
 */
export function transformManifiestosResponse(data: any): { manifiestos: any[]; pagination: Pagination } {
    if (!data) {
        return { manifiestos: [], pagination: defaults.pagination() };
    }

    return {
        manifiestos: data.manifiestos || [],
        pagination: data.pagination || defaults.pagination(),
    };
}

/**
 * Transform pesaje response
 */
export function transformPesajeResponse(data: any): PesajeResult {
    if (!data) return defaults.pesajeResult();

    return {
        pesoDeclarado: data.pesoDeclarado ?? 0,
        pesoReal: data.pesoReal ?? 0,
        diferencia: data.diferencia ?? 0,
        porcentajeDif: data.porcentajeDif ?? 0,
    };
}

/**
 * Transform cerrar manifiesto response
 */
export function transformCerrarResponse(data: any): { manifiesto: any | null; certificado: string } {
    if (!data) return { manifiesto: null, certificado: '' };

    return {
        manifiesto: data.manifiesto || null,
        certificado: data.certificado || '',
    };
}

/**
 * Transform firmar con token response
 */
export function transformFirmarConTokenResponse(data: any): { manifiesto: any | null; firma: any } {
    if (!data) return { manifiesto: null, firma: null };

    return {
        manifiesto: data.manifiesto || null,
        firma: data.firma || null,
    };
}

/**
 * Validate array data and return fallback if invalid
 */
export function validateArrayData<T>(data: T[] | undefined | null, fallback: T[]): T[] {
    if (data && Array.isArray(data) && data.length > 0) {
        return data;
    }
    return fallback;
}
