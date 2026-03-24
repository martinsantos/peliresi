import api from './api';
import type { Renovacion, RenovacionFilters, CreateRenovacionRequest, PaginatedData } from '../types/api';

export const renovacionService = {
  async list(filters?: RenovacionFilters): Promise<PaginatedData<Renovacion>> {
    const { data } = await api.get('/renovaciones', { params: filters });
    const raw = data.data;
    return {
      items: raw.renovaciones || [],
      total: raw.pagination?.total || 0,
      page: raw.pagination?.page || 1,
      limit: raw.pagination?.limit || 20,
      totalPages: raw.pagination?.pages || 1,
    };
  },

  async getById(id: string): Promise<Renovacion> {
    const { data } = await api.get(`/renovaciones/${id}`);
    return data.data.renovacion;
  },

  async create(req: CreateRenovacionRequest): Promise<Renovacion> {
    const { data } = await api.post('/renovaciones', req);
    return data.data.renovacion;
  },

  async aprobar(id: string, observaciones?: string): Promise<Renovacion> {
    const { data } = await api.post(`/renovaciones/${id}/aprobar`, { observaciones });
    return data.data.renovacion;
  },

  async rechazar(id: string, motivoRechazo: string, observaciones?: string): Promise<Renovacion> {
    const { data } = await api.post(`/renovaciones/${id}/rechazar`, { motivoRechazo, observaciones });
    return data.data.renovacion;
  },
};
