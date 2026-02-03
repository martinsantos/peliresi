/**
 * SITREP v6 - Alerta Service
 */

import api from './api';
import type { ReglaAlerta, AlertaGenerada, AnomaliaTransporte } from '../types/models';
import type { CreateReglaAlertaRequest, AlertaFilters, PaginatedData } from '../types/api';

export const alertaService = {
  // Reglas
  async listReglas(): Promise<ReglaAlerta[]> {
    const { data } = await api.get('/alertas/reglas');
    const raw = data.data;
    return Array.isArray(raw) ? raw : raw.reglas || [];
  },

  async createRegla(req: CreateReglaAlertaRequest): Promise<ReglaAlerta> {
    const { data } = await api.post('/alertas/reglas', req);
    return data.data;
  },

  async toggleRegla(id: string, activa: boolean): Promise<ReglaAlerta> {
    const { data } = await api.put(`/alertas/reglas/${id}`, { activa });
    return data.data;
  },

  // Alertas generadas
  async listAlertas(filters?: AlertaFilters): Promise<PaginatedData<AlertaGenerada>> {
    const { data } = await api.get('/alertas', { params: filters });
    const raw = data.data;
    return {
      items: raw.alertas || [],
      total: raw.total || 0,
      page: raw.pagina || 1,
      limit: 10,
      totalPages: raw.totalPaginas || 1,
    };
  },

  async resolverAlerta(id: string, notas?: string): Promise<AlertaGenerada> {
    const { data } = await api.put(`/alertas/${id}/resolver`, { notas });
    return data.data;
  },

  // Anomalías
  async listAnomalias(manifiestoId?: string): Promise<AnomaliaTransporte[]> {
    const { data } = await api.get('/alertas/anomalias', { params: { manifiestoId } });
    const raw = data.data;
    return Array.isArray(raw) ? raw : raw.anomalias || [];
  },
};
