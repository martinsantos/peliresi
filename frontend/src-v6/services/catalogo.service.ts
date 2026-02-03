/**
 * SITREP v6 - Catalogo Service
 */

import api from './api';
import type { TipoResiduo } from '../types/models';
import type { CatalogoItem } from '../types/api';

export const catalogoService = {
  async tiposResiduo(): Promise<TipoResiduo[]> {
    const { data } = await api.get('/catalogos/tipos-residuos');
    return data.data;
  },

  async generadores(): Promise<CatalogoItem[]> {
    const { data } = await api.get('/catalogos/generadores');
    return data.data;
  },

  async transportistas(): Promise<CatalogoItem[]> {
    const { data } = await api.get('/catalogos/transportistas');
    return data.data;
  },

  async operadores(): Promise<CatalogoItem[]> {
    const { data } = await api.get('/catalogos/operadores');
    return data.data;
  },

  async vehiculos(): Promise<CatalogoItem[]> {
    const { data } = await api.get('/catalogos/vehiculos');
    return data.data;
  },

  async choferes(): Promise<CatalogoItem[]> {
    const { data } = await api.get('/catalogos/choferes');
    return data.data;
  },

  async tratamientos(): Promise<CatalogoItem[]> {
    const { data } = await api.get('/catalogos/tratamientos');
    return data.data;
  },
};
