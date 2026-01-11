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
    async getNotificaciones(params?: { leidas?: boolean; limit?: number; offset?: number }) {
        const response = await api.get('/notificaciones', { params });
        return response.data.data;
    },

    // Marcar como leída
    async marcarLeida(id: string) {
        const response = await api.put(`/notificaciones/${id}/leer`);
        return response.data.data;
    },

    // Marcar todas como leídas
    async marcarTodasLeidas() {
        const response = await api.put('/notificaciones/leer-todas');
        return response.data;
    },

    // Eliminar notificación
    async eliminar(id: string) {
        const response = await api.delete(`/notificaciones/${id}`);
        return response.data;
    }
};

// ============ SERVICIO DE ALERTAS ============

export const alertaService = {
    // Obtener reglas de alerta
    async getReglas() {
        const response = await api.get('/alertas/reglas');
        // Handle different response structures: { data: [...] } or [...]
        return response.data?.data || response.data || [];
    },

    // Crear regla
    async crearRegla(data: {
        nombre: string;
        descripcion?: string;
        evento: string;
        condicion: any;
        destinatarios: any;
    }) {
        const response = await api.post('/alertas/reglas', data);
        return response.data.data;
    },

    // Actualizar regla
    async actualizarRegla(id: string, data: Partial<ReglaAlerta>) {
        const response = await api.put(`/alertas/reglas/${id}`, data);
        return response.data.data;
    },

    // Eliminar regla
    async eliminarRegla(id: string) {
        const response = await api.delete(`/alertas/reglas/${id}`);
        return response.data;
    },

    // Obtener alertas generadas
    async getAlertas(params?: { estado?: string; limit?: number; offset?: number }) {
        const response = await api.get('/alertas', { params });
        // La respuesta tiene estructura { alertas: [], total, pagina, totalPaginas }
        const data = response.data.data;
        return data.alertas || [];
    },

    // Resolver alerta
    async resolverAlerta(id: string, data: { estado: string; notas?: string }) {
        const response = await api.put(`/alertas/${id}/resolver`, data);
        return response.data.data;
    }
};

// ============ SERVICIO DE ANOMALÍAS ============

export const anomaliaService = {
    // Detectar anomalías de un manifiesto
    async detectar(manifiestoId: string) {
        const response = await api.post(`/anomalias/detectar/${manifiestoId}`);
        return response.data.data;
    },

    // Obtener anomalías de un manifiesto
    async getAnomalias(manifiestoId: string, resuelta?: boolean) {
        const params: any = {};
        if (resuelta !== undefined) params.resuelta = resuelta;
        const response = await api.get(`/anomalias/${manifiestoId}`, { params });
        return response.data.data;
    },

    // Resolver anomalía
    async resolver(id: string, notas?: string) {
        const response = await api.put(`/anomalias/${id}/resolver`, { notas });
        return response.data.data;
    }
};

// ============ SERVICIO DE CARGA MASIVA ============

export const cargaMasivaService = {
    // Descargar plantilla
    async descargarPlantilla(tipo: 'generadores' | 'transportistas' | 'operadores') {
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
    },

    // Cargar archivo
    async cargarArchivo(tipo: 'generadores' | 'transportistas' | 'operadores', archivo: File) {
        const formData = new FormData();
        formData.append('archivo', archivo);

        const response = await api.post(`/actores/carga-masiva/${tipo}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data.data;
    }
};
// Updated for HMR refresh
