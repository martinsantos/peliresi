/**
 * Admin Transformers - Data normalization and defaults
 * Handles transformation of API responses to expected formats
 */

import type {
    SystemConfig,
    UsuariosResponse,
    ActividadResponse,
    EstadisticasDepartamento,
    EstadisticasHistoricas,
    ReporteManifiestos,
    ReporteTratados,
    ReporteTransporte,
    LogAuditoria,
} from './admin.types';

// ===== Default Values =====
export const defaults = {
    pagination: {
        page: 1,
        limit: 10,
        total: 0,
        pages: 1,
    },

    emptyStats: {
        total: 0,
        activos: 0,
        inactivos: 0,
        porRol: {},
    },

    systemConfig: (): SystemConfig => ({
        vencimientoManifiestos: 30,
        alertaDesvioGPS: 5,
        tiempoMaxTransito: 48,
        emailNotificaciones: 'alertas@dgfa.mendoza.gov.ar',
        toleranciaPeso: 5,
        tiempoSesion: 60,
        notificacionesPush: true,
        notificacionesEmail: true,
        notificacionesSMS: false,
        backupAutomatico: true,
        frecuenciaBackup: 24,
        retencionLogs: 90,
        maxArchivoCarga: 10,
        maxManifiestosPorPagina: 50,
        alertaTiempoExcesivo: true,
        alertaVencimientoProximo: true,
        diasAlertaVencimiento: 7,
    }),

    usuariosResponse: (): UsuariosResponse => ({
        usuarios: [],
        stats: { total: 0, activos: 0, inactivos: 0, porRol: {} },
        pagination: { page: 1, limit: 10, total: 0, pages: 1 },
    }),

    actividadResponse: (): ActividadResponse => ({
        actividades: [],
        stats: { eventosHoy: 0, manifestosActivos: 0, usuariosActivos: 0 },
        pagination: { page: 1, limit: 50 },
    }),

    estadisticasDepartamento: (): EstadisticasDepartamento => ({
        departamentos: [],
        totales: { manifiestos: 0, residuosTratados: 0, departamentosActivos: 0 },
    }),

    estadisticasHistoricas: (): EstadisticasHistoricas => ({
        periodo: { desde: '', hasta: '' },
        agrupacion: 'dia',
        datos: [],
        totales: { manifiestos: 0, residuos: 0, alertas: 0 },
        tendencia: { manifiestos: 0, residuos: 0 },
    }),

    reporteManifiestos: (): ReporteManifiestos => ({
        manifiestos: [],
        resumen: {},
        porEstado: {},
        porTipoResiduo: {},
    }),

    reporteTratados: (): ReporteTratados => ({
        tratados: [],
        resumen: {},
    }),

    reporteTransporte: (): ReporteTransporte => ({
        viajes: [],
        resumen: {},
    }),

    logAuditoria: (): LogAuditoria => ({
        logs: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 1 },
    }),
};

// ===== Transformers =====

/**
 * Transform API response to UsuariosResponse with safe defaults
 */
export function transformUsuariosResponse(data: any): UsuariosResponse {
    if (!data) return defaults.usuariosResponse();

    return {
        usuarios: data.usuarios || [],
        stats: {
            total: data.stats?.total ?? 0,
            activos: data.stats?.activos ?? 0,
            inactivos: data.stats?.inactivos ?? 0,
            porRol: data.stats?.porRol ?? {},
        },
        pagination: {
            page: data.pagination?.page ?? 1,
            limit: data.pagination?.limit ?? 10,
            total: data.pagination?.total ?? 0,
            pages: data.pagination?.pages ?? 1,
        },
    };
}

/**
 * Transform API response to ActividadResponse with safe defaults
 */
export function transformActividadResponse(data: any): ActividadResponse {
    if (!data) return defaults.actividadResponse();

    return {
        actividades: data.actividades || [],
        stats: {
            eventosHoy: data.stats?.eventosHoy ?? 0,
            manifestosActivos: data.stats?.manifestosActivos ?? 0,
            usuariosActivos: data.stats?.usuariosActivos ?? 0,
        },
        pagination: {
            page: data.pagination?.page ?? 1,
            limit: data.pagination?.limit ?? 50,
        },
    };
}

/**
 * Transform API response to EstadisticasDepartamento
 */
export function transformEstadisticasDepartamento(data: any): EstadisticasDepartamento {
    if (!data) return defaults.estadisticasDepartamento();

    return {
        departamentos: data.departamentos || [],
        totales: {
            manifiestos: data.totales?.manifiestos ?? 0,
            residuosTratados: data.totales?.residuosTratados ?? 0,
            departamentosActivos: data.totales?.departamentosActivos ?? 0,
        },
    };
}

/**
 * Transform API response to EstadisticasHistoricas
 */
export function transformEstadisticasHistoricas(data: any): EstadisticasHistoricas {
    if (!data) return defaults.estadisticasHistoricas();

    return {
        periodo: {
            desde: data.periodo?.desde ?? '',
            hasta: data.periodo?.hasta ?? '',
        },
        agrupacion: data.agrupacion ?? 'dia',
        datos: data.datos || [],
        totales: {
            manifiestos: data.totales?.manifiestos ?? 0,
            residuos: data.totales?.residuos ?? 0,
            alertas: data.totales?.alertas ?? 0,
        },
        tendencia: {
            manifiestos: data.tendencia?.manifiestos ?? 0,
            residuos: data.tendencia?.residuos ?? 0,
        },
    };
}

/**
 * Transform system config with localStorage fallback
 */
export function transformSystemConfig(data: any, fallbackToLocal = true): SystemConfig {
    if (data?.config) {
        return { ...defaults.systemConfig(), ...data.config };
    }

    if (fallbackToLocal) {
        const saved = localStorage.getItem('sitrep_parametros');
        if (saved) {
            try {
                return { ...defaults.systemConfig(), ...JSON.parse(saved) };
            } catch {
                // ignore parse error
            }
        }
    }

    return defaults.systemConfig();
}

/**
 * Helper to download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(prefix: string, extension: string): string {
    const date = new Date().toISOString().split('T')[0];
    return `${prefix}_${date}.${extension}`;
}
