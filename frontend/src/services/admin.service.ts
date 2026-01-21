/**
 * Admin Service - Unified export for admin functionality
 * Re-exports types, API clients, and high-level services
 *
 * Architecture:
 * - admin.types.ts: Type definitions
 * - admin.api.ts: Raw HTTP API calls
 * - admin.transformers.ts: Data transformation and defaults
 * - admin.service.ts: High-level service layer (this file)
 */

// Re-export types for backward compatibility
export type {
    Actor,
    Generador,
    Transportista,
    Operador,
    Usuario,
    UsuariosResponse,
    Actividad,
    ActividadResponse,
    SystemConfig,
    CronTask,
    EstadisticasDepartamento,
    EstadisticasHistoricas,
} from './admin.types';

// Import API clients and transformers
import { pdfApi, reporteApi, actorApi, usuarioApi, configApi, cronApi } from './admin.api';
import {
    defaults,
    transformUsuariosResponse,
    transformActividadResponse,
    transformEstadisticasDepartamento,
    transformEstadisticasHistoricas,
    transformSystemConfig,
    downloadBlob,
    generateFilename,
} from './admin.transformers';
import type {
    Generador,
    Transportista,
    Operador,
    Usuario,
    UsuariosResponse,
    ActividadResponse,
    SystemConfig,
    CronTask,
} from './admin.types';

// ===== PDFs =====
export const pdfService = {
    getManifiestoPDFUrl(id: string): string {
        return pdfApi.getManifiestoPDFUrl(id);
    },

    getCertificadoPDFUrl(id: string): string {
        return pdfApi.getCertificadoPDFUrl(id);
    },

    async descargarManifiestoPDF(id: string): Promise<void> {
        try {
            const blob = await pdfApi.fetchManifiestoPDF(id);
            downloadBlob(blob, `manifiesto_${id}.pdf`);
        } catch (error) {
            console.error('[PDFService] Error en descargarManifiestoPDF:', error);
            throw error;
        }
    },

    async descargarCertificadoPDF(id: string): Promise<void> {
        try {
            const blob = await pdfApi.fetchCertificadoPDF(id);
            downloadBlob(blob, `certificado_${id}.pdf`);
        } catch (error) {
            console.error('[PDFService] Error en descargarCertificadoPDF:', error);
            throw error;
        }
    }
};

// ===== REPORTES =====
export const reporteService = {
    async getReporteManifiestos(params?: {
        fechaInicio?: string;
        fechaFin?: string;
        estado?: string;
        tipoResiduoId?: string;
    }): Promise<any> {
        try {
            const response = await reporteApi.getReporteManifiestos(params);
            return response.data?.data || { manifiestos: [], resumen: {}, porEstado: {}, porTipoResiduo: {} };
        } catch (error) {
            console.error('[ReporteService] Error getReporteManifiestos:', error);
            return { manifiestos: [], resumen: {}, porEstado: {}, porTipoResiduo: {} };
        }
    },

    async getReporteTratados(params?: {
        fechaInicio?: string;
        fechaFin?: string;
    }): Promise<any> {
        try {
            const response = await reporteApi.getReporteTratados(params);
            return response.data?.data || { tratados: [], resumen: {} };
        } catch (error) {
            console.error('[ReporteService] Error getReporteTratados:', error);
            return { tratados: [], resumen: {} };
        }
    },

    async getReporteTransporte(params?: {
        fechaInicio?: string;
        fechaFin?: string;
    }): Promise<any> {
        try {
            const response = await reporteApi.getReporteTransporte(params);
            return response.data?.data || { viajes: [], resumen: {} };
        } catch (error) {
            console.error('[ReporteService] Error getReporteTransporte:', error);
            return { viajes: [], resumen: {} };
        }
    },

    async getLogAuditoria(params?: {
        fechaInicio?: string;
        fechaFin?: string;
        tipo?: string;
        manifiestoId?: string;
        page?: number;
        limit?: number;
    }): Promise<any> {
        try {
            const response = await reporteApi.getLogAuditoria(params);
            return response.data?.data || { logs: [], pagination: defaults.pagination };
        } catch (error) {
            console.error('[ReporteService] Error getLogAuditoria:', error);
            return { logs: [], pagination: defaults.pagination };
        }
    },

    async exportarCSV(tipo: 'manifiestos' | 'generadores' | 'transportistas' | 'operadores', params?: {
        fechaInicio?: string;
        fechaFin?: string;
    }): Promise<void> {
        try {
            const blob = await reporteApi.fetchCSVExport(tipo, params);
            downloadBlob(blob, generateFilename(tipo, 'csv'));
        } catch (error) {
            console.error('[ReporteService] Error exportarCSV:', error);
            throw error;
        }
    }
};

// ===== GESTIÓN DE ACTORES =====
export const actorService = {
    // Generadores
    async getGeneradores(params?: { search?: string; activo?: boolean; page?: number; limit?: number }): Promise<{ generadores: Generador[]; pagination: any }> {
        try {
            const response = await actorApi.getGeneradores(params);
            return response.data?.data || { generadores: [], pagination: defaults.pagination };
        } catch (error) {
            console.error('[ActorService] Error getGeneradores:', error);
            return { generadores: [], pagination: defaults.pagination };
        }
    },

    async createGenerador(data: Omit<Generador, 'id' | 'activo' | '_count'>): Promise<{ generador: Generador; message: string }> {
        try {
            const response = await actorApi.createGenerador(data);
            return { generador: response.data?.data?.generador, message: (response.data as any).message || 'Generador creado' };
        } catch (error) {
            console.error('[ActorService] Error createGenerador:', error);
            throw error;
        }
    },

    async updateGenerador(id: string, data: Partial<Generador>): Promise<Generador> {
        try {
            const response = await actorApi.updateGenerador(id, data);
            return response.data?.data?.generador;
        } catch (error) {
            console.error('[ActorService] Error updateGenerador:', error);
            throw error;
        }
    },

    async deleteGenerador(id: string): Promise<void> {
        try {
            await actorApi.deleteGenerador(id);
        } catch (error) {
            console.error('[ActorService] Error deleteGenerador:', error);
            throw error;
        }
    },

    // Transportistas
    async getTransportistas(params?: { search?: string; activo?: boolean; page?: number; limit?: number }): Promise<{ transportistas: Transportista[]; pagination: any }> {
        try {
            const response = await actorApi.getTransportistas(params);
            return response.data?.data || { transportistas: [], pagination: defaults.pagination };
        } catch (error) {
            console.error('[ActorService] Error getTransportistas:', error);
            return { transportistas: [], pagination: defaults.pagination };
        }
    },

    async createTransportista(data: any): Promise<{ transportista: Transportista; message: string }> {
        try {
            const response = await actorApi.createTransportista(data);
            return { transportista: response.data?.data?.transportista, message: (response.data as any).message || 'Transportista creado' };
        } catch (error) {
            console.error('[ActorService] Error createTransportista:', error);
            throw error;
        }
    },

    async updateTransportista(id: string, data: Partial<Transportista>): Promise<Transportista> {
        try {
            const response = await actorApi.updateTransportista(id, data);
            return response.data?.data?.transportista;
        } catch (error) {
            console.error('[ActorService] Error updateTransportista:', error);
            throw error;
        }
    },

    async addVehiculo(transportistaId: string, data: any): Promise<any> {
        try {
            const response = await actorApi.addVehiculo(transportistaId, data);
            return response.data?.data?.vehiculo;
        } catch (error) {
            console.error('[ActorService] Error addVehiculo:', error);
            throw error;
        }
    },

    async addChofer(transportistaId: string, data: any): Promise<any> {
        try {
            const response = await actorApi.addChofer(transportistaId, data);
            return response.data?.data?.chofer;
        } catch (error) {
            console.error('[ActorService] Error addChofer:', error);
            throw error;
        }
    },

    // Operadores
    async getOperadores(params?: { search?: string; activo?: boolean; page?: number; limit?: number }): Promise<{ operadores: Operador[]; pagination: any }> {
        try {
            const response = await actorApi.getOperadores(params);
            return response.data?.data || { operadores: [], pagination: defaults.pagination };
        } catch (error) {
            console.error('[ActorService] Error getOperadores:', error);
            return { operadores: [], pagination: defaults.pagination };
        }
    },

    async createOperador(data: any): Promise<{ operador: Operador; message: string }> {
        try {
            const response = await actorApi.createOperador(data);
            return { operador: response.data?.data?.operador, message: (response.data as any).message || 'Operador creado' };
        } catch (error) {
            console.error('[ActorService] Error createOperador:', error);
            throw error;
        }
    },

    async updateOperador(id: string, data: Partial<Operador>): Promise<Operador> {
        try {
            const response = await actorApi.updateOperador(id, data);
            return response.data?.data?.operador;
        } catch (error) {
            console.error('[ActorService] Error updateOperador:', error);
            throw error;
        }
    },

    async deleteOperador(id: string): Promise<void> {
        try {
            await actorApi.deleteOperador(id);
        } catch (error) {
            console.error('[ActorService] Error deleteOperador:', error);
            throw error;
        }
    }
};

// ===== GESTIÓN DE USUARIOS =====
export const usuarioService = {
    async getUsuarios(params?: {
        page?: number;
        limit?: number;
        rol?: string;
        activo?: boolean | string;
        busqueda?: string;
    }): Promise<UsuariosResponse> {
        try {
            const response = await usuarioApi.getUsuarios(params);
            return transformUsuariosResponse(response.data?.data);
        } catch (error) {
            console.error('[UsuarioService] Error getUsuarios:', error);
            return transformUsuariosResponse(null);
        }
    },

    async getUsuariosPendientes(): Promise<{ usuarios: Usuario[]; total: number }> {
        try {
            const response = await usuarioApi.getUsuariosPendientes();
            return response.data?.data || { usuarios: [], total: 0 };
        } catch (error) {
            console.error('[UsuarioService] Error getUsuariosPendientes:', error);
            return { usuarios: [], total: 0 };
        }
    },

    async getUsuario(id: string): Promise<{ usuario: Usuario | null; actividadReciente: any[] }> {
        try {
            const response = await usuarioApi.getUsuario(id);
            return response.data?.data || { usuario: null, actividadReciente: [] };
        } catch (error) {
            console.error('[UsuarioService] Error getUsuario:', error);
            return { usuario: null, actividadReciente: [] };
        }
    },

    async updateUsuario(id: string, data: Partial<Usuario>): Promise<Usuario | null> {
        try {
            const response = await usuarioApi.updateUsuario(id, data);
            return response.data?.data?.usuario || null;
        } catch (error) {
            console.error('[UsuarioService] Error updateUsuario:', error);
            throw error;
        }
    },

    async aprobarUsuario(id: string): Promise<Usuario | null> {
        try {
            const response = await usuarioApi.aprobarUsuario(id);
            return response.data?.data?.usuario || null;
        } catch (error) {
            console.error('[UsuarioService] Error aprobarUsuario:', error);
            throw error;
        }
    },

    async rechazarUsuario(id: string, motivo?: string): Promise<void> {
        try {
            await usuarioApi.rechazarUsuario(id, motivo);
        } catch (error) {
            console.error('[UsuarioService] Error rechazarUsuario:', error);
            throw error;
        }
    },

    async getActividad(params?: {
        page?: number;
        limit?: number;
        tipo?: string;
        desde?: string;
        hasta?: string;
    }): Promise<ActividadResponse> {
        try {
            const response = await usuarioApi.getActividad(params);
            return transformActividadResponse(response.data?.data);
        } catch (error) {
            console.error('[UsuarioService] Error getActividad:', error);
            return transformActividadResponse(null);
        }
    },

    async getEstadisticas(): Promise<{
        usuarios: { total: number; activos: number; pendientes: number; porRol: Record<string, number> };
        manifiestos: { total: number; porEstado: Record<string, number> };
    }> {
        try {
            const response = await usuarioApi.getEstadisticas();
            return response.data?.data || {
                usuarios: { total: 0, activos: 0, pendientes: 0, porRol: {} },
                manifiestos: { total: 0, porEstado: {} }
            };
        } catch (error) {
            console.error('[UsuarioService] Error getEstadisticas:', error);
            return {
                usuarios: { total: 0, activos: 0, pendientes: 0, porRol: {} },
                manifiestos: { total: 0, porEstado: {} }
            };
        }
    },

    async getEstadisticasDepartamento() {
        try {
            const response = await usuarioApi.getEstadisticasDepartamento();
            return transformEstadisticasDepartamento(response.data?.data);
        } catch (error) {
            console.error('[UsuarioService] Error getEstadisticasDepartamento:', error);
            return transformEstadisticasDepartamento(null);
        }
    },

    async getEstadisticasHistoricas(params?: {
        desde?: string;
        hasta?: string;
        agrupacion?: 'dia' | 'semana' | 'mes';
    }) {
        try {
            const response = await usuarioApi.getEstadisticasHistoricas(params);
            return transformEstadisticasHistoricas(response.data?.data);
        } catch (error) {
            console.error('[UsuarioService] Error getEstadisticasHistoricas:', error);
            return transformEstadisticasHistoricas(null);
        }
    }
};

// ===== System Configuration =====
export const configService = {
    async getConfig(): Promise<SystemConfig> {
        try {
            const response = await configApi.getConfig();
            return transformSystemConfig(response.data?.data);
        } catch (error) {
            console.error('[ConfigService] Error getConfig:', error);
            return transformSystemConfig(null);
        }
    },

    async updateConfig(updates: Partial<SystemConfig>): Promise<SystemConfig> {
        try {
            const response = await configApi.updateConfig(updates);
            const config = response.data?.data?.config;
            if (config) {
                localStorage.setItem('sitrep_parametros', JSON.stringify(config));
            }
            return config || this.getDefaults();
        } catch (error) {
            console.error('[ConfigService] Error updateConfig:', error);
            // Fallback: save to localStorage only
            const current = await this.getConfig();
            const updated = { ...current, ...updates };
            localStorage.setItem('sitrep_parametros', JSON.stringify(updated));
            return updated;
        }
    },

    async resetConfig(): Promise<SystemConfig> {
        try {
            const response = await configApi.resetConfig();
            localStorage.removeItem('sitrep_parametros');
            return response.data?.data?.config || this.getDefaults();
        } catch (error) {
            console.error('[ConfigService] Error resetConfig:', error);
            localStorage.removeItem('sitrep_parametros');
            return this.getDefaults();
        }
    },

    getDefaults(): SystemConfig {
        return defaults.systemConfig();
    },

    async getToleranciaPeso(): Promise<number> {
        try {
            const response = await configApi.getToleranciaPeso();
            return response.data?.data?.toleranciaPeso || 5;
        } catch {
            return 5;
        }
    }
};

// ===== CRON Service =====
export const cronService = {
    async getStatus(): Promise<{ tasks: CronTask[] }> {
        try {
            const response = await cronApi.getStatus();
            return response.data?.data || { tasks: [] };
        } catch (error) {
            console.error('[CronService] Error getStatus:', error);
            return { tasks: [] };
        }
    },

    async runTask(taskName: string): Promise<{ success: boolean; message: string }> {
        try {
            const response = await cronApi.runTask(taskName);
            return { success: true, message: response.data?.message || 'Tarea ejecutada' };
        } catch (error: any) {
            console.error('[CronService] Error runTask:', error);
            return { success: false, message: error.response?.data?.error || 'Error al ejecutar tarea' };
        }
    },

    async runBackup(tipo: 'daily' | 'weekly' = 'daily'): Promise<{ success: boolean; message: string }> {
        try {
            const response = await cronApi.runBackup(tipo);
            return { success: true, message: response.data?.message || 'Backup ejecutado' };
        } catch (error: any) {
            console.error('[CronService] Error runBackup:', error);
            return { success: false, message: error.response?.data?.error || 'Error al ejecutar backup' };
        }
    }
};
