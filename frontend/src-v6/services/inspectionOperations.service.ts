import api from './api';
import type { InspectionActorType, InspectionState } from '../types/inspection';

export type InspectionOperation = {
  id: string; numero: string; tipoActor: InspectionActorType | null; estado: InspectionState;
  inspectorId: string; inspector: { id: string; nombre: string; apellido?: string | null };
  generador?: { id: string; razonSocial: string } | null; transportista?: { id: string; razonSocial: string } | null; operador?: { id: string; razonSocial: string } | null;
  ubicacion?: string | null; latitud?: number | null; longitud?: number | null;
  fechaProgramada?: string | null; iniciadaAt?: string | null; cerradaCampoAt?: string | null;
  updatedAt: string; createdAt: string; version: number;
};
export type InspectionOperationsParams = { desde?: string; hasta?: string; fecha?: 'programada' | 'creacion' | 'campo'; estado?: InspectionState; inspectorId?: string; activas?: boolean; page?: number; limit?: number };
export type InspectionOperationsResult = {
  items: InspectionOperation[]; total: number; page: number; limit: number; totalPages: number; updatedAt: string;
  summary: { byState: Partial<Record<InspectionState, number>>; sinUbicacion: number; sinResponsable: number };
};
export type InspectorOption = { id: string; nombre: string; apellido?: string | null; rol: string; esInspector: boolean };
export type InspectionCandidate = { id: string; tipoActor: InspectionActorType; razonSocial: string; domicilio: string; fuente: string; distanciaMetros: number; activo: boolean };
export const canUseInspectionOperations = (user?: { rol?: string; esInspector?: boolean } | null) => Boolean(user?.esInspector || user?.rol === 'ADMIN' || user?.rol?.startsWith('ADMIN_'));
export const operationSubject = (row: InspectionOperation) => row.generador?.razonSocial || row.transportista?.razonSocial || row.operador?.razonSocial || 'Responsable por identificar';
export const hasInspectionCoordinates = (row: Pick<InspectionOperation, 'latitud' | 'longitud'>) => typeof row.latitud === 'number' && Number.isFinite(row.latitud) && Math.abs(row.latitud) <= 90 && typeof row.longitud === 'number' && Number.isFinite(row.longitud) && Math.abs(row.longitud) <= 180;

export const inspectionOperationsService = {
  async candidates(id: string): Promise<{ items: InspectionCandidate[]; limitada: boolean }> {
    const { data } = await api.get(`/inspecciones/${id}/candidatos`);
    return data.data;
  },
  async list(params: InspectionOperationsParams = {}, exporting = false): Promise<InspectionOperationsResult> {
    const { data } = await api.get(`/inspecciones/operaciones${exporting ? '/exportar' : ''}`, { params });
    return data.data;
  },
  async inspectors(): Promise<InspectorOption[]> {
    const { data } = await api.get('/inspecciones/inspectores');
    return data.data;
  },
  async organize(id: string, input: { version: number; inspectorId?: string; fechaProgramada?: string | null; tipoActor?: InspectionActorType; actorId?: string; motivo: string }): Promise<void> {
    await api.patch(`/inspecciones/${id}/organizacion`, input);
  },
};
