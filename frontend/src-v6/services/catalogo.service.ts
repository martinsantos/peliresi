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
};
