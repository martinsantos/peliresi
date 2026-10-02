/**
 * SITREP v6 - Notificacion Service
 */

import api from './api';
import type { Notificacion } from '../types/models';
import type { NotificacionFilters, PaginatedData } from '../types/api';

export const notificacionService = {
  async list(filters?: NotificacionFilters): Promise<PaginatedData<Notificacion> & { noLeidas: number }> {
    const { page = 1, limit = 20, ...rest } = filters ?? {};
    const { data } = await api.get('/notificaciones', { params: { ...rest, limit, offset: (page - 1) * limit } });
    const raw = data.data;
    const noLeidas = raw.noLeidas ?? 0;
    return {
      items: raw.notificaciones || [],
      total: raw.total ?? raw.notificaciones?.length ?? 0,
      noLeidas,
      page: raw.pagina ?? page,
      limit,
      totalPages: raw.totalPaginas ?? Math.ceil((raw.total ?? raw.notificaciones?.length ?? 0) / limit),
    };
  },

  async marcarLeida(id: string): Promise<void> {
    await api.put(`/notificaciones/${id}/leida`);
  },

  async marcarTodasLeidas(): Promise<void> {
    await api.put('/notificaciones/todas-leidas');
  },

  async eliminar(id: string): Promise<void> {
    await api.delete(`/notificaciones/${id}`);
  },

  async getNoLeidas(): Promise<number> {
    const { data } = await api.get('/notificaciones', { params: { limit: 1 } });
    return data.data?.noLeidas ?? 0;
  },
};
