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
    // FASE 1: Agregado filtro por transportistaId
    async getManifiestos(params?: {
        estado?: string;
        page?: number;
        limit?: number;
        transportistaId?: string;  // P1: Filtrar por transportista asignado
        generadorId?: string;
        operadorId?: string;
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

    // ===== NUEVOS ENDPOINTS v3.1 =====

    // CU-O09: Cerrar manifiesto (estado final)
    async cerrarManifiesto(id: string, data?: {
        observaciones?: string;
    }): Promise<{ manifiesto: Manifiesto; certificado: string }> {
        const response = await api.post<ApiResponse<{ manifiesto: Manifiesto; certificado: string }>>(`/manifiestos/${id}/cerrar`, data);
        return response.data.data;
    },

    // CU-G10: Obtener datos para generar PDF con QR
    async getPDFData(id: string): Promise<{
        numero: string;
        estado: string;
        fechaEmision: string;
        generador: { razonSocial: string; cuit: string; inscripcion: string };
        transportista: { razonSocial: string; cuit: string; habilitacion: string; vehiculo: string; chofer: string };
        operador: { razonSocial: string; cuit: string; habilitacion: string };
        residuos: { tipo: string; peso: number; pesoRecibido: number | null; unidad: string };
        recorrido: { origen: string; destino: string; inicioTransporte: string | null; finTransporte: string | null };
        tratamiento: { tipo: string; fecha: string | null } | null;
        certificado: string | null;
        qrCode: string;
        qrVerificationUrl: string;
        firmas: {
            generador: { firmado: boolean; fecha: string };
            transportista: { firmado: boolean; fecha: string | null };
            operador: { firmado: boolean; fecha: string | null };
        };
    }> {
        const response = await api.get<ApiResponse<any>>(`/manifiestos/${id}/pdf`);
        return response.data.data;
    },

    // CU-O10: Obtener certificado de disposición final
    async getCertificado(id: string): Promise<{
        numero: string;
        manifiesto: string;
        fechaEmision: string;
        operador: { razonSocial: string; cuit: string; habilitacion: string; categoria: string };
        generador: { razonSocial: string; cuit: string };
        residuo: { tipo: string; pesoRecibido: number; unidad: string };
        tratamiento: { tipo: string; fecha: string; resultado: string };
        declaracion: string;
        firmaOperador: { nombre: string; fecha: string; sello: string };
        qrVerification: string;
    }> {
        const response = await api.get<ApiResponse<any>>(`/manifiestos/${id}/certificado`);
        return response.data.data;
    },

    // CU-G07: Firmar con método alternativo (Token/PIN/SMS)
    async firmarConToken(id: string, data: {
        metodoFirma: 'USUARIO_PASSWORD' | 'TOKEN_PIN' | 'CODIGO_SMS' | 'CERTIFICADO_DIGITAL';
        tokenPin?: string;
        codigoSMS?: string;
    }): Promise<{ manifiesto: Manifiesto; firma: { metodo: string; fecha: string; firmante: string; hashFirma: string } }> {
        const response = await api.post<ApiResponse<any>>(`/manifiestos/${id}/firmar-con-token`, data);
        return response.data.data;
    },

    // Obtener métodos de firma disponibles
    async getMetodosFirma(): Promise<{
        metodos: Array<{
            id: string;
            nombre: string;
            descripcion: string;
            requiere2FA: boolean;
            disponible: boolean;
            pinsDePrueba?: string[];
            codigosDePrueba?: string[];
            nota?: string;
        }>;
    }> {
        const response = await api.get<ApiResponse<any>>('/firma/metodos-disponibles');
        return response.data.data;
    },

    // Solicitar código SMS para firma
    async solicitarCodigoSMS(telefono: string): Promise<{ success: boolean; message: string; hint?: string; expiraEn?: number }> {
        const response = await api.post<{ success: boolean; message: string; hint?: string; expiraEn?: number }>('/auth/enviar-codigo-sms', { telefono });
        return response.data;
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
