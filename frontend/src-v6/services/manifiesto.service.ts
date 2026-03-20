/**
 * SITREP v6 - Manifiesto Service
 */

import api from './api';
import type {
  CreateManifiestoRequest, ManifiestoFilters, ManifiestoDashboard,
  FirmarManifiestoRequest, ConfirmarRetiroRequest, ConfirmarEntregaRequest,
  PesajeRequest, ConfirmarRecepcionRequest, RegistrarTratamientoRequest,
  RechazarManifiestoRequest, RegistrarIncidenteRequest,
  PaginatedData,
} from '../types/api';
import type { Manifiesto } from '../types/models';

export const manifiestoService = {
  async list(filters?: ManifiestoFilters): Promise<PaginatedData<Manifiesto>> {
    const { data } = await api.get('/manifiestos', { params: filters });
    const raw = data.data;
    return {
      items: raw.manifiestos || [],
      total: raw.pagination?.total || 0,
      page: raw.pagination?.page || 1,
      limit: raw.pagination?.limit || 10,
      totalPages: raw.pagination?.pages || 1,
    };
  },

  async getById(id: string): Promise<Manifiesto> {
    const { data } = await api.get(`/manifiestos/${id}`);
    return data.data?.manifiesto || data.data;
  },

  async create(req: CreateManifiestoRequest): Promise<Manifiesto> {
    const { data } = await api.post('/manifiestos', req);
    return data.data?.manifiesto || data.data;
  },

  async update(id: string, req: Partial<CreateManifiestoRequest>): Promise<Manifiesto> {
    const { data } = await api.put(`/manifiestos/${id}`, req);
    return data.data?.manifiesto || data.data;
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

  async actualizarUbicacion(id: string, latitud: number, longitud: number, velocidad?: number | null, direccion?: number | null): Promise<void> {
    await api.post(`/manifiestos/${id}/ubicacion`, {
      latitud, longitud,
      ...(velocidad != null && { velocidad }),
      ...(direccion != null && { direccion }),
    });
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
    const { data } = await api.post(`/manifiestos/${id}/confirmar-recepcion`, req);
    return data.data;
  },

  async registrarTratamiento(id: string, req: RegistrarTratamientoRequest): Promise<Manifiesto> {
    const { data } = await api.post(`/manifiestos/${id}/tratamiento`, req);
    return data.data;
  },

  async rechazar(id: string, req: RechazarManifiestoRequest): Promise<Manifiesto> {
    const { data } = await api.post(`/manifiestos/${id}/rechazar`, req);
    return data.data;
  },

  async registrarIncidente(id: string, req: RegistrarIncidenteRequest): Promise<Manifiesto> {
    const { data } = await api.post(`/manifiestos/${id}/incidente`, req);
    return data.data;
  },

  async cerrar(id: string): Promise<Manifiesto> {
    const { data } = await api.post(`/manifiestos/${id}/cerrar`);
    return data.data;
  },

  async revertirEstado(id: string, estadoNuevo: string, motivo?: string): Promise<Manifiesto> {
    const { data } = await api.post(`/manifiestos/${id}/revertir-estado`, { estadoNuevo, motivo });
    return data.data?.manifiesto || data.data;
  },

  async dashboard(): Promise<ManifiestoDashboard> {
    const { data } = await api.get('/manifiestos/dashboard');
    return data.data;
  },

  async syncInicial(): Promise<Manifiesto[]> {
    const { data } = await api.get('/manifiestos/sync-inicial');
    const raw = data.data;
    return Array.isArray(raw) ? raw : raw.manifiestos || [];
  },

  async validarQR(code: string): Promise<Manifiesto> {
    const { data } = await api.post('/manifiestos/validar-qr', { code });
    return data.data;
  },

  async downloadPdf(id: string): Promise<Blob> {
    const { data } = await api.get(`/pdf/manifiesto/${id}`, { responseType: 'blob' });
    return data;
  },

  async downloadCertificado(id: string): Promise<Blob> {
    const { data } = await api.get(`/pdf/certificado/${id}`, { responseType: 'blob' });
    return data;
  },

  async getBlockchainStatus(id: string) {
    const { data } = await api.get(`/blockchain/manifiesto/${id}`);
    return data.data.blockchain;
  },

  async verificarBlockchain(hash: string) {
    const { data } = await api.get(`/blockchain/verificar/${hash}`);
    return data.data;
  },

  async registrarBlockchain(id: string) {
    const { data } = await api.post(`/blockchain/registrar/${id}`);
    return data.data;
  },
};
