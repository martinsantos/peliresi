/**
 * SITREP v6 - Notificacion Service
 */

import api from './api';
import type { Notificacion } from '../types/models';
import type { NotificacionFilters, PaginatedData } from '../types/api';

export const notificacionService = {
  async list(filters?: NotificacionFilters): Promise<PaginatedData<Notificacion>> {
    const { data } = await api.get('/notificaciones', { params: filters });
    return data.data;
  },

  async marcarLeida(id: string): Promise<void> {
    await api.patch(`/notificaciones/${id}/leida`);
  },

  async marcarTodasLeidas(): Promise<void> {
    await api.patch('/notificaciones/marcar-todas-leidas');
  },

  async getNoLeidas(): Promise<number> {
    const { data } = await api.get('/notificaciones/no-leidas/count');
    return data.data;
  },
};
