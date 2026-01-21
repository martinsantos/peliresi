/**
 * Admin Service Types
 * Shared types for admin module
 */

// ===== Actor Types =====
export interface Actor {
    id: string;
    razonSocial: string;
    cuit: string;
    domicilio: string;
    telefono: string;
    email: string;
    activo: boolean;
    _count?: { manifiestos: number };
}

export interface Generador extends Actor {
    numeroInscripcion: string;
    categoria: string;
}

export interface Transportista extends Actor {
    numeroHabilitacion: string;
    vehiculos?: any[];
    choferes?: any[];
}

export interface Operador extends Actor {
    numeroHabilitacion: string;
    categoria: string;
    tratamientos?: any[];
}

// ===== Usuario Types =====
export interface Usuario {
    id: string;
    email: string;
    rol: string;
    nombre: string;
    apellido: string;
    empresa?: string;
    telefono?: string;
    activo: boolean;
    createdAt: string;
    updatedAt?: string;
    generador?: { id: string; razonSocial: string };
    transportista?: { id: string; razonSocial: string };
    operador?: { id: string; razonSocial: string };
}

export interface UsuariosResponse {
    usuarios: Usuario[];
    stats: {
        total: number;
        activos: number;
        inactivos: number;
        porRol: Record<string, number>;
    };
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

// ===== Actividad Types =====
export interface Actividad {
    id: string;
    tipo: 'MANIFIESTO' | 'SISTEMA';
    accion: string;
    descripcion: string;
    fecha: string;
    usuario: { nombre: string; apellido: string; rol: string } | null;
    manifiesto: { numero: string; estado: string } | null;
    metadata?: any;
}

export interface ActividadResponse {
    actividades: Actividad[];
    stats: {
        eventosHoy: number;
        manifestosActivos: number;
        usuariosActivos: number;
    };
    pagination: {
        page: number;
        limit: number;
    };
}

// ===== Config Types =====
export interface SystemConfig {
    vencimientoManifiestos: number;
    alertaDesvioGPS: number;
    tiempoMaxTransito: number;
    emailNotificaciones: string;
    toleranciaPeso: number;
    tiempoSesion: number;
    notificacionesPush: boolean;
    notificacionesEmail: boolean;
    notificacionesSMS: boolean;
    backupAutomatico: boolean;
    frecuenciaBackup: number;
    retencionLogs: number;
    maxArchivoCarga: number;
    maxManifiestosPorPagina: number;
    alertaTiempoExcesivo: boolean;
    alertaVencimientoProximo: boolean;
    diasAlertaVencimiento: number;
}

// ===== Cron Types =====
export interface CronTask {
    name: string;
    schedule: string;
    description: string;
}

// ===== Estadísticas Types =====
export interface EstadisticasDepartamento {
    departamentos: Array<{
        nombre: string;
        manifiestos: { total: number; enTransito: number; entregados: number; tratados: number };
        residuosTratados: number;
        enProceso: number;
        ultimaActividad: string | null;
    }>;
    totales: {
        manifiestos: number;
        residuosTratados: number;
        departamentosActivos: number;
    };
}

export interface EstadisticasHistoricas {
    periodo: { desde: string; hasta: string };
    agrupacion: string;
    datos: Array<{
        fecha: string;
        manifiestos: number;
        residuos: number;
        alertas: number;
    }>;
    totales: {
        manifiestos: number;
        residuos: number;
        alertas: number;
    };
    tendencia: {
        manifiestos: number;
        residuos: number;
    };
}

// ===== Reportes Types =====
export interface ReporteManifiestos {
    manifiestos: any[];
    resumen: Record<string, any>;
    porEstado: Record<string, number>;
    porTipoResiduo: Record<string, number>;
}

export interface ReporteTratados {
    tratados: any[];
    resumen: Record<string, any>;
}

export interface ReporteTransporte {
    viajes: any[];
    resumen: Record<string, any>;
}

export interface LogAuditoria {
    logs: any[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
