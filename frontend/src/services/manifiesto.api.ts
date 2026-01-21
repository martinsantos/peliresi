/**
 * Manifiesto API - Raw HTTP API calls
 *
 * This file contains only HTTP operations, no data transformation.
 * For data transformation, see manifiesto.transformers.ts
 */

import api from './api';
import type { ApiResponse, Manifiesto } from '../types';
import type {
    GetManifiestosParams,
    CreateManifiestoData,
    ConfirmarRetiroData,
    ActualizarUbicacionData,
    ConfirmarEntregaData,
    ConfirmarRecepcionData,
    RechazarCargaData,
    RegistrarIncidenteData,
    RegistrarTratamientoData,
    RegistrarPesajeData,
    CerrarManifiestoData,
    FirmarConTokenData,
    PesajeResult,
} from './manifiesto.types';

// ===== Dashboard API =====
export const dashboardApi = {
    getDashboard() {
        return api.get<ApiResponse<any>>('/manifiestos/dashboard');
    },
};

// ===== Manifiesto CRUD API =====
export const manifiestoApi = {
    getAll(params?: GetManifiestosParams) {
        return api.get<ApiResponse<{ manifiestos: Manifiesto[]; pagination: any }>>('/manifiestos', { params });
    },

    getById(id: string) {
        return api.get<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}`);
    },

    create(data: CreateManifiestoData) {
        return api.post<ApiResponse<{ manifiesto: Manifiesto }>>('/manifiestos', data);
    },

    firmar(id: string) {
        return api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/firmar`);
    },

    confirmarRetiro(id: string, data: ConfirmarRetiroData) {
        return api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/confirmar-retiro`, data);
    },

    actualizarUbicacion(id: string, data: ActualizarUbicacionData) {
        return api.post(`/manifiestos/${id}/ubicacion`, data);
    },

    confirmarEntrega(id: string, data: ConfirmarEntregaData) {
        return api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/confirmar-entrega`, data);
    },

    confirmarRecepcion(id: string, data: ConfirmarRecepcionData) {
        return api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/confirmar-recepcion`, data);
    },

    rechazarCarga(id: string, data: RechazarCargaData) {
        return api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/rechazar`, data);
    },

    registrarIncidente(id: string, data: RegistrarIncidenteData) {
        return api.post(`/manifiestos/${id}/incidente`, data);
    },

    registrarTratamiento(id: string, data: RegistrarTratamientoData) {
        return api.post<ApiResponse<{ manifiesto: Manifiesto }>>(`/manifiestos/${id}/tratamiento`, data);
    },

    registrarPesaje(id: string, data: RegistrarPesajeData) {
        return api.post<ApiResponse<PesajeResult>>(`/manifiestos/${id}/pesaje`, data);
    },

    cerrar(id: string, data?: CerrarManifiestoData) {
        return api.post<ApiResponse<{ manifiesto: Manifiesto; certificado: string }>>(`/manifiestos/${id}/cerrar`, data);
    },

    firmarConToken(id: string, data: FirmarConTokenData) {
        return api.post<ApiResponse<any>>(`/manifiestos/${id}/firmar-con-token`, data);
    },
};

// ===== PDF API =====
export const pdfApi = {
    getPDFData(id: string) {
        return api.get<ApiResponse<any>>(`/pdf/manifiesto/${id}`);
    },

    getCertificado(id: string) {
        return api.get<ApiResponse<any>>(`/pdf/certificado/${id}`);
    },
};

// ===== Firma API =====
export const firmaApi = {
    getMetodosDisponibles() {
        return api.get<ApiResponse<any>>('/firma/metodos-disponibles');
    },

    solicitarCodigoSMS(telefono: string) {
        return api.post<{ success: boolean; message: string; hint?: string; expiraEn?: number }>(
            '/auth/enviar-codigo-sms',
            { telefono }
        );
    },
};

// ===== Catalogo API =====
export const catalogoApi = {
    getTiposResiduos() {
        return api.get<ApiResponse<{ tiposResiduos: any[] }>>('/catalogos/tipos-residuos');
    },

    getGeneradores() {
        return api.get<ApiResponse<{ generadores: any[] }>>('/catalogos/generadores');
    },

    getTransportistas() {
        return api.get<ApiResponse<{ transportistas: any[] }>>('/catalogos/transportistas');
    },

    getOperadores(tipoResiduoId?: string) {
        const params = tipoResiduoId ? { tipoResiduoId } : {};
        return api.get<ApiResponse<{ operadores: any[] }>>('/catalogos/operadores', { params });
    },
};
