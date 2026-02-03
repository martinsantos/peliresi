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
    return data.data;
  },

  async createRegla(req: CreateReglaAlertaRequest): Promise<ReglaAlerta> {
    const { data } = await api.post('/alertas/reglas', req);
    return data.data;
  },

  async toggleRegla(id: string, activa: boolean): Promise<ReglaAlerta> {
    const { data } = await api.patch(`/alertas/reglas/${id}`, { activa });
    return data.data;
  },

  // Alertas generadas
  async listAlertas(filters?: AlertaFilters): Promise<PaginatedData<AlertaGenerada>> {
    const { data } = await api.get('/alertas', { params: filters });
    return data.data;
  },

  async resolverAlerta(id: string, notas?: string): Promise<AlertaGenerada> {
    const { data } = await api.patch(`/alertas/${id}/resolver`, { notas });
    return data.data;
  },

  async descartarAlerta(id: string, notas?: string): Promise<AlertaGenerada> {
    const { data } = await api.patch(`/alertas/${id}/descartar`, { notas });
    return data.data;
  },

  // Anomalías
  async listAnomalias(manifiestoId?: string): Promise<AnomaliaTransporte[]> {
    const { data } = await api.get('/alertas/anomalias', { params: { manifiestoId } });
    return data.data;
  },
};
