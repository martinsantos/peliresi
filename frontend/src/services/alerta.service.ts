import api from './api';

export interface ResultadoEvaluacion {
    reglaId: string;
    reglaNombre: string;
    evento: string;
    descripcion: string;
    severidad: 'INFO' | 'WARNING' | 'CRITICAL';
    detalles: Record<string, any>;
    accionRequerida?: string;
}

export interface ReglaAlerta {
    id: string;
    nombre: string;
    descripcion?: string;
    evento: string;
    condicion: string;
    destinatarios: string;
    activa: boolean;
    createdAt: string;
    creadoPor?: { nombre: string; apellido: string };
    _count?: { alertasGeneradas: number };
}

export interface AlertaGenerada {
    id: string;
    reglaId: string;
    manifiestoId?: string;
    datos: string;
    estado: 'PENDIENTE' | 'EN_REVISION' | 'RESUELTA' | 'DESCARTADA';
    createdAt: string;
    regla?: { nombre: string; evento: string };
    manifiesto?: { numero: string; estado: string };
}

export interface EvaluacionManifiesto {
    manifiestoId: string;
    advertencias: ResultadoEvaluacion[];
    hayAlertas: boolean;
    alertasCriticas: number;
    alertasWarning: number;
}

function extractArrayResponse<T>(response: { data: T[] | { data: T[] } }): T[] {
    return Array.isArray(response.data) ? response.data : (response.data.data || []);
}

class AlertaService {
    async evaluarManifiesto(manifiestoId: string): Promise<EvaluacionManifiesto> {
        try {
            const response = await api.get(`/alertas/evaluar/${manifiestoId}`);
            return response.data.data;
        } catch (error) {
            console.error('Error evaluando manifiesto:', error);
            return {
                manifiestoId,
                advertencias: [],
                hayAlertas: false,
                alertasCriticas: 0,
                alertasWarning: 0
            };
        }
    }

    async getAdvertenciasActivas(filtros?: {
        manifiestoId?: string;
        evento?: string;
        severidad?: string;
    }): Promise<ResultadoEvaluacion[]> {
        try {
            const params = new URLSearchParams();
            if (filtros?.manifiestoId) params.append('manifiestoId', filtros.manifiestoId);
            if (filtros?.evento) params.append('evento', filtros.evento);
            if (filtros?.severidad) params.append('severidad', filtros.severidad);

            const response = await api.get(`/alertas/advertencias?${params.toString()}`);
            return extractArrayResponse(response);
        } catch (error) {
            console.error('Error obteniendo advertencias:', error);
            return [];
        }
    }

    async getReglas(): Promise<ReglaAlerta[]> {
        try {
            const response = await api.get('/alertas/reglas');
            return response.data.data;
        } catch (error) {
            console.error('Error obteniendo reglas:', error);
            return [];
        }
    }

    async crearRegla(regla: Omit<ReglaAlerta, 'id' | 'createdAt'>): Promise<ReglaAlerta | null> {
        try {
            const response = await api.post('/alertas/reglas', regla);
            return response.data.data;
        } catch (error) {
            console.error('Error creando regla:', error);
            return null;
        }
    }

    async actualizarRegla(id: string, datos: Partial<ReglaAlerta>): Promise<ReglaAlerta | null> {
        try {
            const response = await api.put(`/alertas/reglas/${id}`, datos);
            return response.data.data;
        } catch (error) {
            console.error('Error actualizando regla:', error);
            return null;
        }
    }

    async eliminarRegla(id: string): Promise<boolean> {
        try {
            await api.delete(`/alertas/reglas/${id}`);
            return true;
        } catch (error) {
            console.error('Error eliminando regla:', error);
            return false;
        }
    }

    async getAlertasGeneradas(filtros?: {
        estado?: string;
        limit?: number;
        offset?: number;
    }): Promise<{ alertas: AlertaGenerada[]; total: number }> {
        try {
            const params = new URLSearchParams();
            if (filtros?.estado) params.append('estado', filtros.estado);
            if (filtros?.limit) params.append('limit', filtros.limit.toString());
            if (filtros?.offset) params.append('offset', filtros.offset.toString());

            const response = await api.get(`/alertas?${params.toString()}`);
            return response.data.data;
        } catch (error) {
            console.error('Error obteniendo alertas generadas:', error);
            return { alertas: [], total: 0 };
        }
    }

    async resolverAlerta(id: string, estado: string, notas?: string): Promise<boolean> {
        try {
            await api.put(`/alertas/${id}/resolver`, { estado, notas });
            return true;
        } catch (error) {
            console.error('Error resolviendo alerta:', error);
            return false;
        }
    }

    async notificarCambioEstado(
        manifiestoId: string,
        estadoAnterior: string,
        estadoNuevo: string
    ): Promise<ResultadoEvaluacion[]> {
        try {
            const response = await api.post('/alertas/notificar-cambio-estado', {
                manifiestoId,
                estadoAnterior,
                estadoNuevo
            });
            return response.data.data;
        } catch (error) {
            console.error('Error notificando cambio de estado:', error);
            return [];
        }
    }

    async evaluarTiemposExcesivos(): Promise<ResultadoEvaluacion[]> {
        try {
            const response = await api.get('/alertas/evaluar-tiempos');
            return extractArrayResponse(response);
        } catch (error) {
            console.error('Error evaluando tiempos:', error);
            return [];
        }
    }

    async evaluarVencimientos(): Promise<ResultadoEvaluacion[]> {
        try {
            const response = await api.get('/alertas/evaluar-vencimientos');
            return extractArrayResponse(response);
        } catch (error) {
            console.error('Error evaluando vencimientos:', error);
            return [];
        }
    }

    getSeveridadColor(severidad: string): { bg: string; color: string; border: string } {
        switch (severidad) {
            case 'CRITICAL':
                return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
            case 'WARNING':
                return { bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
            default:
                return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
        }
    }

    getEventoIcono(evento: string): string {
        const iconos: Record<string, string> = {
            CAMBIO_ESTADO: '🔄',
            INCIDENTE: '⚠️',
            DESVIO_RUTA: '🚧',
            TIEMPO_EXCESIVO: '⏰',
            DIFERENCIA_PESO: '⚖️',
            RECHAZO_CARGA: '❌',
            VENCIMIENTO: '📅',
            ANOMALIA_GPS: '📍'
        };
        return iconos[evento] || '📋';
    }
}

export const alertaService = new AlertaService();
