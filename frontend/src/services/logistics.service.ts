/**
 * Logistics Service - Frontend
 * Servicios para tracking y logística en tiempo real
 */

import api from './api';

export interface GPSPoint {
    lat: number;
    lng: number;
    timestamp: string;
    velocidad?: number;
}

export interface RutaResponse {
    success: boolean;
    data: {
        ruta: GPSPoint[];
        viaje?: {
            id: string;
            inicio: string;
            fin?: string;
            duracion?: number;
            distancia?: number;
            estado: string;
        };
    };
}

export const logisticsService = {
    /**
     * Obtener la ruta GPS completa de un manifiesto
     */
    async getRutaManifiesto(manifiestoId: string): Promise<RutaResponse> {
        const response = await api.get<RutaResponse>(`/logistics/ruta/${manifiestoId}`);
        return response.data;
    },

    /**
     * Obtener posiciones actuales de todos los manifiestos en tránsito
     */
    async getPosicionesActivas(): Promise<{
        success: boolean;
        data: Array<{
            manifiestoId: string;
            lat: number;
            lng: number;
            timestamp: string;
        }>;
    }> {
        const response = await api.get('/logistics/posiciones-activas');
        return response.data;
    }
};

export default logisticsService;
