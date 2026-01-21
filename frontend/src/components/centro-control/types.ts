/**
 * Types for CentroControl components
 */

export interface ViajeActivo {
    id: string;
    manifiestoId: string;
    manifiestoNumero: string;
    transportistaRazonSocial: string;
    estado: 'EN_CURSO' | 'PAUSADO' | 'INCIDENTE';
    elapsedSeconds: number;
    ultimaUbicacion: { lat: number; lng: number } | null;
    isPaused: boolean;
}

export interface ManifiestoEnTransito {
    id: string;
    numero: string;
    lat: number;
    lng: number;
    generador: string;
    operador: string;
    estado: string;
    tiempoEnRuta?: string;
    origenLat?: number;
    origenLng?: number;
    destinoLat?: number;
    destinoLng?: number;
    generadorDomicilio?: string;
    generadorTelefono?: string;
    operadorDomicilio?: string;
    operadorTelefono?: string;
    transportista?: string;
    vehiculoPatente?: string;
    chofer?: string;
    velocidad?: number;
}

export interface SystemStats {
    manifiestos: {
        total: number;
        borradores: number;
        aprobados: number;
        enTransito: number;
        entregados: number;
        recibidos: number;
        tratados: number;
    };
    usuarios: {
        total: number;
        activos: number;
        pendientes: number;
        porRol: Record<string, number>;
    };
    alertasActivas: number;
    eventosHoy: number;
}

export interface DepartamentoStats {
    nombre: string;
    codigo: string;
    tratados: number;
    enProceso: number;
    color: string;
}

export type FiltroTiempo = 'hoy' | 'semana' | 'mes' | 'trimestre';
