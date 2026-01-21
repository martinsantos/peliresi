/**
 * Admin API Client - HTTP calls only
 * Separated from admin.service.ts for better testability and separation of concerns
 */

import api from './api';
import type { ApiResponse } from '../types';
import type {
    UsuariosResponse,
    ActividadResponse,
    Usuario,
    SystemConfig,
    Generador,
    Transportista,
    Operador,
    CronTask,
} from './admin.types';

// ===== PDF API =====
export const pdfApi = {
    /**
     * Get raw PDF blob for manifiesto
     */
    async fetchManifiestoPDF(id: string): Promise<Blob> {
        const token = localStorage.getItem('accessToken');
        const baseURL = api.defaults.baseURL || '/api';

        const response = await fetch(`${baseURL}/pdf/manifiesto/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Error al descargar PDF: ${response.status}`);
        }

        return response.blob();
    },

    /**
     * Get raw PDF blob for certificado
     */
    async fetchCertificadoPDF(id: string): Promise<Blob> {
        const token = localStorage.getItem('accessToken');
        const baseURL = api.defaults.baseURL || '/api';

        const response = await fetch(`${baseURL}/pdf/certificado/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Error al descargar certificado: ${response.status}`);
        }

        return response.blob();
    },

    /**
     * Get PDF URL for embedding/linking
     */
    getManifiestoPDFUrl(id: string): string {
        return `${api.defaults.baseURL}/pdf/manifiesto/${id}`;
    },

    getCertificadoPDFUrl(id: string): string {
        return `${api.defaults.baseURL}/pdf/certificado/${id}`;
    },
};

// ===== Reportes API =====
export const reporteApi = {
    async getReporteManifiestos(params?: {
        fechaInicio?: string;
        fechaFin?: string;
        estado?: string;
        tipoResiduoId?: string;
    }) {
        return api.get<ApiResponse<any>>('/reportes/manifiestos', { params });
    },

    async getReporteTratados(params?: {
        fechaInicio?: string;
        fechaFin?: string;
    }) {
        return api.get<ApiResponse<any>>('/reportes/tratados', { params });
    },

    async getReporteTransporte(params?: {
        fechaInicio?: string;
        fechaFin?: string;
    }) {
        return api.get<ApiResponse<any>>('/reportes/transporte', { params });
    },

    async getLogAuditoria(params?: {
        fechaInicio?: string;
        fechaFin?: string;
        tipo?: string;
        manifiestoId?: string;
        page?: number;
        limit?: number;
    }) {
        return api.get<ApiResponse<any>>('/reportes/auditoria', { params });
    },

    async fetchCSVExport(tipo: string, params?: {
        fechaInicio?: string;
        fechaFin?: string;
    }): Promise<Blob> {
        const token = localStorage.getItem('accessToken');
        const queryString = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
        const response = await fetch(`${api.defaults.baseURL}/reportes/exportar/${tipo}?${queryString}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Error al exportar');
        }

        return response.blob();
    },
};

// ===== Actores API =====
export const actorApi = {
    // Generadores
    getGeneradores(params?: { search?: string; activo?: boolean; page?: number; limit?: number }) {
        return api.get<ApiResponse<{ generadores: Generador[]; pagination: any }>>('/actores/generadores', { params });
    },

    createGenerador(data: Omit<Generador, 'id' | 'activo' | '_count'>) {
        return api.post<ApiResponse<{ generador: Generador; message?: string }>>('/actores/generadores', data);
    },

    updateGenerador(id: string, data: Partial<Generador>) {
        return api.put<ApiResponse<{ generador: Generador }>>(`/actores/generadores/${id}`, data);
    },

    deleteGenerador(id: string) {
        return api.delete(`/actores/generadores/${id}`);
    },

    // Transportistas
    getTransportistas(params?: { search?: string; activo?: boolean; page?: number; limit?: number }) {
        return api.get<ApiResponse<{ transportistas: Transportista[]; pagination: any }>>('/actores/transportistas', { params });
    },

    createTransportista(data: any) {
        return api.post<ApiResponse<{ transportista: Transportista }>>('/actores/transportistas', data);
    },

    updateTransportista(id: string, data: Partial<Transportista>) {
        return api.put<ApiResponse<{ transportista: Transportista }>>(`/actores/transportistas/${id}`, data);
    },

    addVehiculo(transportistaId: string, data: any) {
        return api.post<ApiResponse<{ vehiculo: any }>>(`/actores/transportistas/${transportistaId}/vehiculos`, data);
    },

    addChofer(transportistaId: string, data: any) {
        return api.post<ApiResponse<{ chofer: any }>>(`/actores/transportistas/${transportistaId}/choferes`, data);
    },

    // Operadores
    getOperadores(params?: { search?: string; activo?: boolean; page?: number; limit?: number }) {
        return api.get<ApiResponse<{ operadores: Operador[]; pagination: any }>>('/actores/operadores', { params });
    },

    createOperador(data: any) {
        return api.post<ApiResponse<{ operador: Operador }>>('/actores/operadores', data);
    },

    updateOperador(id: string, data: Partial<Operador>) {
        return api.put<ApiResponse<{ operador: Operador }>>(`/actores/operadores/${id}`, data);
    },

    deleteOperador(id: string) {
        return api.delete(`/actores/operadores/${id}`);
    },
};

// ===== Usuarios API =====
export const usuarioApi = {
    getUsuarios(params?: {
        page?: number;
        limit?: number;
        rol?: string;
        activo?: boolean | string;
        busqueda?: string;
    }) {
        return api.get<ApiResponse<UsuariosResponse>>('/admin/usuarios', { params });
    },

    getUsuariosPendientes() {
        return api.get<ApiResponse<{ usuarios: Usuario[]; total: number }>>('/admin/usuarios/pendientes');
    },

    getUsuario(id: string) {
        return api.get<ApiResponse<{ usuario: Usuario; actividadReciente: any[] }>>(`/admin/usuarios/${id}`);
    },

    updateUsuario(id: string, data: Partial<Usuario>) {
        return api.put<ApiResponse<{ usuario: Usuario }>>(`/admin/usuarios/${id}`, data);
    },

    aprobarUsuario(id: string) {
        return api.post<ApiResponse<{ usuario: Usuario }>>(`/admin/usuarios/${id}/aprobar`);
    },

    rechazarUsuario(id: string, motivo?: string) {
        return api.post(`/admin/usuarios/${id}/rechazar`, { motivo });
    },

    getActividad(params?: {
        page?: number;
        limit?: number;
        tipo?: string;
        desde?: string;
        hasta?: string;
    }) {
        return api.get<ApiResponse<ActividadResponse>>('/admin/actividad', { params });
    },

    getEstadisticas() {
        return api.get<ApiResponse<{
            usuarios: { total: number; activos: number; pendientes: number; porRol: Record<string, number> };
            manifiestos: { total: number; porEstado: Record<string, number> };
        }>>('/admin/estadisticas');
    },

    getEstadisticasDepartamento() {
        return api.get<ApiResponse<any>>('/admin/estadisticas-departamento');
    },

    getEstadisticasHistoricas(params?: {
        desde?: string;
        hasta?: string;
        agrupacion?: 'dia' | 'semana' | 'mes';
    }) {
        return api.get<ApiResponse<any>>('/admin/estadisticas-historicas', { params });
    },
};

// ===== Config API =====
export const configApi = {
    getConfig() {
        return api.get<ApiResponse<{ config: SystemConfig }>>('/config');
    },

    updateConfig(updates: Partial<SystemConfig>) {
        return api.put<ApiResponse<{ config: SystemConfig }>>('/config', updates);
    },

    resetConfig() {
        return api.post<ApiResponse<{ config: SystemConfig }>>('/config/reset');
    },

    getToleranciaPeso() {
        return api.get<ApiResponse<{ toleranciaPeso: number }>>('/config/public/tolerancia-peso');
    },
};

// ===== Cron API =====
export const cronApi = {
    getStatus() {
        return api.get<ApiResponse<{ tasks: CronTask[] }>>('/cron/status');
    },

    runTask(taskName: string) {
        return api.post<ApiResponse<{ success: boolean; message: string }>>(`/cron/run/${taskName}`);
    },

    runBackup(tipo: 'daily' | 'weekly' = 'daily') {
        return api.post<ApiResponse<{ success: boolean; message: string }>>('/cron/backup', { tipo });
    },
};
