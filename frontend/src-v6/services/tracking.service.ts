/**
 * SITREP v6 - Tracking Service
 */

import api from './api';
import type { TrackingGPS } from '../types/models';
import type { TrackingUpdateRequest } from '../types/api';

export const trackingService = {
  async getByManifiesto(manifiestoId: string): Promise<TrackingGPS[]> {
    const { data } = await api.get(`/tracking/${manifiestoId}`);
    return data.data;
  },

  async updatePosition(req: TrackingUpdateRequest): Promise<void> {
    await api.post('/tracking/update', req);
  },

  async getActiveTrips(): Promise<Array<{
    manifiestoId: string;
    numero: string;
    lastPosition: TrackingGPS;
    generador: string;
    transportista: string;
    operador: string;
  }>> {
    const { data } = await api.get('/tracking/active');
    return data.data;
  },
};
