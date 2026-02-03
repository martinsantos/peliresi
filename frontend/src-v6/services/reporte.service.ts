/**
 * SITREP v6 - Reporte Service
 */

import api from './api';
import type { ReporteFilters, ExportFormat } from '../types/api';

export interface ReporteData {
  titulo: string;
  datos: Record<string, unknown>[];
  resumen: Record<string, number>;
}

export const reporteService = {
  async manifiestos(filters?: ReporteFilters): Promise<ReporteData> {
    const { data } = await api.get('/reportes/manifiestos', { params: filters });
    return data.data;
  },

  async tratados(filters?: ReporteFilters): Promise<ReporteData> {
    const { data } = await api.get('/reportes/tratados', { params: filters });
    return data.data;
  },

  async transporte(filters?: ReporteFilters): Promise<ReporteData> {
    const { data } = await api.get('/reportes/transporte', { params: filters });
    return data.data;
  },

  async auditoria(filters?: ReporteFilters): Promise<ReporteData> {
    const { data } = await api.get('/reportes/auditoria', { params: filters });
    return data.data;
  },

  async exportar(tipo: string, formato: ExportFormat, filters?: ReporteFilters): Promise<Blob> {
    const { data } = await api.get(`/reportes/exportar/${tipo}`, {
      params: { formato, ...filters },
      responseType: 'blob',
    });
    return data;
  },
};
