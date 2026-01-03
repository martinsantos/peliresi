import api from './api';
import type { ApiResponse } from '../types';

// ===== PDFs =====
export const pdfService = {
    getManifiestoPDFUrl(id: string): string {
        return `${api.defaults.baseURL}/pdf/manifiesto/${id}`;
    },

    getCertificadoPDFUrl(id: string): string {
        return `${api.defaults.baseURL}/pdf/certificado/${id}`;
    },

    async descargarManifiestoPDF(id: string): Promise<void> {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`${api.defaults.baseURL}/pdf/manifiesto/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `manifiesto_${id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    },

    async descargarCertificadoPDF(id: string): Promise<void> {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`${api.defaults.baseURL}/pdf/certificado/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `certificado_${id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
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
        const response = await api.get<ApiResponse<any>>('/reportes/manifiestos', { params });
        return response.data.data;
    },

    async getReporteTratados(params?: {
        fechaInicio?: string;
        fechaFin?: string;
    }): Promise<any> {
        const response = await api.get<ApiResponse<any>>('/reportes/tratados', { params });
        return response.data.data;
    },

    async getReporteTransporte(params?: {
        fechaInicio?: string;
        fechaFin?: string;
    }): Promise<any> {
        const response = await api.get<ApiResponse<any>>('/reportes/transporte', { params });
        return response.data.data;
    },

    async getLogAuditoria(params?: {
        fechaInicio?: string;
        fechaFin?: string;
        tipo?: string;
        manifiestoId?: string;
        page?: number;
        limit?: number;
    }): Promise<any> {
        const response = await api.get<ApiResponse<any>>('/reportes/auditoria', { params });
        return response.data.data;
    },

    async exportarCSV(tipo: 'manifiestos' | 'generadores' | 'transportistas' | 'operadores', params?: {
        fechaInicio?: string;
        fechaFin?: string;
    }): Promise<void> {
        const token = localStorage.getItem('accessToken');
        const queryString = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
        const response = await fetch(`${api.defaults.baseURL}/reportes/exportar/${tipo}?${queryString}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${tipo}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
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
        const response = await api.get<ApiResponse<{ generadores: Generador[]; pagination: any }>>('/actores/generadores', { params });
        return response.data.data;
    },

    async createGenerador(data: Omit<Generador, 'id' | 'activo' | '_count'>): Promise<{ generador: Generador; message: string }> {
        const response = await api.post<ApiResponse<{ generador: Generador; message?: string }>>('/actores/generadores', data);
        return { generador: response.data.data.generador, message: (response.data as any).message || '' };
    },

    async updateGenerador(id: string, data: Partial<Generador>): Promise<Generador> {
        const response = await api.put<ApiResponse<{ generador: Generador }>>(`/actores/generadores/${id}`, data);
        return response.data.data.generador;
    },

    async deleteGenerador(id: string): Promise<void> {
        await api.delete(`/actores/generadores/${id}`);
    },

    // Transportistas
    async getTransportistas(params?: { search?: string; activo?: boolean; page?: number; limit?: number }): Promise<{ transportistas: Transportista[]; pagination: any }> {
        const response = await api.get<ApiResponse<{ transportistas: Transportista[]; pagination: any }>>('/actores/transportistas', { params });
        return response.data.data;
    },

    async createTransportista(data: any): Promise<{ transportista: Transportista; message: string }> {
        const response = await api.post<ApiResponse<{ transportista: Transportista }>>('/actores/transportistas', data);
        return { transportista: response.data.data.transportista, message: (response.data as any).message || '' };
    },

    async updateTransportista(id: string, data: Partial<Transportista>): Promise<Transportista> {
        const response = await api.put<ApiResponse<{ transportista: Transportista }>>(`/actores/transportistas/${id}`, data);
        return response.data.data.transportista;
    },

    async addVehiculo(transportistaId: string, data: any): Promise<any> {
        const response = await api.post<ApiResponse<{ vehiculo: any }>>(`/actores/transportistas/${transportistaId}/vehiculos`, data);
        return response.data.data.vehiculo;
    },

    async addChofer(transportistaId: string, data: any): Promise<any> {
        const response = await api.post<ApiResponse<{ chofer: any }>>(`/actores/transportistas/${transportistaId}/choferes`, data);
        return response.data.data.chofer;
    },

    // Operadores
    async getOperadores(params?: { search?: string; activo?: boolean; page?: number; limit?: number }): Promise<{ operadores: Operador[]; pagination: any }> {
        const response = await api.get<ApiResponse<{ operadores: Operador[]; pagination: any }>>('/actores/operadores', { params });
        return response.data.data;
    },

    async createOperador(data: any): Promise<{ operador: Operador; message: string }> {
        const response = await api.post<ApiResponse<{ operador: Operador }>>('/actores/operadores', data);
        return { operador: response.data.data.operador, message: (response.data as any).message || '' };
    },

    async updateOperador(id: string, data: Partial<Operador>): Promise<Operador> {
        const response = await api.put<ApiResponse<{ operador: Operador }>>(`/actores/operadores/${id}`, data);
        return response.data.data.operador;
    },

    async deleteOperador(id: string): Promise<void> {
        await api.delete(`/actores/operadores/${id}`);
    }
};
