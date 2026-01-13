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

const DEFAULT_DASHBOARD_STATS: DashboardStats = {
    estadisticas: {
        borradores: 0,
        aprobados: 0,
        enTransito: 0,
        entregados: 0,
        recibidos: 0,
        tratados: 0,
        total: 0
    },
    recientes: [],
    enTransitoList: []
};

export const manifiestoService = {
    // Dashboard
    async getDashboard(): Promise<DashboardStats> {
        try {
            const response = await api.get<ApiResponse<DashboardStats>>('/manifiestos/dashboard');
            return response.data?.data || DEFAULT_DASHBOARD_STATS;
        } catch (error) {
            console.error('[ManifiestoService] Error getDashboard:', error);
            return DEFAULT_DASHBOARD_STATS;
        }
    },

    // Manifiestos
    // FASE 1: Agregado filtro por transportistaId
    async getManifiestos(params?: {
        estado?: string;
        page?: number;
        limit?: number;
        transportistaId?: string;  // P1: Filtrar por transportista asignado
        generadorId?: string;
        operadorId?: string;
    }): Promise<{ manifiestos: Manifiesto[]; pagination: any }> {
        try {
            const response = await api.get<ApiResponse<{ manifiestos: Manifiesto[]; pagination: any }>>('/manifiestos', { params });
            return response.data?.data || { manifiestos: [], pagination: { page: 1, limit: 10, total: 0, pages: 1 } };
        } catch (error) {
            console.error('[ManifiestoService] Error getManifiestos:', error);
            return { manifiestos: [], pagination: { page: 1, limit: 10, total: 0, pages: 1 } };
        }
    },

    async getManifiesto(id: string): Promise<Manifiesto | null> {
        try {
            const response = await api.get<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}`);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error getManifiesto:', error);
            return null;
        }
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
    }): Promise<Manifiesto | null> {
        try {
            const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>('/manifiestos', data);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error createManifiesto:', error);
            throw error;
        }
    },

    async firmarManifiesto(id: string): Promise<Manifiesto | null> {
        try {
            const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/firmar`);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error firmarManifiesto:', error);
            throw error;
        }
    },

    async confirmarRetiro(id: string, data: {
        latitud?: number;
        longitud?: number;
        observaciones?: string;
        firmaRetiro?: string; // base64
    }): Promise<Manifiesto | null> {
        try {
            const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/confirmar-retiro`, data);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error confirmarRetiro:', error);
            throw error;
        }
    },

    async actualizarUbicacion(id: string, data: {
        latitud: number;
        longitud: number;
        velocidad?: number;
        direccion?: number;
    }): Promise<void> {
        try {
            await api.post(`/manifiestos/${id}/ubicacion`, data);
        } catch (error) {
            console.error('[ManifiestoService] Error actualizarUbicacion:', error);
            // No throw - non-critical operation
        }
    },

    async confirmarEntrega(id: string, data: {
        latitud?: number;
        longitud?: number;
        observaciones?: string;
        firmaEntrega?: string; // base64
    }): Promise<Manifiesto | null> {
        try {
            const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/confirmar-entrega`, data);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error confirmarEntrega:', error);
            throw error;
        }
    },

    async confirmarRecepcion(id: string, data: {
        observaciones?: string;
        pesoReal?: number;
        pesoRecibido?: number; // alias
        firmaRecepcion?: string; // base64
    }): Promise<Manifiesto | null> {
        try {
            const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/confirmar-recepcion`, data);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error confirmarRecepcion:', error);
            throw error;
        }
    },

    // Nuevos endpoints para casos de uso completos
    async rechazarCarga(id: string, data: {
        motivo: string;
        descripcion?: string;
        cantidadRechazada?: number;
    }): Promise<Manifiesto | null> {
        try {
            const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/rechazar`, data);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error rechazarCarga:', error);
            throw error;
        }
    },

    async registrarIncidente(id: string, data: {
        tipoIncidente: string;
        descripcion: string;
        latitud?: number;
        longitud?: number;
    }): Promise<void> {
        try {
            await api.post(`/manifiestos/${id}/incidente`, data);
        } catch (error) {
            console.error('[ManifiestoService] Error registrarIncidente:', error);
            throw error;
        }
    },

    async registrarTratamiento(id: string, data: {
        metodoTratamiento: string;
        fechaTratamiento?: string;
        observaciones?: string;
    }): Promise<Manifiesto | null> {
        try {
            const response = await api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/tratamiento`, data);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error registrarTratamiento:', error);
            throw error;
        }
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
        try {
            const response = await api.post<ApiResponse<{
                pesoDeclarado: number;
                pesoReal: number;
                diferencia: number;
                porcentajeDif: number;
            }>>(`/manifiestos/${id}/pesaje`, data);
            return response.data?.data || { pesoDeclarado: 0, pesoReal: 0, diferencia: 0, porcentajeDif: 0 };
        } catch (error) {
            console.error('[ManifiestoService] Error registrarPesaje:', error);
            throw error;
        }
    },

    // ===== NUEVOS ENDPOINTS v3.1 =====

    // CU-O09: Cerrar manifiesto (estado final)
    async cerrarManifiesto(id: string, data?: {
        observaciones?: string;
    }): Promise<{ manifiesto: Manifiesto | null; certificado: string }> {
        try {
            const response = await api.post<ApiResponse<{ manifiesto: Manifiesto; certificado: string }>>(`/manifiestos/${id}/cerrar`, data);
            return response.data?.data || { manifiesto: null, certificado: '' };
        } catch (error) {
            console.error('[ManifiestoService] Error cerrarManifiesto:', error);
            throw error;
        }
    },

    // CU-G10: Obtener datos para generar PDF con QR
    async getPDFData(id: string): Promise<any> {
        try {
            const response = await api.get<ApiResponse<any>>(`/manifiestos/${id}/pdf`);
            return response.data?.data || null;
        } catch (error) {
            console.error('[ManifiestoService] Error getPDFData:', error);
            return null;
        }
    },

    // CU-O10: Obtener certificado de disposición final
    async getCertificado(id: string): Promise<any> {
        try {
            const response = await api.get<ApiResponse<any>>(`/manifiestos/${id}/certificado`);
            return response.data?.data || null;
        } catch (error) {
            console.error('[ManifiestoService] Error getCertificado:', error);
            return null;
        }
    },

    // CU-G07: Firmar con método alternativo (Token/PIN/SMS)
    async firmarConToken(id: string, data: {
        metodoFirma: 'USUARIO_PASSWORD' | 'TOKEN_PIN' | 'CODIGO_SMS' | 'CERTIFICADO_DIGITAL';
        tokenPin?: string;
        codigoSMS?: string;
    }): Promise<{ manifiesto: Manifiesto | null; firma: any }> {
        try {
            const response = await api.post<ApiResponse<any>>(`/manifiestos/${id}/firmar-con-token`, data);
            return response.data?.data || { manifiesto: null, firma: null };
        } catch (error) {
            console.error('[ManifiestoService] Error firmarConToken:', error);
            throw error;
        }
    },

    // Obtener métodos de firma disponibles
    async getMetodosFirma(): Promise<{ metodos: any[] }> {
        try {
            const response = await api.get<ApiResponse<any>>('/firma/metodos-disponibles');
            return response.data?.data || { metodos: [] };
        } catch (error) {
            console.error('[ManifiestoService] Error getMetodosFirma:', error);
            return { metodos: [] };
        }
    },

    // Solicitar código SMS para firma
    async solicitarCodigoSMS(telefono: string): Promise<{ success: boolean; message: string; hint?: string; expiraEn?: number }> {
        try {
            const response = await api.post<{ success: boolean; message: string; hint?: string; expiraEn?: number }>('/auth/enviar-codigo-sms', { telefono });
            return response.data || { success: false, message: 'Error al enviar código' };
        } catch (error) {
            console.error('[ManifiestoService] Error solicitarCodigoSMS:', error);
            return { success: false, message: 'Error de conexión' };
        }
    },
};

// Importar datos demo para fallback
import {
    tiposResiduosDemo,
    transportistasDemo,
    operadoresDemo,
    generadoresDemo
} from '../data/catalogos-demo';

export const catalogoService = {
    async getTiposResiduos(): Promise<TipoResiduo[]> {
        try {
            const response = await api.get<ApiResponse<{ tiposResiduos: TipoResiduo[] }>>('/catalogos/tipos-residuos');
            return response.data.data.tiposResiduos;
        } catch {
            // Fallback a datos demo
            console.log('[CatalogoService] Usando datos demo para tipos de residuos');
            return tiposResiduosDemo;
        }
    },

    async getGeneradores(): Promise<Generador[]> {
        try {
            const response = await api.get<ApiResponse<{ generadores: Generador[] }>>('/catalogos/generadores');
            return response.data.data.generadores;
        } catch {
            console.log('[CatalogoService] Usando datos demo para generadores');
            return generadoresDemo;
        }
    },

    async getTransportistas(): Promise<Transportista[]> {
        try {
            const response = await api.get<ApiResponse<{ transportistas: Transportista[] }>>('/catalogos/transportistas');
            return response.data.data.transportistas;
        } catch {
            console.log('[CatalogoService] Usando datos demo para transportistas');
            return transportistasDemo;
        }
    },

    async getOperadores(tipoResiduoId?: string): Promise<Operador[]> {
        try {
            const params = tipoResiduoId ? { tipoResiduoId } : {};
            const response = await api.get<ApiResponse<{ operadores: Operador[] }>>('/catalogos/operadores', { params });
            return response.data.data.operadores;
        } catch {
            console.log('[CatalogoService] Usando datos demo para operadores');
            return operadoresDemo;
        }
    },
};
