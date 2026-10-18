/**
 * SITREP v6 - Alerta Service
 */

import api from './api';
import type { ReglaAlerta, AlertaGenerada, AnomaliaTransporte } from '../types/models';
import type { CreateReglaAlertaRequest, AlertaFilters, PaginatedData } from '../types/api';
import type { EstadoAlerta } from '../types/models';

export interface FollowupPreview {
  total: number;
  ejemplos: Array<{ id: string; numero: string; estado: string; fechaRecepcion: string | null }>;
  evaluadoAt: string;
  escribeDatos: false;
  canal: 'interno';
}
export interface CataloguePreview extends Omit<FollowupPreview, 'ejemplos'> {
  ejemplos: Array<{ id: string; numero: string; estado: string; entidad: string; vencimiento: string }>;
}

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

  async updateRegla(id: string, req: Partial<CreateReglaAlertaRequest & { activa: boolean }>): Promise<ReglaAlerta> {
    const { data } = await api.put(`/alertas/reglas/${id}`, req);
    return data.data;
  },

  async deleteRegla(id: string): Promise<void> {
    await api.delete(`/alertas/reglas/${id}`);
  },

  // Alertas generadas
  async listAlertas(filters?: AlertaFilters): Promise<PaginatedData<AlertaGenerada>> {
    const { data } = await api.get('/alertas', { params: filters });
    const raw = data.data;
    return {
      items: raw.alertas || [],
      total: raw.total || 0,
      page: raw.pagina || 1,
      limit: raw.limit || 50,
      totalPages: raw.totalPaginas || 1,
    };
  },

  async resolverAlerta(id: string, notas: string, estado: EstadoAlerta): Promise<AlertaGenerada> {
    const { data } = await api.put(`/alertas/${id}/resolver`, { notas, estado });
    return data.data;
  },

  async simularSeguimiento(diasRecepcion: number): Promise<FollowupPreview> {
    const { data } = await api.post('/alertas/seguimiento/simular', { diasRecepcion });
    return data.data;
  },

  async evaluarSeguimiento(): Promise<{ avisosActualizados: number; canal: 'interno' }> {
    const { data } = await api.post('/alertas/seguimiento/evaluar');
    return data.data;
  },

  async simularCatalogo(condicion: string): Promise<CataloguePreview> {
    const { data } = await api.post('/alertas/catalogo/simular', { condicion });
    return data.data;
  },

  async evaluarCatalogo(): Promise<{ avisosActualizados: number; canal: 'interno' }> {
    const { data } = await api.post('/alertas/catalogo/evaluar');
    return data.data;
  },

  // Anomalías
  async listAnomalias(manifiestoId?: string): Promise<AnomaliaTransporte[]> {
    const path = manifiestoId ? `/anomalias/${manifiestoId}` : '/anomalias';
    const { data } = await api.get(path);
    const raw = data.data || data;
    return Array.isArray(raw) ? raw : raw.anomalias || [];
  },
};
