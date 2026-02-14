/**
 * SITREP v6 - Analytics Service
 */

import api from './api';
import type { DashboardStats, DashboardChart } from '../types/api';

export const analyticsService = {
  async getDashboardStats(): Promise<DashboardStats> {
    const { data } = await api.get('/manifiestos/dashboard');
    return data.data;
  },

  async getManifiestosPorMes(): Promise<DashboardChart[]> {
    try {
      const { data } = await api.get('/analytics/manifiestos-por-mes');
      const raw = data.data;
      return Array.isArray(raw) ? raw : raw.datos || raw.data || [];
    } catch {
      return [];
    }
  },

  async getResiduosPorTipo(): Promise<DashboardChart[]> {
    try {
      const { data } = await api.get('/analytics/residuos-por-tipo');
      const raw = data.data;
      return Array.isArray(raw) ? raw : raw.datos || raw.data || [];
    } catch {
      return [];
    }
  },

  async getManifiestosPorEstado(): Promise<DashboardChart[]> {
    try {
      const { data } = await api.get('/analytics/manifiestos-por-estado');
      const raw = data.data;
      return Array.isArray(raw) ? raw : raw.datos || raw.data || [];
    } catch {
      return [];
    }
  },

  async getTiempoPromedioPorEtapa(): Promise<DashboardChart[]> {
    try {
      const { data } = await api.get('/analytics/tiempo-promedio');
      const raw = data.data;
      return Array.isArray(raw) ? raw : raw.datos || raw.data || [];
    } catch {
      return [];
    }
  },
};
