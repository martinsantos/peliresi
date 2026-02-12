/**
 * SITREP v6 - Catalogo Service
 */

import api from './api';
import type { TipoResiduo } from '../types/models';
import type { CatalogoItem } from '../types/api';

export const catalogoService = {
  async tiposResiduo(): Promise<TipoResiduo[]> {
    const { data } = await api.get('/catalogos/tipos-residuos');
    const raw = data.data;
    return Array.isArray(raw) ? raw : raw.tiposResiduos || raw.tiposResiduo || [];
  },

  async generadores(): Promise<CatalogoItem[]> {
    const { data } = await api.get('/catalogos/generadores');
    const raw = data.data;
    return Array.isArray(raw) ? raw : raw.generadores || [];
  },

  async transportistas(): Promise<CatalogoItem[]> {
    const { data } = await api.get('/catalogos/transportistas');
    const raw = data.data;
    return Array.isArray(raw) ? raw : raw.transportistas || [];
  },

  async operadores(): Promise<CatalogoItem[]> {
    const { data } = await api.get('/catalogos/operadores');
    const raw = data.data;
    return Array.isArray(raw) ? raw : raw.operadores || [];
  },

  async vehiculos(): Promise<CatalogoItem[]> {
    const { data } = await api.get('/catalogos/vehiculos');
    const raw = data.data;
    return Array.isArray(raw) ? raw : raw.vehiculos || [];
  },

  async choferes(): Promise<CatalogoItem[]> {
    const { data } = await api.get('/catalogos/choferes');
    const raw = data.data;
    return Array.isArray(raw) ? raw : raw.choferes || [];
  },

  async tratamientos(operadorId: string): Promise<CatalogoItem[]> {
    const { data } = await api.get(`/catalogos/operadores/${operadorId}/tratamientos`);
    const raw = data.data;
    return Array.isArray(raw) ? raw : raw.tratamientos || [];
  },

  // CRUD tipos-residuos
  async createTipoResiduo(req: Partial<TipoResiduo>): Promise<TipoResiduo> {
    const { data } = await api.post('/catalogos/tipos-residuos', req);
    return data.data?.tipoResiduo || data.data;
  },

  async updateTipoResiduo(id: string, req: Partial<TipoResiduo>): Promise<TipoResiduo> {
    const { data } = await api.put(`/catalogos/tipos-residuos/${id}`, req);
    return data.data?.tipoResiduo || data.data;
  },

  async deleteTipoResiduo(id: string): Promise<void> {
    await api.delete(`/catalogos/tipos-residuos/${id}`);
  },

  // List all tratamientos autorizados (admin)
  async allTratamientos(): Promise<any[]> {
    const { data } = await api.get('/catalogos/tratamientos');
    const raw = data.data;
    return Array.isArray(raw) ? raw : raw.tratamientos || [];
  },

  // CRUD tratamientos autorizados
  async createTratamiento(req: { operadorId: string; tipoResiduoId: string; metodo: string; descripcion?: string; capacidad?: number }): Promise<any> {
    const { data } = await api.post('/catalogos/tratamientos', req);
    return data.data?.tratamiento || data.data;
  },

  async updateTratamiento(id: string, req: { metodo?: string; descripcion?: string; capacidad?: number; activo?: boolean }): Promise<any> {
    const { data } = await api.put(`/catalogos/tratamientos/${id}`, req);
    return data.data?.tratamiento || data.data;
  },

  async deleteTratamiento(id: string): Promise<void> {
    await api.delete(`/catalogos/tratamientos/${id}`);
  },
};
