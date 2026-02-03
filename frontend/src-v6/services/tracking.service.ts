/**
 * SITREP v6 - Tracking Service
 */

import api from './api';
import type { TrackingGPS } from '../types/models';
import type { TrackingUpdateRequest } from '../types/api';

export const trackingService = {
  async getByManifiesto(manifiestoId: string): Promise<TrackingGPS[]> {
    const { data } = await api.get(`/manifiestos/${manifiestoId}/viaje-actual`);
    return data.data;
  },

  async updatePosition(req: TrackingUpdateRequest): Promise<void> {
    await api.post(`/manifiestos/${req.manifiestoId}/ubicacion`, {
      latitud: req.latitud,
      longitud: req.longitud,
    });
  },
};
