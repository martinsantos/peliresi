/**
 * CentroControl Types and Constants
 */

import L from 'leaflet';

// Interfaz para viajes activos en tiempo real
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

// Colores para departamentos
export const DEPT_COLORS: Record<string, string> = {
    'Capital': '#3b82f6',
    'Ciudad': '#3b82f6',
    'Godoy Cruz': '#10b981',
    'Guaymallén': '#8b5cf6',
    'Las Heras': '#f59e0b',
    'Maipú': '#ef4444',
    'Luján de Cuyo': '#06b6d4',
    'San Martín': '#84cc16',
    'San Rafael': '#f97316',
    'Rivadavia': '#ec4899',
    'Tunuyán': '#14b8a6',
    'Tupungato': '#a855f7',
    'General Alvear': '#22c55e',
    'San Carlos': '#0ea5e9',
    'Lavalle': '#eab308',
    'Malargüe': '#f43f5e',
    'Santa Rosa': '#6366f1',
    'La Paz': '#d946ef',
    'Junín': '#78716c',
};

export const DEPT_CODES: Record<string, string> = {
    'Capital': 'CD',
    'Ciudad': 'CD',
    'Godoy Cruz': 'GC',
    'Guaymallén': 'GY',
    'Las Heras': 'LH',
    'Maipú': 'MP',
    'Luján de Cuyo': 'LJ',
    'San Martín': 'SM',
    'San Rafael': 'SR',
    'Rivadavia': 'RV',
    'Tunuyán': 'TN',
    'Tupungato': 'TP',
    'General Alvear': 'GA',
    'San Carlos': 'SC',
    'Lavalle': 'LV',
    'Malargüe': 'MG',
    'Santa Rosa': 'SRo',
    'La Paz': 'LP',
    'Junín': 'JN',
};

// Map Icons
export const truckIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#10b981">
            <circle cx="16" cy="16" r="14" fill="#10b981" stroke="#fff" stroke-width="2"/>
            <path d="M10 11h8v6h4l-2 4h-2v-2h-6v2h-2l-2-4h2v-6z" fill="#fff"/>
        </svg>
    `),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

export const truckPausedIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="#f59e0b" stroke="#fff" stroke-width="2"/>
            <rect x="11" y="10" width="4" height="12" fill="#fff"/>
            <rect x="17" y="10" width="4" height="12" fill="#fff"/>
        </svg>
    `),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

export const truckIncidentIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="#ef4444" stroke="#fff" stroke-width="2"/>
            <text x="16" y="22" text-anchor="middle" fill="#fff" font-size="18" font-weight="bold">!</text>
        </svg>
    `),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

export const generadorIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
            <rect x="2" y="8" width="24" height="18" rx="2" fill="#059669" stroke="#fff" stroke-width="1.5"/>
            <rect x="5" y="2" width="6" height="10" fill="#059669" stroke="#fff" stroke-width="1"/>
            <rect x="17" y="4" width="4" height="8" fill="#059669" stroke="#fff" stroke-width="1"/>
            <rect x="6" y="14" width="4" height="4" fill="#fff"/>
            <rect x="12" y="14" width="4" height="4" fill="#fff"/>
            <rect x="18" y="14" width="4" height="4" fill="#fff"/>
            <rect x="10" y="20" width="8" height="6" fill="#fff"/>
        </svg>
    `),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
});

export const operadorIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
            <rect x="4" y="4" width="20" height="22" rx="2" fill="#dc2626" stroke="#fff" stroke-width="1.5"/>
            <rect x="7" y="7" width="4" height="4" fill="#fff"/>
            <rect x="12" y="7" width="4" height="4" fill="#fff"/>
            <rect x="17" y="7" width="4" height="4" fill="#fff"/>
            <rect x="7" y="13" width="4" height="4" fill="#fff"/>
            <rect x="12" y="13" width="4" height="4" fill="#fff"/>
            <rect x="17" y="13" width="4" height="4" fill="#fff"/>
            <rect x="11" y="19" width="6" height="7" fill="#fff"/>
        </svg>
    `),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
});
