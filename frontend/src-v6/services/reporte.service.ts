/**
 * SITREP v6 - Reporte Service
 */

import api from './api';
import type { ReporteFilters, ExportFormat } from '../types/api';

export interface ReporteData {
  titulo: string;
  datos: Record<string, unknown>[];
  eventos?: Record<string, unknown>[];
  resumen: Record<string, unknown> & {
    total?: number;
    porTipo?: Record<string, number>;
  };
}

// Map frontend filter names to backend query param names
function mapFilters(filters?: ReporteFilters): Record<string, string | undefined> {
  if (!filters) return {};
  return {
    fechaInicio: filters.fechaDesde,
    fechaFin: filters.fechaHasta,
    generadorId: filters.generadorId,
    transportistaId: filters.transportistaId,
    operadorId: filters.operadorId,
    tipo: filters.tipo,
  };
}

export const reporteService = {
  async manifiestos(filters?: ReporteFilters): Promise<ReporteData> {
    const { data } = await api.get('/reportes/manifiestos', { params: mapFilters(filters) });
    return data.data;
  },

  async tratados(filters?: ReporteFilters): Promise<ReporteData> {
    const { data } = await api.get('/reportes/tratados', { params: mapFilters(filters) });
    return data.data;
  },

  async transporte(filters?: ReporteFilters): Promise<ReporteData> {
    const { data } = await api.get('/reportes/transporte', { params: mapFilters(filters) });
    return data.data;
  },

  async auditoria(filters?: ReporteFilters & { page?: number; limit?: number; accion?: string; usuarioId?: string; sortBy?: string; sortOrder?: string }): Promise<ReporteData> {
    const mapped = mapFilters(filters);
    const params: Record<string, string | number | undefined> = {
      ...mapped,
      page: filters?.page,
      limit: filters?.limit,
      accion: filters?.accion,
      usuarioId: filters?.usuarioId,
      sortBy: filters?.sortBy,
      sortOrder: filters?.sortOrder,
    };
    const { data } = await api.get('/reportes/auditoria', { params });
    return data.data;
  },

  async exportar(tipo: string, formato: ExportFormat, filters?: ReporteFilters): Promise<Blob> {
    const { data } = await api.get(`/reportes/exportar/${tipo}`, {
      params: { formato, ...mapFilters(filters) },
      responseType: 'blob',
    });
    return data;
  },
};
