import api from './api';
import type {
  Inspection,
  InspectionActorType,
  InspectionItemResult,
  InspectionComparisonResult,
  InspectionState,
  InspectionActData,
  InspectionTechnicalReport,
} from '../types/inspection';

export interface PaginatedInspections {
  items: Inspection[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary?: {
    byState: Partial<Record<InspectionState, number>>;
    openDeadlines: number;
  };
}

export const inspeccionService = {
  async list(params?: { estado?: InspectionState; tipoActor?: InspectionActorType; actorId?: string; search?: string; page?: number; limit?: number }): Promise<PaginatedInspections> {
    const { data } = await api.get('/inspecciones', { params });
    return data.data;
  },

  async get(id: string): Promise<Inspection> {
    const { data } = await api.get(`/inspecciones/${id}`);
    return data.data;
  },

  async create(input: {
    tipoActor: InspectionActorType;
    actorId: string;
    numeroActa?: string;
    ubicacion?: string;
    fechaProgramada?: string;
    observaciones?: string;
  }): Promise<Inspection> {
    const { data } = await api.post('/inspecciones', input);
    return data.data;
  },

  async update(id: string, input: {
    version: number;
    numeroActa?: string | null;
    ubicacion?: string | null;
    latitud?: number | null;
    longitud?: number | null;
    fechaProgramada?: string | null;
    plazoRespuestaAt?: string | null;
    observaciones?: string | null;
    datosActa?: InspectionActData | null;
    informeTecnico?: InspectionTechnicalReport | null;
  }): Promise<Inspection> {
    const { data } = await api.patch(`/inspecciones/${id}`, input);
    return data.data;
  },

  async updateTechnicalReport(id: string, version: number, informeTecnico: InspectionTechnicalReport | null): Promise<Inspection> {
    const { data } = await api.patch(`/inspecciones/${id}/informe-tecnico`, { version, informeTecnico });
    return data.data;
  },

  async updateItems(id: string, version: number, items: Array<{ id: string; resultado: InspectionItemResult; observacion?: string | null }>): Promise<Inspection> {
    const { data } = await api.patch(`/inspecciones/${id}/items`, { version, items });
    return data.data;
  },

  async updateComparisons(id: string, version: number, comparaciones: Array<{ id: string; resultado: InspectionComparisonResult; valorObservado?: string | null; observacion?: string | null }>): Promise<Inspection> {
    const { data } = await api.patch(`/inspecciones/${id}/comparaciones`, { version, comparaciones });
    return data.data;
  },

  async addEvent(id: string, input: { tipo: 'COMENTARIO_INTERNO' | 'SOLICITUD_CORRECCION' | 'RESPUESTA_ACTOR' | 'RESOLUCION' | 'NOTIFICACION_PREPARADA'; titulo: string; detalle: string; visibleActor?: boolean; destinatario?: string | null }): Promise<{ id: string }> {
    const { data } = await api.post(`/inspecciones/${id}/eventos`, input);
    return data.data;
  },

  async transition(id: string, version: number, estado: InspectionState, extra?: { detalle?: string; plazoRespuestaAt?: string }): Promise<Inspection> {
    const { data } = await api.post(`/inspecciones/${id}/estado`, { version, estado, ...extra });
    return data.data;
  },

  async uploadEvidence(id: string, file: File, fields?: { tipo?: string; descripcion?: string; transcripcion?: string; latitud?: number; longitud?: number; comparacionId?: string; eventoId?: string; itemId?: string; clienteId?: string; capturadaAt?: string; clienteSha256?: string }): Promise<Inspection['evidencias'][number]> {
    const form = new FormData();
    form.append('file', file);
    Object.entries(fields || {}).forEach(([key, value]) => {
      if (value !== undefined) form.append(key, String(value));
    });
    // No fijar Content-Type: el navegador debe incorporar el boundary multipart.
    const { data } = await api.post(`/inspecciones/${id}/evidencias`, form);
    return data.data;
  },

  async annulEvidence(id: string, evidenceId: string, version: number, motivo: string): Promise<Inspection['evidencias'][number]> {
    const { data } = await api.patch(`/inspecciones/${id}/evidencias/${evidenceId}/anular`, { version, motivo });
    return data.data;
  },

  evidenceUrl(id: string, evidenceId: string): string {
    return `/api/inspecciones/${encodeURIComponent(id)}/evidencias/${encodeURIComponent(evidenceId)}`;
  },

  async evidenceObjectUrl(id: string, evidenceId: string): Promise<string> {
    const response = await api.get(`/inspecciones/${id}/evidencias/${evidenceId}`, { responseType: 'blob' });
    return URL.createObjectURL(response.data);
  },

  async downloadPdf(id: string, numero: string, kind: 'acta' | 'informe-tecnico'): Promise<void> {
    const response = await api.get(`/inspecciones/${id}/${kind}.pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = kind === 'acta' ? `acta_inspeccion_${numero}.pdf` : `informe_tecnico_${numero}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
