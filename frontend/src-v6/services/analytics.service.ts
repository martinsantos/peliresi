/**
 * SITREP v6 - Analytics Service
 */

import api from './api';
import type { DashboardStats, DashboardChart } from '../types/api';

export const analyticsService = {
  async getDashboardStats(): Promise<DashboardStats> {
    const { data } = await api.get('/analytics/dashboard');
    return data.data;
  },

  async getManifiestosPorMes(): Promise<DashboardChart[]> {
    const { data } = await api.get('/analytics/manifiestos-por-mes');
    return data.data;
  },

  async getResiduosPorTipo(): Promise<DashboardChart[]> {
    const { data } = await api.get('/analytics/residuos-por-tipo');
    return data.data;
  },

  async getManifiestosPorEstado(): Promise<DashboardChart[]> {
    const { data } = await api.get('/analytics/manifiestos-por-estado');
    return data.data;
  },

  async getTiempoPromedioPorEtapa(): Promise<DashboardChart[]> {
    const { data } = await api.get('/analytics/tiempo-promedio');
    return data.data;
  },
};
