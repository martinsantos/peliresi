import api from './api';
import type {
  SolicitudInscripcion,
  DocumentoSolicitud,
  MensajeSolicitud,
  SolicitudFilters,
  IniciarSolicitudRequest,
  UpdateSolicitudRequest,
  PaginatedData,
} from '../types/api';

export const solicitudService = {
  // ── Public ──
  async iniciar(req: IniciarSolicitudRequest): Promise<{ solicitudId: string; message: string }> {
    const { data } = await api.post('/solicitudes/iniciar', req);
    return data.data;
  },

  // ── Candidate ──
  async misSolicitudes(): Promise<SolicitudInscripcion[]> {
    const { data } = await api.get('/solicitudes/mis-solicitudes');
    return data.data.solicitudes;
  },

  async getById(id: string): Promise<SolicitudInscripcion> {
    const { data } = await api.get(`/solicitudes/${id}`);
    return data.data.solicitud;
  },

  async update(id: string, req: UpdateSolicitudRequest): Promise<SolicitudInscripcion> {
    const { data } = await api.put(`/solicitudes/${id}`, req);
    return data.data.solicitud;
  },

  async enviar(id: string): Promise<SolicitudInscripcion> {
    const { data } = await api.post(`/solicitudes/${id}/enviar`);
    return data.data.solicitud;
  },

  async uploadDocumento(id: string, file: File, tipo: string): Promise<DocumentoSolicitud> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipo', tipo);
    const { data } = await api.post(`/solicitudes/${id}/documentos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data.documento;
  },

  async deleteDocumento(solicitudId: string, docId: string): Promise<void> {
    await api.delete(`/solicitudes/${solicitudId}/documentos/${docId}`);
  },

  async getMensajes(id: string): Promise<MensajeSolicitud[]> {
    const { data } = await api.get(`/solicitudes/${id}/mensajes`);
    return data.data.mensajes;
  },

  async enviarMensaje(id: string, contenido: string): Promise<MensajeSolicitud> {
    const { data } = await api.post(`/solicitudes/${id}/mensajes`, { contenido });
    return data.data.mensaje;
  },

  // ── Admin ──
  async list(filters?: SolicitudFilters): Promise<PaginatedData<SolicitudInscripcion>> {
    const { data } = await api.get('/solicitudes', { params: filters });
    const raw = data.data;
    return {
      items: raw.solicitudes || [],
      total: raw.pagination?.total || 0,
      page: raw.pagination?.page || 1,
      limit: raw.pagination?.limit || 20,
      totalPages: raw.pagination?.pages || 1,
    };
  },

  async revisar(id: string): Promise<SolicitudInscripcion> {
    const { data } = await api.post(`/solicitudes/${id}/revisar`);
    return data.data.solicitud;
  },

  async observar(id: string, mensaje: string): Promise<SolicitudInscripcion> {
    const { data } = await api.post(`/solicitudes/${id}/observar`, { mensaje });
    return data.data.solicitud;
  },

  async aprobar(id: string): Promise<SolicitudInscripcion> {
    const { data } = await api.post(`/solicitudes/${id}/aprobar`);
    return data.data.solicitud;
  },

  async rechazar(id: string, motivoRechazo: string): Promise<SolicitudInscripcion> {
    const { data } = await api.post(`/solicitudes/${id}/rechazar`, { motivoRechazo });
    return data.data.solicitud;
  },

  async revisarDocumento(solicitudId: string, docId: string, estado: 'APROBADO' | 'RECHAZADO', observaciones?: string): Promise<DocumentoSolicitud> {
    const { data } = await api.patch(`/solicitudes/${solicitudId}/documentos/${docId}/revisar`, { estado, observaciones });
    return data.data.documento;
  },
};
