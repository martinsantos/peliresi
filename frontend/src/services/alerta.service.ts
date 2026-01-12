/**
 * Servicio de Alertas - Frontend
 * Conecta con el backend para evaluar y mostrar alertas del sistema
 */

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

class AlertaService {
    /**
     * Evalúa un manifiesto contra todas las reglas activas
     */
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

    /**
     * Obtiene advertencias activas del sistema
     */
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
            return response.data.data;
        } catch (error) {
            console.error('Error obteniendo advertencias:', error);
            return [];
        }
    }

    /**
     * Obtiene todas las reglas de alerta (solo ADMIN)
     */
    async getReglas(): Promise<ReglaAlerta[]> {
        try {
            const response = await api.get('/alertas/reglas');
            return response.data.data;
        } catch (error) {
            console.error('Error obteniendo reglas:', error);
            return [];
        }
    }

    /**
     * Crea una nueva regla de alerta (solo ADMIN)
     */
    async crearRegla(regla: Omit<ReglaAlerta, 'id' | 'createdAt'>): Promise<ReglaAlerta | null> {
        try {
            const response = await api.post('/alertas/reglas', regla);
            return response.data.data;
        } catch (error) {
            console.error('Error creando regla:', error);
            return null;
        }
    }

    /**
     * Actualiza una regla de alerta (solo ADMIN)
     */
    async actualizarRegla(id: string, datos: Partial<ReglaAlerta>): Promise<ReglaAlerta | null> {
        try {
            const response = await api.put(`/alertas/reglas/${id}`, datos);
            return response.data.data;
        } catch (error) {
            console.error('Error actualizando regla:', error);
            return null;
        }
    }

    /**
     * Elimina una regla de alerta (solo ADMIN)
     */
    async eliminarRegla(id: string): Promise<boolean> {
        try {
            await api.delete(`/alertas/reglas/${id}`);
            return true;
        } catch (error) {
            console.error('Error eliminando regla:', error);
            return false;
        }
    }

    /**
     * Obtiene alertas generadas
     */
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

    /**
     * Resuelve una alerta
     */
    async resolverAlerta(id: string, estado: string, notas?: string): Promise<boolean> {
        try {
            await api.put(`/alertas/${id}/resolver`, { estado, notas });
            return true;
        } catch (error) {
            console.error('Error resolviendo alerta:', error);
            return false;
        }
    }

    /**
     * Notifica un cambio de estado para generar alertas
     */
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

    /**
     * Evalúa tiempos excesivos en manifiestos (solo ADMIN)
     */
    async evaluarTiemposExcesivos(): Promise<ResultadoEvaluacion[]> {
        try {
            const response = await api.get('/alertas/evaluar-tiempos');
            return response.data.data;
        } catch (error) {
            console.error('Error evaluando tiempos:', error);
            return [];
        }
    }

    /**
     * Evalúa vencimientos próximos (solo ADMIN)
     */
    async evaluarVencimientos(): Promise<ResultadoEvaluacion[]> {
        try {
            const response = await api.get('/alertas/evaluar-vencimientos');
            return response.data.data;
        } catch (error) {
            console.error('Error evaluando vencimientos:', error);
            return [];
        }
    }

    /**
     * Obtiene el color según la severidad
     */
    getSeveridadColor(severidad: string): { bg: string; color: string; border: string } {
        switch (severidad) {
            case 'CRITICAL':
                return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
            case 'WARNING':
                return { bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
            case 'INFO':
            default:
                return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
        }
    }

    /**
     * Obtiene el icono según el tipo de evento
     */
    getEventoIcono(evento: string): string {
        switch (evento) {
            case 'CAMBIO_ESTADO':
                return '🔄';
            case 'INCIDENTE':
                return '⚠️';
            case 'DESVIO_RUTA':
                return '🚧';
            case 'TIEMPO_EXCESIVO':
                return '⏰';
            case 'DIFERENCIA_PESO':
                return '⚖️';
            case 'RECHAZO_CARGA':
                return '❌';
            case 'VENCIMIENTO':
                return '📅';
            case 'ANOMALIA_GPS':
                return '📍';
            default:
                return '📋';
        }
    }
}

export const alertaService = new AlertaService();
