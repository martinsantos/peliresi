/**
 * SITREP v6 - Manifiesto Service
 */

import api from './api';
import type {
  CreateManifiestoRequest, ManifiestoFilters, ManifiestoDashboard,
  FirmarManifiestoRequest, ConfirmarRetiroRequest, ConfirmarEntregaRequest,
  PesajeRequest, ConfirmarRecepcionRequest, RegistrarTratamientoRequest,
  PaginatedData,
} from '../types/api';
import type { Manifiesto } from '../types/models';

export const manifiestoService = {
  async list(filters?: ManifiestoFilters): Promise<PaginatedData<Manifiesto>> {
    const { data } = await api.get('/manifiestos', { params: filters });
    return data.data;
  },

  async getById(id: string): Promise<Manifiesto> {
    const { data } = await api.get(`/manifiestos/${id}`);
    return data.data;
  },

  async create(req: CreateManifiestoRequest): Promise<Manifiesto> {
    const { data } = await api.post('/manifiestos', req);
    return data.data;
  },

  async update(id: string, req: Partial<CreateManifiestoRequest>): Promise<Manifiesto> {
    const { data } = await api.put(`/manifiestos/${id}`, req);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/manifiestos/${id}`);
  },

  async firmar(id: string, req?: FirmarManifiestoRequest): Promise<Manifiesto> {
    const { data } = await api.post(`/manifiestos/${id}/firmar`, req);
    return data.data;
  },

  async confirmarRetiro(id: string, req?: ConfirmarRetiroRequest): Promise<Manifiesto> {
    const { data } = await api.post(`/manifiestos/${id}/confirmar-retiro`, req);
    return data.data;
  },

  async actualizarUbicacion(id: string, latitud: number, longitud: number): Promise<void> {
    await api.post(`/manifiestos/${id}/ubicacion`, { latitud, longitud });
  },

  async confirmarEntrega(id: string, req?: ConfirmarEntregaRequest): Promise<Manifiesto> {
    const { data } = await api.post(`/manifiestos/${id}/confirmar-entrega`, req);
    return data.data;
  },

  async pesaje(id: string, req: PesajeRequest): Promise<Manifiesto> {
    const { data } = await api.post(`/manifiestos/${id}/pesaje`, req);
    return data.data;
  },

  async confirmarRecepcion(id: string, req?: ConfirmarRecepcionRequest): Promise<Manifiesto> {
    const { data } = await api.post(`/manifiestos/${id}/confirmarRecepcion`, req);
    return data.data;
  },

  async registrarTratamiento(id: string, req: RegistrarTratamientoRequest): Promise<Manifiesto> {
    const { data } = await api.post(`/manifiestos/${id}/registrarTratamiento`, req);
    return data.data;
  },

  async cerrar(id: string): Promise<Manifiesto> {
    const { data } = await api.post(`/manifiestos/${id}/cerrar`);
    return data.data;
  },

  async dashboard(): Promise<ManifiestoDashboard> {
    const { data } = await api.get('/manifiestos/dashboard');
    return data.data;
  },

  async syncInicial(): Promise<Manifiesto[]> {
    const { data } = await api.get('/manifiestos/sync-inicial');
    return data.data;
  },

  async validarQR(code: string): Promise<Manifiesto> {
    const { data } = await api.post('/manifiestos/validar-qr', { code });
    return data.data;
  },
};
