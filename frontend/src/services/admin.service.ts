import api from './api';
import type { ApiResponse } from '../types';
import { defaults } from '../utils/safeResponse';

// ===== PDFs =====
export const pdfService = {
    getManifiestoPDFUrl(id: string): string {
        return `${api.defaults.baseURL}/manifiestos/${id}/pdf`;
    },

    getCertificadoPDFUrl(id: string): string {
        return `${api.defaults.baseURL}/manifiestos/${id}/certificado`;
    },

    async descargarManifiestoPDF(id: string): Promise<void> {
        const token = localStorage.getItem('accessToken');
        const baseURL = api.defaults.baseURL || '/api';

        try {
            const response = await fetch(`${baseURL}/manifiestos/${id}/pdf`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[PDFService] Error descargando PDF:', response.status, errorText);
                throw new Error(`Error al descargar PDF: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/pdf')) {
                console.warn('[PDFService] Respuesta no es PDF, tipo:', contentType);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `manifiesto_${id}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('[PDFService] Error en descargarManifiestoPDF:', error);
            throw error;
        }
    },

    async descargarCertificadoPDF(id: string): Promise<void> {
        const token = localStorage.getItem('accessToken');
        const baseURL = api.defaults.baseURL || '/api';

        try {
            const response = await fetch(`${baseURL}/manifiestos/${id}/certificado`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[PDFService] Error descargando certificado:', response.status, errorText);
                throw new Error(`Error al descargar certificado: ${response.status}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `certificado_${id}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
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
            const response = await api.get<ApiResponse<any>>('/reportes/manifiestos', { params });
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
            const response = await api.get<ApiResponse<any>>('/reportes/tratados', { params });
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
            const response = await api.get<ApiResponse<any>>('/reportes/transporte', { params });
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
            const response = await api.get<ApiResponse<any>>('/reportes/auditoria', { params });
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
            const token = localStorage.getItem('accessToken');
            const queryString = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
            const response = await fetch(`${api.defaults.baseURL}/reportes/exportar/${tipo}?${queryString}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Error al exportar');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${tipo}_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('[ReporteService] Error exportarCSV:', error);
            throw error;
        }
    }
};

// ===== GESTIÓN DE ACTORES =====
export interface Actor {
    id: string;
    razonSocial: string;
    cuit: string;
    domicilio: string;
    telefono: string;
    email: string;
    activo: boolean;
    _count?: { manifiestos: number };
}

export interface Generador extends Actor {
    numeroInscripcion: string;
    categoria: string;
}

export interface Transportista extends Actor {
    numeroHabilitacion: string;
    vehiculos?: any[];
    choferes?: any[];
}

export interface Operador extends Actor {
    numeroHabilitacion: string;
    categoria: string;
    tratamientos?: any[];
}

export const actorService = {
    // Generadores
    async getGeneradores(params?: { search?: string; activo?: boolean; page?: number; limit?: number }): Promise<{ generadores: Generador[]; pagination: any }> {
        try {
            const response = await api.get<ApiResponse<{ generadores: Generador[]; pagination: any }>>('/actores/generadores', { params });
            return response.data?.data || { generadores: [], pagination: defaults.pagination };
        } catch (error) {
            console.error('[ActorService] Error getGeneradores:', error);
            return { generadores: [], pagination: defaults.pagination };
        }
    },

    async createGenerador(data: Omit<Generador, 'id' | 'activo' | '_count'>): Promise<{ generador: Generador; message: string }> {
        try {
            const response = await api.post<ApiResponse<{ generador: Generador; message?: string }>>('/actores/generadores', data);
            return { generador: response.data?.data?.generador, message: (response.data as any).message || 'Generador creado' };
        } catch (error) {
            console.error('[ActorService] Error createGenerador:', error);
            throw error;
        }
    },

    async updateGenerador(id: string, data: Partial<Generador>): Promise<Generador> {
        try {
            const response = await api.put<ApiResponse<{ generador: Generador }>>(`/actores/generadores/${id}`, data);
            return response.data?.data?.generador;
        } catch (error) {
            console.error('[ActorService] Error updateGenerador:', error);
            throw error;
        }
    },

    async deleteGenerador(id: string): Promise<void> {
        try {
            await api.delete(`/actores/generadores/${id}`);
        } catch (error) {
            console.error('[ActorService] Error deleteGenerador:', error);
            throw error;
        }
    },

    // Transportistas
    async getTransportistas(params?: { search?: string; activo?: boolean; page?: number; limit?: number }): Promise<{ transportistas: Transportista[]; pagination: any }> {
        try {
            const response = await api.get<ApiResponse<{ transportistas: Transportista[]; pagination: any }>>('/actores/transportistas', { params });
            return response.data?.data || { transportistas: [], pagination: defaults.pagination };
        } catch (error) {
            console.error('[ActorService] Error getTransportistas:', error);
            return { transportistas: [], pagination: defaults.pagination };
        }
    },

    async createTransportista(data: any): Promise<{ transportista: Transportista; message: string }> {
        try {
            const response = await api.post<ApiResponse<{ transportista: Transportista }>>('/actores/transportistas', data);
            return { transportista: response.data?.data?.transportista, message: (response.data as any).message || 'Transportista creado' };
        } catch (error) {
            console.error('[ActorService] Error createTransportista:', error);
            throw error;
        }
    },

    async updateTransportista(id: string, data: Partial<Transportista>): Promise<Transportista> {
        try {
            const response = await api.put<ApiResponse<{ transportista: Transportista }>>(`/actores/transportistas/${id}`, data);
            return response.data?.data?.transportista;
        } catch (error) {
            console.error('[ActorService] Error updateTransportista:', error);
            throw error;
        }
    },

    async addVehiculo(transportistaId: string, data: any): Promise<any> {
        try {
            const response = await api.post<ApiResponse<{ vehiculo: any }>>(`/actores/transportistas/${transportistaId}/vehiculos`, data);
            return response.data?.data?.vehiculo;
        } catch (error) {
            console.error('[ActorService] Error addVehiculo:', error);
            throw error;
        }
    },

    async addChofer(transportistaId: string, data: any): Promise<any> {
        try {
            const response = await api.post<ApiResponse<{ chofer: any }>>(`/actores/transportistas/${transportistaId}/choferes`, data);
            return response.data?.data?.chofer;
        } catch (error) {
            console.error('[ActorService] Error addChofer:', error);
            throw error;
        }
    },

    // Operadores
    async getOperadores(params?: { search?: string; activo?: boolean; page?: number; limit?: number }): Promise<{ operadores: Operador[]; pagination: any }> {
        try {
            const response = await api.get<ApiResponse<{ operadores: Operador[]; pagination: any }>>('/actores/operadores', { params });
            return response.data?.data || { operadores: [], pagination: defaults.pagination };
        } catch (error) {
            console.error('[ActorService] Error getOperadores:', error);
            return { operadores: [], pagination: defaults.pagination };
        }
    },

    async createOperador(data: any): Promise<{ operador: Operador; message: string }> {
        try {
            const response = await api.post<ApiResponse<{ operador: Operador }>>('/actores/operadores', data);
            return { operador: response.data?.data?.operador, message: (response.data as any).message || 'Operador creado' };
        } catch (error) {
            console.error('[ActorService] Error createOperador:', error);
            throw error;
        }
    },

    async updateOperador(id: string, data: Partial<Operador>): Promise<Operador> {
        try {
            const response = await api.put<ApiResponse<{ operador: Operador }>>(`/actores/operadores/${id}`, data);
            return response.data?.data?.operador;
        } catch (error) {
            console.error('[ActorService] Error updateOperador:', error);
            throw error;
        }
    },

    async deleteOperador(id: string): Promise<void> {
        try {
            await api.delete(`/actores/operadores/${id}`);
        } catch (error) {
            console.error('[ActorService] Error deleteOperador:', error);
            throw error;
        }
    }
};

// ===== GESTIÓN DE USUARIOS =====
export interface Usuario {
    id: string;
    email: string;
    rol: string;
    nombre: string;
    apellido: string;
    empresa?: string;
    telefono?: string;
    activo: boolean;
    createdAt: string;
    updatedAt?: string;
    generador?: { id: string; razonSocial: string };
    transportista?: { id: string; razonSocial: string };
    operador?: { id: string; razonSocial: string };
}

export interface UsuariosResponse {
    usuarios: Usuario[];
    stats: {
        total: number;
        activos: number;
        inactivos: number;
        porRol: Record<string, number>;
    };
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface Actividad {
    id: string;
    tipo: 'MANIFIESTO' | 'SISTEMA';
    accion: string;
    descripcion: string;
    fecha: string;
    usuario: { nombre: string; apellido: string; rol: string } | null;
    manifiesto: { numero: string; estado: string } | null;
    metadata?: any;
}

export interface ActividadResponse {
    actividades: Actividad[];
    stats: {
        eventosHoy: number;
        manifestosActivos: number;
        usuariosActivos: number;
    };
    pagination: {
        page: number;
        limit: number;
    };
}

export const usuarioService = {
    /**
     * Obtener todos los usuarios con estadísticas
     */
    async getUsuarios(params?: {
        page?: number;
        limit?: number;
        rol?: string;
        activo?: boolean | string;
        busqueda?: string;
    }): Promise<UsuariosResponse> {
        try {
            const response = await api.get<ApiResponse<UsuariosResponse>>('/admin/usuarios', { params });
            return response.data?.data || { usuarios: [], stats: defaults.emptyStats, pagination: defaults.pagination };
        } catch (error) {
            console.error('[UsuarioService] Error getUsuarios:', error);
            return { usuarios: [], stats: defaults.emptyStats, pagination: defaults.pagination };
        }
    },

    /**
     * Obtener usuarios pendientes de aprobación
     */
    async getUsuariosPendientes(): Promise<{ usuarios: Usuario[]; total: number }> {
        try {
            const response = await api.get<ApiResponse<{ usuarios: Usuario[]; total: number }>>('/admin/usuarios/pendientes');
            return response.data?.data || { usuarios: [], total: 0 };
        } catch (error) {
            console.error('[UsuarioService] Error getUsuariosPendientes:', error);
            return { usuarios: [], total: 0 };
        }
    },

    /**
     * Obtener detalle de un usuario
     */
    async getUsuario(id: string): Promise<{ usuario: Usuario | null; actividadReciente: any[] }> {
        try {
            const response = await api.get<ApiResponse<{ usuario: Usuario; actividadReciente: any[] }>>(`/admin/usuarios/${id}`);
            return response.data?.data || { usuario: null, actividadReciente: [] };
        } catch (error) {
            console.error('[UsuarioService] Error getUsuario:', error);
            return { usuario: null, actividadReciente: [] };
        }
    },

    /**
     * Actualizar usuario
     */
    async updateUsuario(id: string, data: Partial<Usuario>): Promise<Usuario | null> {
        try {
            const response = await api.put<ApiResponse<{ usuario: Usuario }>>(`/admin/usuarios/${id}`, data);
            return response.data?.data?.usuario || null;
        } catch (error) {
            console.error('[UsuarioService] Error updateUsuario:', error);
            throw error;
        }
    },

    /**
     * Aprobar usuario pendiente
     */
    async aprobarUsuario(id: string): Promise<Usuario | null> {
        try {
            const response = await api.post<ApiResponse<{ usuario: Usuario }>>(`/admin/usuarios/${id}/aprobar`);
            return response.data?.data?.usuario || null;
        } catch (error) {
            console.error('[UsuarioService] Error aprobarUsuario:', error);
            throw error;
        }
    },

    /**
     * Rechazar usuario pendiente
     */
    async rechazarUsuario(id: string, motivo?: string): Promise<void> {
        try {
            await api.post(`/admin/usuarios/${id}/rechazar`, { motivo });
        } catch (error) {
            console.error('[UsuarioService] Error rechazarUsuario:', error);
            throw error;
        }
    },

    /**
     * Obtener actividad global del sistema
     */
    async getActividad(params?: {
        page?: number;
        limit?: number;
        tipo?: string;
        desde?: string;
        hasta?: string;
    }): Promise<ActividadResponse> {
        try {
            const response = await api.get<ApiResponse<ActividadResponse>>('/admin/actividad', { params });
            return response.data?.data || { actividades: [], stats: { eventosHoy: 0, manifestosActivos: 0, usuariosActivos: 0 }, pagination: defaults.pagination };
        } catch (error) {
            console.error('[UsuarioService] Error getActividad:', error);
            return { actividades: [], stats: { eventosHoy: 0, manifestosActivos: 0, usuariosActivos: 0 }, pagination: defaults.pagination };
        }
    },

    /**
     * Obtener estadísticas generales
     */
    async getEstadisticas(): Promise<{
        usuarios: { total: number; activos: number; pendientes: number; porRol: Record<string, number> };
        manifiestos: { total: number; porEstado: Record<string, number> };
    }> {
        try {
            const response = await api.get<ApiResponse<{
                usuarios: { total: number; activos: number; pendientes: number; porRol: Record<string, number> };
                manifiestos: { total: number; porEstado: Record<string, number> };
            }>>('/admin/estadisticas');
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

    /**
     * Obtener estadísticas por departamento de Mendoza
     */
    async getEstadisticasDepartamento(): Promise<{
        departamentos: Array<{
            nombre: string;
            manifiestos: { total: number; enTransito: number; entregados: number; tratados: number };
            residuosTratados: number;
            enProceso: number;
            ultimaActividad: string | null;
        }>;
        totales: {
            manifiestos: number;
            residuosTratados: number;
            departamentosActivos: number;
        };
    }> {
        try {
            const response = await api.get<ApiResponse<any>>('/admin/estadisticas-departamento');
            return response.data?.data || {
                departamentos: [],
                totales: { manifiestos: 0, residuosTratados: 0, departamentosActivos: 0 }
            };
        } catch (error) {
            console.error('[UsuarioService] Error getEstadisticasDepartamento:', error);
            return {
                departamentos: [],
                totales: { manifiestos: 0, residuosTratados: 0, departamentosActivos: 0 }
            };
        }
    },

    /**
     * Obtener estadísticas históricas con filtros de tiempo
     */
    async getEstadisticasHistoricas(params?: {
        desde?: string;
        hasta?: string;
        agrupacion?: 'dia' | 'semana' | 'mes';
    }): Promise<{
        periodo: { desde: string; hasta: string };
        agrupacion: string;
        datos: Array<{
            fecha: string;
            manifiestos: number;
            residuos: number;
            alertas: number;
        }>;
        totales: {
            manifiestos: number;
            residuos: number;
            alertas: number;
        };
        tendencia: {
            manifiestos: number;
            residuos: number;
        };
    }> {
        try {
            const response = await api.get<ApiResponse<any>>('/admin/estadisticas-historicas', { params });
            return response.data?.data || {
                periodo: { desde: '', hasta: '' },
                agrupacion: 'dia',
                datos: [],
                totales: { manifiestos: 0, residuos: 0, alertas: 0 },
                tendencia: { manifiestos: 0, residuos: 0 }
            };
        } catch (error) {
            console.error('[UsuarioService] Error getEstadisticasHistoricas:', error);
            return {
                periodo: { desde: '', hasta: '' },
                agrupacion: 'dia',
                datos: [],
                totales: { manifiestos: 0, residuos: 0, alertas: 0 },
                tendencia: { manifiestos: 0, residuos: 0 }
            };
        }
    }
};

// ===== System Configuration =====
export interface SystemConfig {
    vencimientoManifiestos: number;
    alertaDesvioGPS: number;
    tiempoMaxTransito: number;
    emailNotificaciones: string;
    toleranciaPeso: number;
    tiempoSesion: number;
    notificacionesPush: boolean;
    notificacionesEmail: boolean;
    notificacionesSMS: boolean;
    backupAutomatico: boolean;
    frecuenciaBackup: number;
    retencionLogs: number;
    maxArchivoCarga: number;
    maxManifiestosPorPagina: number;
    alertaTiempoExcesivo: boolean;
    alertaVencimientoProximo: boolean;
    diasAlertaVencimiento: number;
}

export const configService = {
    /**
     * Obtener configuración del sistema
     */
    async getConfig(): Promise<SystemConfig> {
        try {
            const response = await api.get<ApiResponse<{ config: SystemConfig }>>('/config');
            return response.data?.data?.config || this.getDefaults();
        } catch (error) {
            console.error('[ConfigService] Error getConfig:', error);
            // Fallback to localStorage for offline/demo mode
            const saved = localStorage.getItem('sitrep_parametros');
            if (saved) {
                try {
                    return { ...this.getDefaults(), ...JSON.parse(saved) };
                } catch {
                    // ignore
                }
            }
            return this.getDefaults();
        }
    },

    /**
     * Actualizar configuración del sistema
     */
    async updateConfig(updates: Partial<SystemConfig>): Promise<SystemConfig> {
        try {
            const response = await api.put<ApiResponse<{ config: SystemConfig }>>('/config', updates);
            // Also save to localStorage for offline access
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

    /**
     * Resetear configuración a valores por defecto
     */
    async resetConfig(): Promise<SystemConfig> {
        try {
            const response = await api.post<ApiResponse<{ config: SystemConfig }>>('/config/reset');
            localStorage.removeItem('sitrep_parametros');
            return response.data?.data?.config || this.getDefaults();
        } catch (error) {
            console.error('[ConfigService] Error resetConfig:', error);
            localStorage.removeItem('sitrep_parametros');
            return this.getDefaults();
        }
    },

    /**
     * Obtener valores por defecto
     */
    getDefaults(): SystemConfig {
        return {
            vencimientoManifiestos: 30,
            alertaDesvioGPS: 5,
            tiempoMaxTransito: 48,
            emailNotificaciones: 'alertas@dgfa.mendoza.gov.ar',
            toleranciaPeso: 5,
            tiempoSesion: 60,
            notificacionesPush: true,
            notificacionesEmail: true,
            notificacionesSMS: false,
            backupAutomatico: true,
            frecuenciaBackup: 24,
            retencionLogs: 90,
            maxArchivoCarga: 10,
            maxManifiestosPorPagina: 50,
            alertaTiempoExcesivo: true,
            alertaVencimientoProximo: true,
            diasAlertaVencimiento: 7,
        };
    },

    /**
     * Obtener tolerancia de peso (para usar en PesajeModal)
     */
    async getToleranciaPeso(): Promise<number> {
        try {
            const response = await api.get<ApiResponse<{ toleranciaPeso: number }>>('/config/public/tolerancia-peso');
            return response.data?.data?.toleranciaPeso || 5;
        } catch {
            return 5;
        }
    }
};

// ===== CRON Service =====
export interface CronTask {
    name: string;
    schedule: string;
    description: string;
}

export const cronService = {
    /**
     * Obtener estado de tareas programadas
     */
    async getStatus(): Promise<{ tasks: CronTask[] }> {
        try {
            const response = await api.get<ApiResponse<{ tasks: CronTask[] }>>('/cron/status');
            return response.data?.data || { tasks: [] };
        } catch (error) {
            console.error('[CronService] Error getStatus:', error);
            return { tasks: [] };
        }
    },

    /**
     * Ejecutar tarea manualmente
     */
    async runTask(taskName: string): Promise<{ success: boolean; message: string }> {
        try {
            const response = await api.post<ApiResponse<{ success: boolean; message: string }>>(`/cron/run/${taskName}`);
            return { success: true, message: response.data?.message || 'Tarea ejecutada' };
        } catch (error: any) {
            console.error('[CronService] Error runTask:', error);
            return { success: false, message: error.response?.data?.error || 'Error al ejecutar tarea' };
        }
    },

    /**
     * Ejecutar backup manual
     */
    async runBackup(tipo: 'daily' | 'weekly' = 'daily'): Promise<{ success: boolean; message: string }> {
        try {
            const response = await api.post<ApiResponse<{ success: boolean; message: string }>>('/cron/backup', { tipo });
            return { success: true, message: response.data?.message || 'Backup ejecutado' };
        } catch (error: any) {
            console.error('[CronService] Error runBackup:', error);
            return { success: false, message: error.response?.data?.error || 'Error al ejecutar backup' };
        }
    }
};
