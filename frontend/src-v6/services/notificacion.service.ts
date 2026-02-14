/**
 * SITREP v6 - Notificacion Service
 */

import api from './api';
import type { Notificacion } from '../types/models';
import type { NotificacionFilters, PaginatedData } from '../types/api';

export const notificacionService = {
  async list(filters?: NotificacionFilters): Promise<PaginatedData<Notificacion>> {
    const { data } = await api.get('/notificaciones', { params: filters });
    const raw = data.data;
    return {
      items: raw.notificaciones || [],
      total: raw.notificaciones?.length || 0,
      page: 1,
      limit: 100,
      totalPages: 1,
    };
  },

  async marcarLeida(id: string): Promise<void> {
    await api.put(`/notificaciones/${id}/leida`);
  },

  async marcarTodasLeidas(): Promise<void> {
    await api.put('/notificaciones/todas-leidas');
  },

  async getNoLeidas(): Promise<number> {
    try {
      const { data } = await api.get('/notificaciones');
      return data.data?.noLeidas || 0;
    } catch {
      return 0;
    }
  },
};
