// Mobile App Types - Extracted from MobileApp.tsx for reuse
// This enables proper separation of concerns between components

export type UserRole = 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
export type Screen = 'home' | 'manifiestos' | 'tracking' | 'alertas' | 'perfil' | 'detalle' | 'nuevo' | 'escanear' | 'actores' | 'viaje' | 'historial' | 'historial-viajes' | 'usuarios' | 'control';

export interface MenuItem {
    id: Screen;
    label: string;
    icon: React.ReactNode;
}

export interface GPSPosition {
    lat: number;
    lng: number;
}

export interface RoutePoint {
    lat: number;
    lng: number;
    timestamp: string;
}

export interface TripEvent {
    tipo: 'INCIDENTE' | 'PARADA' | 'INICIO' | 'FIN' | 'REANUDACION';
    descripcion: string;
    timestamp: string;
    gps: GPSPosition | null;
}

export interface SavedTrip {
    id: string;
    inicio: string;
    fin: string;
    duracion: number;
    eventos: TripEvent[];
    ruta?: RoutePoint[];
    role: string;
}

export interface Manifiesto {
    id: string;
    numero: string;
    estado: 'BORRADOR' | 'APROBADO' | 'EN_TRANSITO' | 'RECIBIDO' | 'TRATADO';
    generador: string;
    operador: string;
    residuo: string;
    cantidad: string;
    fecha: string;
    eta?: string;
}

export interface Actor {
    id: string;
    tipo: 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
    nombre: string;
    cuit: string;
    estado: 'ACTIVO' | 'INACTIVO';
    vehiculos?: number;
}

export interface Alerta {
    id: string;
    tipo: 'warning' | 'info' | 'success' | 'error';
    mensaje: string;
    tiempo: string;
}

// Role configuration helpers
export const ROLE_COLORS: Record<UserRole, string> = {
    'ADMIN': '#3b82f6',
    'GENERADOR': '#8b5cf6',
    'TRANSPORTISTA': '#f59e0b',
    'OPERADOR': '#10b981'
};

export const ROLE_NAMES: Record<UserRole, string> = {
    'ADMIN': 'Administrador',
    'GENERADOR': 'Generador',
    'TRANSPORTISTA': 'Transportista',
    'OPERADOR': 'Operador'
};

export const ESTADO_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
    'BORRADOR': { bg: '#e5e7eb', color: '#374151', label: 'Borrador' },
    'PENDIENTE_APROBACION': { bg: '#fef3c7', color: '#92400e', label: 'Pend. Aprobacion' },
    'APROBADO': { bg: '#fef3c7', color: '#92400e', label: 'Pendiente' },
    'EN_TRANSITO': { bg: '#dbeafe', color: '#1e40af', label: 'En Transito' },
    'ENTREGADO': { bg: '#fce7f3', color: '#9d174d', label: 'Entregado' },
    'RECIBIDO': { bg: '#d1fae5', color: '#065f46', label: 'Recibido' },
    'EN_TRATAMIENTO': { bg: '#e0e7ff', color: '#3730a3', label: 'En Tratamiento' },
    'TRATADO': { bg: '#10b981', color: '#fff', label: 'Completado' },
};
