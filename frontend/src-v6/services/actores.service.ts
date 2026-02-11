/**
 * SITREP v6 - Actores Service
 */

import api from './api';
import type { ActorFilters, CreateGeneradorRequest, CreateTransportistaRequest, CreateOperadorRequest, PaginatedData } from '../types/api';
import type { Generador, Transportista, Operador, Vehiculo, Chofer } from '../types/models';

export const actoresService = {
  // Generadores
  async listGeneradores(filters?: ActorFilters): Promise<PaginatedData<Generador>> {
    const { data } = await api.get('/actores/generadores', { params: filters });
    const raw = data.data;
    return {
      items: raw.generadores || [],
      total: raw.pagination?.total || 0,
      page: raw.pagination?.page || 1,
      limit: raw.pagination?.limit || 10,
      totalPages: raw.pagination?.pages || 1,
    };
  },

  async getGenerador(id: string): Promise<Generador> {
    const { data } = await api.get(`/actores/generadores/${id}`);
    return data.data.generador || data.data;
  },

  async createGenerador(req: CreateGeneradorRequest): Promise<Generador> {
    const { data } = await api.post('/actores/generadores', req);
    return data.data;
  },

  async updateGenerador(id: string, req: Partial<CreateGeneradorRequest>): Promise<Generador> {
    const { data } = await api.put(`/actores/generadores/${id}`, req);
    return data.data;
  },

  async deleteGenerador(id: string): Promise<void> {
    await api.delete(`/actores/generadores/${id}`);
  },

  // Transportistas
  async listTransportistas(filters?: ActorFilters): Promise<PaginatedData<Transportista>> {
    const { data } = await api.get('/actores/transportistas', { params: filters });
    const raw = data.data;
    return {
      items: raw.transportistas || [],
      total: raw.pagination?.total || 0,
      page: raw.pagination?.page || 1,
      limit: raw.pagination?.limit || 10,
      totalPages: raw.pagination?.pages || 1,
    };
  },

  async getTransportista(id: string): Promise<Transportista> {
    const { data } = await api.get(`/actores/transportistas/${id}`);
    return data.data.transportista || data.data;
  },

  async createTransportista(req: CreateTransportistaRequest): Promise<Transportista> {
    const { data } = await api.post('/actores/transportistas', req);
    return data.data;
  },

  async updateTransportista(id: string, req: Partial<CreateTransportistaRequest>): Promise<Transportista> {
    const { data } = await api.put(`/actores/transportistas/${id}`, req);
    return data.data;
  },

  async deleteTransportista(id: string): Promise<void> {
    await api.delete(`/actores/transportistas/${id}`);
  },

  // Operadores
  async listOperadores(filters?: ActorFilters): Promise<PaginatedData<Operador>> {
    const { data } = await api.get('/actores/operadores', { params: filters });
    const raw = data.data;
    return {
      items: raw.operadores || [],
      total: raw.pagination?.total || 0,
      page: raw.pagination?.page || 1,
      limit: raw.pagination?.limit || 10,
      totalPages: raw.pagination?.pages || 1,
    };
  },

  async getOperador(id: string): Promise<Operador> {
    const { data } = await api.get(`/actores/operadores/${id}`);
    return data.data.operador || data.data;
  },

  async createOperador(req: CreateOperadorRequest): Promise<Operador> {
    const { data } = await api.post('/actores/operadores', req);
    return data.data;
  },

  async updateOperador(id: string, req: Partial<CreateOperadorRequest>): Promise<Operador> {
    const { data } = await api.put(`/actores/operadores/${id}`, req);
    return data.data;
  },

  async deleteOperador(id: string): Promise<void> {
    await api.delete(`/actores/operadores/${id}`);
  },

  // Vehículos (GET via /catalogos, POST via /actores)
  async listVehiculos(transportistaId: string): Promise<Vehiculo[]> {
    const { data } = await api.get(`/catalogos/transportistas/${transportistaId}/vehiculos`);
    const raw = data.data;
    return Array.isArray(raw) ? raw : raw.vehiculos || [];
  },

  async createVehiculo(transportistaId: string, req: Partial<Vehiculo>): Promise<Vehiculo> {
    const { data } = await api.post(`/actores/transportistas/${transportistaId}/vehiculos`, req);
    return data.data?.vehiculo || data.data;
  },

  // Choferes (GET via /catalogos, POST via /actores)
  async listChoferes(transportistaId: string): Promise<Chofer[]> {
    const { data } = await api.get(`/catalogos/transportistas/${transportistaId}/choferes`);
    const raw = data.data;
    return Array.isArray(raw) ? raw : raw.choferes || [];
  },

  async createChofer(transportistaId: string, req: Partial<Chofer>): Promise<Chofer> {
    const { data } = await api.post(`/actores/transportistas/${transportistaId}/choferes`, req);
    return data.data?.chofer || data.data;
  },
};
