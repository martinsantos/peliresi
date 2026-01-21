/**
 * Manifiesto Service - Unified export for manifiesto functionality
 * Re-exports types, API clients, and high-level services
 *
 * Architecture:
 * - manifiesto.types.ts: Type definitions
 * - manifiesto.api.ts: Raw HTTP API calls
 * - manifiesto.transformers.ts: Data transformation and defaults
 * - manifiesto.service.ts: High-level service layer (this file)
 */

// Re-export types for backward compatibility
export type {
    DashboardEstadisticas,
    Pagination,
    PaginatedResponse,
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
    PesajeResult,
    CerrarManifiestoData,
    CerrarManifiestoResult,
    MetodoFirma,
    FirmarConTokenData,
    FirmarConTokenResult,
    SolicitarCodigoSMSResult,
} from './manifiesto.types';

// Import API clients and transformers
import { dashboardApi, manifiestoApi, pdfApi, firmaApi, catalogoApi } from './manifiesto.api';
import {
    defaults,
    transformDashboardResponse,
    transformManifiestosResponse,
    transformPesajeResponse,
    transformCerrarResponse,
    transformFirmarConTokenResponse,
    validateArrayData,
} from './manifiesto.transformers';
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
    Pagination,
} from './manifiesto.types';
import type { Manifiesto, TipoResiduo, Generador, Transportista, Operador, DashboardStats } from '../types';

// Import demo data for fallback
import {
    tiposResiduosDemo,
    transportistasDemo,
    operadoresDemo,
    generadoresDemo,
} from '../data/catalogos-demo';

// ===== Manifiesto Service =====
export const manifiestoService = {
    // Dashboard
    async getDashboard(): Promise<DashboardStats> {
        try {
            const response = await dashboardApi.getDashboard();
            return transformDashboardResponse(response.data?.data);
        } catch (error) {
            console.error('[ManifiestoService] Error getDashboard:', error);
            return defaults.dashboardStats();
        }
    },

    // CRUD Operations
    async getManifiestos(params?: GetManifiestosParams): Promise<{ manifiestos: Manifiesto[]; pagination: Pagination }> {
        try {
            const response = await manifiestoApi.getAll(params);
            return transformManifiestosResponse(response.data?.data);
        } catch (error) {
            console.error('[ManifiestoService] Error getManifiestos:', error);
            return { manifiestos: [], pagination: defaults.pagination() };
        }
    },

    async getManifiesto(id: string): Promise<Manifiesto | null> {
        try {
            const response = await manifiestoApi.getById(id);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error getManifiesto:', error);
            return null;
        }
    },

    async createManifiesto(data: CreateManifiestoData): Promise<Manifiesto | null> {
        try {
            const response = await manifiestoApi.create(data);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error createManifiesto:', error);
            throw error;
        }
    },

    // Workflow Operations
    async firmarManifiesto(id: string): Promise<Manifiesto | null> {
        try {
            const response = await manifiestoApi.firmar(id);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error firmarManifiesto:', error);
            throw error;
        }
    },

    async confirmarRetiro(id: string, data: ConfirmarRetiroData): Promise<Manifiesto | null> {
        try {
            const response = await manifiestoApi.confirmarRetiro(id, data);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error confirmarRetiro:', error);
            throw error;
        }
    },

    async actualizarUbicacion(id: string, data: ActualizarUbicacionData): Promise<void> {
        try {
            await manifiestoApi.actualizarUbicacion(id, data);
        } catch (error) {
            console.error('[ManifiestoService] Error actualizarUbicacion:', error);
            // No throw - non-critical operation
        }
    },

    async confirmarEntrega(id: string, data: ConfirmarEntregaData): Promise<Manifiesto | null> {
        try {
            const response = await manifiestoApi.confirmarEntrega(id, data);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error confirmarEntrega:', error);
            throw error;
        }
    },

    async confirmarRecepcion(id: string, data: ConfirmarRecepcionData): Promise<Manifiesto | null> {
        try {
            const response = await manifiestoApi.confirmarRecepcion(id, data);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error confirmarRecepcion:', error);
            throw error;
        }
    },

    async rechazarCarga(id: string, data: RechazarCargaData): Promise<Manifiesto | null> {
        try {
            const response = await manifiestoApi.rechazarCarga(id, data);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error rechazarCarga:', error);
            throw error;
        }
    },

    async registrarIncidente(id: string, data: RegistrarIncidenteData): Promise<void> {
        try {
            await manifiestoApi.registrarIncidente(id, data);
        } catch (error) {
            console.error('[ManifiestoService] Error registrarIncidente:', error);
            throw error;
        }
    },

    async registrarTratamiento(id: string, data: RegistrarTratamientoData): Promise<Manifiesto | null> {
        try {
            const response = await manifiestoApi.registrarTratamiento(id, data);
            return response.data?.data?.manifiesto || null;
        } catch (error) {
            console.error('[ManifiestoService] Error registrarTratamiento:', error);
            throw error;
        }
    },

    async registrarPesaje(id: string, data: RegistrarPesajeData): Promise<PesajeResult> {
        try {
            const response = await manifiestoApi.registrarPesaje(id, data);
            return transformPesajeResponse(response.data?.data);
        } catch (error) {
            console.error('[ManifiestoService] Error registrarPesaje:', error);
            throw error;
        }
    },

    // v3.1 Operations
    async cerrarManifiesto(id: string, data?: CerrarManifiestoData): Promise<{ manifiesto: Manifiesto | null; certificado: string }> {
        try {
            const response = await manifiestoApi.cerrar(id, data);
            return transformCerrarResponse(response.data?.data);
        } catch (error) {
            console.error('[ManifiestoService] Error cerrarManifiesto:', error);
            throw error;
        }
    },

    async getPDFData(id: string): Promise<any> {
        try {
            const response = await pdfApi.getPDFData(id);
            return response.data?.data || null;
        } catch (error) {
            console.error('[ManifiestoService] Error getPDFData:', error);
            return null;
        }
    },

    async getCertificado(id: string): Promise<any> {
        try {
            const response = await pdfApi.getCertificado(id);
            return response.data?.data || null;
        } catch (error) {
            console.error('[ManifiestoService] Error getCertificado:', error);
            return null;
        }
    },

    // Firma Operations
    async firmarConToken(id: string, data: FirmarConTokenData): Promise<{ manifiesto: Manifiesto | null; firma: any }> {
        try {
            const response = await manifiestoApi.firmarConToken(id, data);
            return transformFirmarConTokenResponse(response.data?.data);
        } catch (error) {
            console.error('[ManifiestoService] Error firmarConToken:', error);
            throw error;
        }
    },

    async getMetodosFirma(): Promise<{ metodos: any[] }> {
        try {
            const response = await firmaApi.getMetodosDisponibles();
            return response.data?.data || { metodos: [] };
        } catch (error) {
            console.error('[ManifiestoService] Error getMetodosFirma:', error);
            return { metodos: [] };
        }
    },

    async solicitarCodigoSMS(telefono: string): Promise<{ success: boolean; message: string; hint?: string; expiraEn?: number }> {
        try {
            const response = await firmaApi.solicitarCodigoSMS(telefono);
            return response.data || { success: false, message: 'Error al enviar código' };
        } catch (error) {
            console.error('[ManifiestoService] Error solicitarCodigoSMS:', error);
            return { success: false, message: 'Error de conexión' };
        }
    },
};

// ===== Catalogo Service =====
export const catalogoService = {
    async getTiposResiduos(): Promise<TipoResiduo[]> {
        try {
            const response = await catalogoApi.getTiposResiduos();
            const data = response.data?.data?.tiposResiduos;
            return validateArrayData(data, tiposResiduosDemo);
        } catch (error) {
            console.log('[CatalogoService] Error en API, usando datos demo para tipos de residuos:', error);
            return tiposResiduosDemo;
        }
    },

    async getGeneradores(): Promise<Generador[]> {
        try {
            const response = await catalogoApi.getGeneradores();
            const data = response.data?.data?.generadores;
            return validateArrayData(data, generadoresDemo);
        } catch (error) {
            console.log('[CatalogoService] Error en API, usando datos demo para generadores:', error);
            return generadoresDemo;
        }
    },

    async getTransportistas(): Promise<Transportista[]> {
        try {
            const response = await catalogoApi.getTransportistas();
            const data = response.data?.data?.transportistas;
            return validateArrayData(data, transportistasDemo);
        } catch (error) {
            console.log('[CatalogoService] Error en API, usando datos demo para transportistas:', error);
            return transportistasDemo;
        }
    },

    async getOperadores(tipoResiduoId?: string): Promise<Operador[]> {
        try {
            const response = await catalogoApi.getOperadores(tipoResiduoId);
            const data = response.data?.data?.operadores;
            return validateArrayData(data, operadoresDemo);
        } catch (error) {
            console.log('[CatalogoService] Error en API, usando datos demo para operadores:', error);
            return operadoresDemo;
        }
    },
};
