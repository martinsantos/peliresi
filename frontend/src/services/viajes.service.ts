/**
 * Viajes Service
 * Servicio para comunicación con API de viajes
 */

import api from './api';

// ============ TIPOS ============

export interface RoutePoint {
    lat: number;
    lng: number;
    timestamp: string;
    velocidad?: number;
}

export interface TripEvent {
    tipo: 'INICIO' | 'FIN' | 'INCIDENTE' | 'PARADA' | 'REANUDACION';
    descripcion: string;
    timestamp: string;
    lat?: number;
    lng?: number;
}

export interface Viaje {
    id: string;
    manifiestoId: string;
    transportistaId: string;
    usuarioId: string;
    inicio: string;
    fin?: string;
    duracion?: number;
    distancia?: number;
    estado: 'EN_CURSO' | 'COMPLETADO' | 'CANCELADO' | 'INCIDENTE';
    ruta?: RoutePoint[];
    eventos?: TripEvent[];
    dispositivoId?: string;
    appVersion?: string;
    createdAt: string;
    updatedAt: string;
    manifiesto?: {
        numero: string;
        estado: string;
        generador?: { razonSocial: string };
        operador?: { razonSocial: string };
    };
}

export interface IniciarViajeParams {
    manifiestoId: string;
    dispositivoId?: string;
    appVersion?: string;
}

export interface FinalizarViajeParams {
    ruta?: RoutePoint[];
    eventos?: TripEvent[];
    duracion?: number;
    distancia?: number;
}

export interface SyncViajeParams {
    manifiestoId: string;
    inicio: string;
    fin?: string;
    duracion?: number;
    distancia?: number;
    ruta?: RoutePoint[];
    eventos?: TripEvent[];
    dispositivoId?: string;
    appVersion?: string;
}

// ============ SERVICIO ============

export const viajesService = {
    /**
     * Iniciar un nuevo viaje
     */
    async iniciarViaje(params: IniciarViajeParams): Promise<Viaje> {
        const response = await api.post('/viajes', params);
        return response.data.data.viaje;
    },

    /**
     * Finalizar un viaje
     */
    async finalizarViaje(id: string, params: FinalizarViajeParams): Promise<Viaje> {
        const response = await api.put(`/viajes/${id}/finalizar`, params);
        return response.data.data.viaje;
    },

    /**
     * Obtener mis viajes (historial)
     */
    async getMisViajes(params?: { estado?: string; limit?: number; offset?: number }): Promise<{
        viajes: Viaje[];
        total: number;
        pagina: number;
        totalPaginas: number;
    }> {
        const response = await api.get('/viajes/mis-viajes', { params });
        return response.data.data;
    },

    /**
     * Obtener un viaje por ID
     */
    async getViaje(id: string): Promise<Viaje> {
        const response = await api.get(`/viajes/${id}`);
        return response.data.data.viaje;
    },

    /**
     * Agregar evento a un viaje
     */
    async agregarEvento(id: string, evento: { tipo: string; descripcion: string; lat?: number; lng?: number }): Promise<Viaje> {
        const response = await api.post(`/viajes/${id}/evento`, evento);
        return response.data.data.viaje;
    },

    /**
     * Actualizar ruta (agregar puntos GPS)
     */
    async actualizarRuta(id: string, puntos: RoutePoint[]): Promise<{ viaje: Viaje; puntosAgregados: number }> {
        const response = await api.post(`/viajes/${id}/ruta`, { puntos });
        return response.data.data;
    },

    /**
     * Sincronizar viaje completo desde offline
     */
    async syncViaje(params: SyncViajeParams): Promise<Viaje> {
        const response = await api.post('/viajes/sync', params);
        return response.data.data.viaje;
    },

    /**
     * Obtener viajes por manifiesto
     */
    async getViajesPorManifiesto(manifiestoId: string): Promise<Viaje[]> {
        const response = await api.get(`/viajes/manifiesto/${manifiestoId}`);
        return response.data.data.viajes;
    },

    /**
     * Obtener viaje activo del usuario actual
     * Retorna el viaje EN_CURSO si existe
     */
    async getViajeActivo(): Promise<{ viajeActivo: Viaje | null; sincronizado?: boolean }> {
        const response = await api.get('/viajes/activo');
        return response.data.data;
    },

    /**
     * Obtener viaje en curso por manifiesto (con tiempo calculado por servidor)
     * IMPORTANTE: Usar este endpoint para sincronizar timer entre APP y WEB
     */
    async getViajeEnCurso(manifiestoId: string): Promise<{
        id: string;
        manifiestoId: string;
        manifiestoNumero: string;
        inicio: string;
        estado: string;
        isPaused: boolean;
        elapsedSeconds: number;
        pausasTotales: number;
        ruta: RoutePoint[];
        eventos: TripEvent[];
        ultimaUbicacion: { lat: number; lng: number; timestamp: string } | null;
    } | null> {
        try {
            const response = await api.get(`/manifiestos/${manifiestoId}/viaje-actual`);
            return response.data.data;
        } catch (error) {
            console.error('[viajes.service] Error obteniendo viaje en curso:', error);
            return null;
        }
    },

    /**
     * Pausar viaje
     */
    async pausarViaje(viajeId: string): Promise<Viaje> {
        const response = await api.post(`/viajes/${viajeId}/pausar`);
        return response.data.data.viaje;
    },

    /**
     * Reanudar viaje
     */
    async reanudarViaje(viajeId: string): Promise<Viaje> {
        const response = await api.post(`/viajes/${viajeId}/reanudar`);
        return response.data.data.viaje;
    },

    /**
     * Registrar incidente en viaje
     */
    async registrarIncidenteViaje(viajeId: string, params: {
        tipo: string;
        descripcion: string;
        latitud?: number;
        longitud?: number;
    }): Promise<{ viaje: Viaje; evento: any }> {
        const response = await api.post(`/viajes/${viajeId}/incidente`, params);
        return response.data.data;
    }
};

export default viajesService;
