/**
 * Manifiesto Service Types
 * Type definitions for manifiesto-related operations
 */

import type { Manifiesto, TipoResiduo, Generador, Transportista, Operador, DashboardStats } from '../types';

// Re-export DashboardStats from main types for consistency
export type { DashboardStats };

// ===== Dashboard Types =====
export interface DashboardEstadisticas {
    total: number;
    borradores: number;
    pendientesAprobacion?: number;
    aprobados: number;
    enTransito: number;
    entregados: number;
    recibidos: number;
    enTratamiento?: number;
    tratados: number;
}

// ===== Pagination Types =====
export interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

export interface PaginatedResponse<T> {
    data: T;
    pagination: Pagination;
}

// ===== Request Types =====
export interface GetManifiestosParams {
    estado?: string;
    page?: number;
    limit?: number;
    transportistaId?: string;
    generadorId?: string;
    operadorId?: string;
}

export interface CreateManifiestoData {
    transportistaId: string;
    operadorId: string;
    observaciones?: string;
    residuos: Array<{
        tipoResiduoId: string;
        cantidad: number;
        unidad: string;
        descripcion?: string;
    }>;
}

export interface ConfirmarRetiroData {
    latitud?: number;
    longitud?: number;
    observaciones?: string;
    firmaRetiro?: string;
}

export interface ActualizarUbicacionData {
    latitud: number;
    longitud: number;
    velocidad?: number;
    direccion?: number;
}

export interface ConfirmarEntregaData {
    latitud?: number;
    longitud?: number;
    observaciones?: string;
    firmaEntrega?: string;
}

export interface ConfirmarRecepcionData {
    observaciones?: string;
    pesoReal?: number;
    pesoRecibido?: number;
    firmaRecepcion?: string;
}

export interface RechazarCargaData {
    motivo: string;
    descripcion?: string;
    cantidadRechazada?: number;
}

export interface RegistrarIncidenteData {
    tipoIncidente: string;
    descripcion: string;
    latitud?: number;
    longitud?: number;
}

export interface RegistrarTratamientoData {
    metodoTratamiento: string;
    fechaTratamiento?: string;
    observaciones?: string;
}

export interface RegistrarPesajeData {
    residuosPesados: Array<{ id: string; pesoReal: number }>;
    observaciones?: string;
}

export interface PesajeResult {
    pesoDeclarado: number;
    pesoReal: number;
    diferencia: number;
    porcentajeDif: number;
}

export interface CerrarManifiestoData {
    observaciones?: string;
}

export interface CerrarManifiestoResult {
    manifiesto: Manifiesto | null;
    certificado: string;
}

export type MetodoFirma = 'USUARIO_PASSWORD' | 'TOKEN_PIN' | 'CODIGO_SMS' | 'CERTIFICADO_DIGITAL';

export interface FirmarConTokenData {
    metodoFirma: MetodoFirma;
    tokenPin?: string;
    codigoSMS?: string;
}

export interface FirmarConTokenResult {
    manifiesto: Manifiesto | null;
    firma: any;
}

export interface SolicitarCodigoSMSResult {
    success: boolean;
    message: string;
    hint?: string;
    expiraEn?: number;
}

// ===== Catalogo Types (re-exported for convenience) =====
export type { TipoResiduo, Generador, Transportista, Operador };
