/**
 * SITREP v6 - Centro de Control Hook
 * ====================================
 * React Query hook for GET /api/centro-control/actividad
 */

import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface ActorGenerador {
  id: string;
  razonSocial: string;
  cuit: string;
  categoria: string;
  latitud: number;
  longitud: number;
  cantManifiestos: number;
  ultimaActividad: string | null;
}

export interface ActorTransportista {
  id: string;
  razonSocial: string;
  cuit: string;
  domicilio?: string;
  latitud: number | null;
  longitud: number | null;
  vehiculosActivos: number;
  enviosEnTransito: number;
}

export interface ActorOperador {
  id: string;
  razonSocial: string;
  cuit: string;
  categoria: string;
  latitud: number;
  longitud: number;
  modalidades?: string[];
  corrientesY?: string;
  cantRecibidos: number;
  cantTratados: number;
}

export interface EnTransitoItem {
  manifiestoId: string;
  numero: string;
  transportista: string;
  origen: string;
  origenLatLng: [number, number] | null;
  destino: string;
  destinoLatLng: [number, number] | null;
  ultimaPosicion: {
    latitud: number;
    longitud: number;
    velocidad: number | null;
    direccion: number | null;
    timestamp: string;
  } | null;
  ruta: Array<{ lat: number; lng: number; velocidad: number | null; timestamp: string }>;
}

export interface EstadisticasCentroControl {
  totalManifiestos: number;
  enTransitoActivos: number;
  generadoresActivos: number;
  operadoresActivos: number;
  toneladasPeriodo: number;
  porEstado: Record<string, number>;
  manifiestosPorDia: Array<{ fecha: string; cantidad: number }>;
}

export interface CentroControlData {
  generadores: ActorGenerador[];
  transportistas: ActorTransportista[];
  operadores: ActorOperador[];
  enTransito: EnTransitoItem[];
  estadisticas: EstadisticasCentroControl;
}

export interface CentroControlParams {
  fechaDesde?: string;
  fechaHasta?: string;
  capas?: string[];
  incluirTodos?: string;
}

async function fetchActividad(params: CentroControlParams): Promise<CentroControlData> {
  const searchParams = new URLSearchParams();
  if (params.fechaDesde) searchParams.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) searchParams.set('fechaHasta', params.fechaHasta);
  if (params.capas && params.capas.length > 0) searchParams.set('capas', params.capas.join(','));
  if (params.incluirTodos) searchParams.set('incluirTodos', params.incluirTodos);

  const { data } = await api.get(`/centro-control/actividad?${searchParams.toString()}`);
  return data.data;
}

export function useCentroControl(params: CentroControlParams = {}, refreshInterval = 30000) {
  return useQuery<CentroControlData>({
    queryKey: ['centro-control', 'actividad', params.fechaDesde, params.fechaHasta, params.capas?.join(','), params.incluirTodos],
    queryFn: () => fetchActividad(params),
    staleTime: 15000,
    refetchInterval: refreshInterval,
    retry: 1,
  });
}
