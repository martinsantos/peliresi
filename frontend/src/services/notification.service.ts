import api from './api';

// ============ TIPOS ============

export interface Notificacion {
    id: string;
    tipo: string;
    titulo: string;
    mensaje: string;
    datos?: any;
    manifiestoId?: string;
    manifiesto?: { numero: string; estado: string };
    leida: boolean;
    fechaLeida?: string;
    prioridad: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';
    createdAt: string;
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
    notas?: string;
    createdAt: string;
    regla?: { nombre: string; evento: string };
    manifiesto?: { numero: string; estado: string };
}

export interface Anomalia {
    id: string;
    manifiestoId: string;
    tipo: string;
    descripcion: string;
    latitud: number;
    longitud: number;
    valorDetectado?: number;
    valorEsperado?: number;
    severidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
    resuelta: boolean;
    notas?: string;
    createdAt: string;
}

// ============ SERVICIO DE NOTIFICACIONES ============

export const notificationService = {
    // Obtener notificaciones del usuario
    async getNotificaciones(params?: { leidas?: boolean; limit?: number; offset?: number }): Promise<{ notificaciones: Notificacion[]; noLeidas: number }> {
        try {
            const response = await api.get('/notificaciones', { params });
            const data = response.data?.data || response.data;
            return {
                notificaciones: data?.notificaciones || [],
                noLeidas: data?.noLeidas || 0
            };
        } catch (error) {
            console.error('[NotificationService] Error getNotificaciones:', error);
            return { notificaciones: [], noLeidas: 0 };
        }
    },

    // Obtener MIS alertas filtradas por rol y actor (relevancia directa)
    async getMisAlertas(params: {
        rol: string;
        actorId?: string;
        limit?: number;
    }): Promise<{ notificaciones: Notificacion[]; noLeidas: number }> {
        try {
            const response = await api.get('/notificaciones/mis-alertas', { params });
            // Handle both wrapped and unwrapped responses
            const data = response.data?.data || response.data;
            return {
                notificaciones: data.notificaciones || [],
                noLeidas: data.noLeidas || 0
            };
        } catch (error) {
            console.warn('getMisAlertas fallback to getNotificaciones:', error);
            // Fallback to regular notifications if endpoint not available
            const data = await this.getNotificaciones({ limit: params.limit });
            return data;
        }
    },

    // Marcar como leída
    async marcarLeida(id: string): Promise<boolean> {
        try {
            await api.put(`/notificaciones/${id}/leer`);
            return true;
        } catch (error) {
            console.error('[NotificationService] Error marcarLeida:', error);
            return false;
        }
    },

    // Marcar todas como leídas
    async marcarTodasLeidas(): Promise<boolean> {
        try {
            await api.put('/notificaciones/leer-todas');
            return true;
        } catch (error) {
            console.error('[NotificationService] Error marcarTodasLeidas:', error);
            return false;
        }
    },

    // Eliminar notificación
    async eliminar(id: string): Promise<boolean> {
        try {
            await api.delete(`/notificaciones/${id}`);
            return true;
        } catch (error) {
            console.error('[NotificationService] Error eliminar:', error);
            return false;
        }
    }
};

// ============ SERVICIO DE ALERTAS ============

export const alertaService = {
    // Obtener reglas de alerta
    async getReglas(): Promise<ReglaAlerta[]> {
        try {
            const response = await api.get('/alertas/reglas');
            // Handle different response structures: { data: [...] } or [...]
            return response.data?.data || response.data || [];
        } catch (error) {
            console.error('[AlertaService] Error getReglas:', error);
            return [];
        }
    },

    // Crear regla
    async crearRegla(data: {
        nombre: string;
        descripcion?: string;
        evento: string;
        condicion: any;
        destinatarios: any;
    }): Promise<ReglaAlerta | null> {
        try {
            const response = await api.post('/alertas/reglas', data);
            return response.data?.data || null;
        } catch (error) {
            console.error('[AlertaService] Error crearRegla:', error);
            throw error;
        }
    },

    // Actualizar regla
    async actualizarRegla(id: string, data: Partial<ReglaAlerta>): Promise<ReglaAlerta | null> {
        try {
            const response = await api.put(`/alertas/reglas/${id}`, data);
            return response.data?.data || null;
        } catch (error) {
            console.error('[AlertaService] Error actualizarRegla:', error);
            throw error;
        }
    },

    // Eliminar regla
    async eliminarRegla(id: string): Promise<boolean> {
        try {
            await api.delete(`/alertas/reglas/${id}`);
            return true;
        } catch (error) {
            console.error('[AlertaService] Error eliminarRegla:', error);
            throw error;
        }
    },

    // Obtener alertas generadas
    async getAlertas(params?: { estado?: string; limit?: number; offset?: number }): Promise<AlertaGenerada[]> {
        try {
            const response = await api.get('/alertas', { params });
            // La respuesta tiene estructura { alertas: [], total, pagina, totalPaginas }
            const data = response.data?.data || response.data;
            return data?.alertas || [];
        } catch (error) {
            console.error('[AlertaService] Error getAlertas:', error);
            return [];
        }
    },

    // Resolver alerta
    async resolverAlerta(id: string, data: { estado: string; notas?: string }): Promise<AlertaGenerada | null> {
        try {
            const response = await api.put(`/alertas/${id}/resolver`, data);
            return response.data?.data || null;
        } catch (error) {
            console.error('[AlertaService] Error resolverAlerta:', error);
            throw error;
        }
    }
};

// ============ SERVICIO DE ANOMALÍAS ============

export const anomaliaService = {
    // Detectar anomalías de un manifiesto
    async detectar(manifiestoId: string): Promise<Anomalia[]> {
        try {
            const response = await api.post(`/anomalias/detectar/${manifiestoId}`);
            return response.data?.data || [];
        } catch (error) {
            console.error('[AnomaliaService] Error detectar:', error);
            return [];
        }
    },

    // Obtener anomalías de un manifiesto
    async getAnomalias(manifiestoId: string, resuelta?: boolean): Promise<Anomalia[]> {
        try {
            const params: any = {};
            if (resuelta !== undefined) params.resuelta = resuelta;
            const response = await api.get(`/anomalias/${manifiestoId}`, { params });
            return response.data?.data || [];
        } catch (error) {
            console.error('[AnomaliaService] Error getAnomalias:', error);
            return [];
        }
    },

    // Resolver anomalía
    async resolver(id: string, notas?: string): Promise<Anomalia | null> {
        try {
            const response = await api.put(`/anomalias/${id}/resolver`, { notas });
            return response.data?.data || null;
        } catch (error) {
            console.error('[AnomaliaService] Error resolver:', error);
            throw error;
        }
    }
};

// ============ SERVICIO DE CARGA MASIVA ============

export const cargaMasivaService = {
    // Descargar plantilla
    async descargarPlantilla(tipo: 'generadores' | 'transportistas' | 'operadores'): Promise<boolean> {
        try {
            const response = await api.get(`/actores/carga-masiva/plantilla/${tipo}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `plantilla_${tipo}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            return true;
        } catch (error) {
            console.error('[CargaMasivaService] Error descargarPlantilla:', error);
            return false;
        }
    },

    // Cargar archivo
    async cargarArchivo(tipo: 'generadores' | 'transportistas' | 'operadores', archivo: File): Promise<any> {
        try {
            const formData = new FormData();
            formData.append('archivo', archivo);

            const response = await api.post(`/actores/carga-masiva/${tipo}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data?.data || { procesados: 0, errores: [] };
        } catch (error) {
            console.error('[CargaMasivaService] Error cargarArchivo:', error);
            throw error;
        }
    }
};
