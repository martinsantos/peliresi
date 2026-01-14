/**
 * Utilidades para manifiestos
 * Extraido de MobileApp.tsx para reducir duplicacion
 */

import type { UserRole } from '../types/mobile.types';

// Tipos para manifiestos del backend
export interface BackendManifiesto {
    id: string;
    numero?: string;
    estado: string;
    generador?: { razonSocial?: string; domicilio?: string; latitud?: number; longitud?: number; id?: string };
    operador?: { razonSocial?: string; domicilio?: string; latitud?: number; longitud?: number; id?: string };
    transportista?: { razonSocial?: string; id?: string };
    residuos?: Array<{
        tipoResiduo?: { nombre?: string; codigo?: string };
        cantidad?: number;
        unidad?: string;
        descripcion?: string;
        observaciones?: string;
    }>;
    fechaCreacion?: string;
    eta?: string;
    observaciones?: string;
    transportistaId?: string;
    operadorId?: string;
    generadorId?: string;
}

export interface DisplayManifiesto {
    id: string;
    numero: string;
    estado: string;
    generador: string;
    operador: string;
    transportista: string;
    residuo: string;
    cantidad: string;
    fecha: string;
    eta: string | null;
    _original: BackendManifiesto;
}

/**
 * Convierte un manifiesto del backend al formato de display
 */
export function formatManifiestoForDisplay(m: BackendManifiesto): DisplayManifiesto {
    return {
        id: m.id,
        numero: m.numero || `MAN-${m.id?.slice(-6)}`,
        estado: m.estado,
        generador: m.generador?.razonSocial || (m.generador as unknown as string) || 'Generador',
        operador: m.operador?.razonSocial || (m.operador as unknown as string) || 'Operador',
        transportista: m.transportista?.razonSocial || (m.transportista as unknown as string) || 'Transportista',
        residuo: m.residuos?.[0]?.tipoResiduo?.nombre || 'Residuos',
        cantidad: m.residuos?.[0] ? `${m.residuos[0].cantidad} ${m.residuos[0].unidad}` : '-',
        fecha: m.fechaCreacion
            ? new Date(m.fechaCreacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
            : '-',
        eta: m.eta || null,
        _original: m
    };
}

// Estados por rol y tab
type TabType = 'pendientes' | 'en-curso' | 'realizados';

const ESTADOS_POR_ROL_Y_TAB: Record<UserRole, Record<TabType, string[]>> = {
    GENERADOR: {
        'pendientes': ['BORRADOR', 'PENDIENTE_APROBACION'],
        'en-curso': ['APROBADO', 'EN_TRANSITO', 'ENTREGADO'],
        'realizados': ['RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO']
    },
    OPERADOR: {
        'pendientes': ['EN_TRANSITO', 'ENTREGADO'],
        'en-curso': ['RECIBIDO', 'EN_TRATAMIENTO'],
        'realizados': ['TRATADO']
    },
    TRANSPORTISTA: {
        'pendientes': ['APROBADO'],
        'en-curso': ['EN_TRANSITO'],
        'realizados': ['ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO']
    },
    ADMIN: {
        'pendientes': ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO'],
        'en-curso': ['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO'],
        'realizados': ['TRATADO']
    }
};

/**
 * Filtra manifiestos segun el rol y tab activo
 */
export function filterManifiestosByTab(
    manifiestos: BackendManifiesto[],
    role: UserRole,
    activeTab: TabType
): BackendManifiesto[] {
    const estadosPermitidos = ESTADOS_POR_ROL_Y_TAB[role]?.[activeTab] || [];
    return manifiestos.filter(m => estadosPermitidos.includes(m.estado));
}

/**
 * Cuenta manifiestos por tab para un rol
 */
export function countManifiestosByTab(
    manifiestos: BackendManifiesto[],
    role: UserRole
): Record<TabType, number> {
    return {
        'pendientes': filterManifiestosByTab(manifiestos, role, 'pendientes').length,
        'en-curso': filterManifiestosByTab(manifiestos, role, 'en-curso').length,
        'realizados': filterManifiestosByTab(manifiestos, role, 'realizados').length
    };
}

// Estados que debe cargar cada rol del backend
const ESTADOS_BACKEND_POR_ROL: Record<UserRole, string[]> = {
    TRANSPORTISTA: ['APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'],
    OPERADOR: ['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'],
    GENERADOR: ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'],
    ADMIN: ['APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO']
};

/**
 * Obtiene los estados que debe cargar un rol del backend
 */
export function getEstadosParaCargar(role: UserRole): string[] {
    return ESTADOS_BACKEND_POR_ROL[role] || ESTADOS_BACKEND_POR_ROL.ADMIN;
}

/**
 * Filtra manifiestos cacheados por actor del usuario
 */
export function filterCachedByActor(
    cached: BackendManifiesto[],
    role: UserRole,
    actorIds: { transportistaId?: string; operadorId?: string; generadorId?: string }
): BackendManifiesto[] {
    const { transportistaId, operadorId, generadorId } = actorIds;

    switch (role) {
        case 'TRANSPORTISTA':
            if (transportistaId) {
                return cached.filter(m => m.transportistaId === transportistaId);
            }
            break;
        case 'OPERADOR':
            if (operadorId) {
                return cached.filter(m => m.operadorId === operadorId);
            }
            break;
        case 'GENERADOR':
            if (generadorId) {
                return cached.filter(m => m.generadorId === generadorId);
            }
            break;
    }
    return cached;
}

/**
 * Verifica si hay algun manifiesto en transito
 */
export function hasManifiestoEnTransito(manifiestos: BackendManifiesto[]): boolean {
    return manifiestos.some(m => m.estado === 'EN_TRANSITO');
}

/**
 * Encuentra el manifiesto en transito
 */
export function findManifiestoEnTransito(manifiestos: BackendManifiesto[]): BackendManifiesto | undefined {
    return manifiestos.find(m => m.estado === 'EN_TRANSITO');
}

/**
 * Calcula la distancia total de una ruta usando la formula de Haversine
 */
export function calcularDistanciaRuta(ruta: Array<{ lat: number; lng: number }>): number {
    if (!ruta || ruta.length < 2) return 0;

    const toRad = (deg: number): number => (deg * Math.PI) / 180;
    const R = 6371; // Radio de la Tierra en km

    let total = 0;
    for (let i = 1; i < ruta.length; i++) {
        const lat1 = ruta[i - 1].lat;
        const lon1 = ruta[i - 1].lng;
        const lat2 = ruta[i].lat;
        const lon2 = ruta[i].lng;

        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    return Math.round(total * 100) / 100;
}

/**
 * Obtiene la posicion GPS actual
 */
export function getCurrentPosition(): Promise<GeolocationPosition | null> {
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            resolve,
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}
