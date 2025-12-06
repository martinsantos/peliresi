import api from './api';
import type {
    Manifiesto,
    DashboardStats,
    ApiResponse,
    TipoResiduo,
    Generador,
    Transportista,
    Operador
} from '../types';

export const manifiestoService = {
    // Dashboard
    async getDashboard(): Promise<DashboardStats> {
        const response = await api.get<ApiResponse<DashboardStats>>('/manifiestos/dashboard');
        return response.data.data;
    },

    // Manifiestos
    async getManifiestos(params?: {
        estado?: string;
        page?: number;
        limit?: number;
    }): Promise<{ manifiestos: Manifiesto[]; pagination: any }> {
        const response = await api.get<ApiResponse<{ manifiestos: Manifiesto[]; pagination: any }>>('/manifiestos', { params });
        return response.data.data;
    },

    async getManifiesto(id: string): Promise<Manifiesto> {
        const response = await api.get<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}`);
        return response.data.data.manifiesto;
    },

    async createManifiesto(data: {
        transportistaId: string;
        operadorId: string;
        observaciones?: string;
        residuos: Array<{
            tipoResiduoId: string;
            cantidad: number;
            unidad: string;
            descripcion?: string;
        }>;
    }): Promise<Manifiesto> {
        const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>('/manifiestos', data);
        return response.data.data.manifiesto;
    },

    async firmarManifiesto(id: string): Promise<Manifiesto> {
        const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/firmar`);
        return response.data.data.manifiesto;
    },

    async confirmarRetiro(id: string, data: {
        latitud?: number;
        longitud?: number;
        observaciones?: string;
    }): Promise<Manifiesto> {
        const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/confirmar-retiro`, data);
        return response.data.data.manifiesto;
    },

    async actualizarUbicacion(id: string, data: {
        latitud: number;
        longitud: number;
        velocidad?: number;
        direccion?: number;
    }): Promise<void> {
        await api.post(`/manifiestos/${id}/ubicacion`, data);
    },

    async confirmarEntrega(id: string, data: {
        latitud?: number;
        longitud?: number;
        observaciones?: string;
    }): Promise<Manifiesto> {
        const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/confirmar-entrega`, data);
        return response.data.data.manifiesto;
    },

    async confirmarRecepcion(id: string, data: {
        observaciones?: string;
        pesoReal?: number;
    }): Promise<Manifiesto> {
        const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/confirmar-recepcion`, data);
        return response.data.data.manifiesto;
    },

    async cerrarManifiesto(id: string, data: {
        metodoTratamiento: string;
        observaciones?: string;
    }): Promise<Manifiesto> {
        const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/cerrar`, data);
        return response.data.data.manifiesto;
    },

    // Nuevos endpoints para casos de uso completos
    async rechazarCarga(id: string, data: {
        motivo: string;
        descripcion?: string;
        cantidadRechazada?: number;
    }): Promise<Manifiesto> {
        const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/rechazar`, data);
        return response.data.data.manifiesto;
    },

    async registrarIncidente(id: string, data: {
        tipoIncidente: string;
        descripcion: string;
        latitud?: number;
        longitud?: number;
    }): Promise<void> {
        await api.post(`/manifiestos/${id}/incidente`, data);
    },

    async registrarTratamiento(id: string, data: {
        metodoTratamiento: string;
        fechaTratamiento?: string;
        observaciones?: string;
    }): Promise<Manifiesto> {
        const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/tratamiento`, data);
        return response.data.data.manifiesto;
    },

    async registrarPesaje(id: string, data: {
        residuosPesados: Array<{ id: string; pesoReal: number }>;
        observaciones?: string;
    }): Promise<{
        pesoDeclarado: number;
        pesoReal: number;
        diferencia: number;
        porcentajeDif: number;
    }> {
        const response = await api.post<ApiResponse<{
            pesoDeclarado: number;
            pesoReal: number;
            diferencia: number;
            porcentajeDif: number;
        }>>(`/manifiestos/${id}/pesaje`, data);
        return response.data.data;
    },
};

export const catalogoService = {
    async getTiposResiduos(): Promise<TipoResiduo[]> {
        const response = await api.get<ApiResponse<{ tiposResiduos: TipoResiduo[] }>>('/catalogos/tipos-residuos');
        return response.data.data.tiposResiduos;
    },

    async getGeneradores(): Promise<Generador[]> {
        const response = await api.get<ApiResponse<{ generadores: Generador[] }>>('/catalogos/generadores');
        return response.data.data.generadores;
    },

    async getTransportistas(): Promise<Transportista[]> {
        const response = await api.get<ApiResponse<{ transportistas: Transportista[] }>>('/catalogos/transportistas');
        return response.data.data.transportistas;
    },

    async getOperadores(tipoResiduoId?: string): Promise<Operador[]> {
        const params = tipoResiduoId ? { tipoResiduoId } : {};
        const response = await api.get<ApiResponse<{ operadores: Operador[] }>>('/catalogos/operadores', { params });
        return response.data.data.operadores;
    },
};
