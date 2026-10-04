/**
 * Monitor API — Endpoints on the shared authenticated SITREP client.
 * Token parsing, refresh queuing and logout handling must not diverge from
 * the rest of the application when several monitor queries expire together.
 */

import monitorApi from '../../../services/api';

// ─── Endpoints ────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id?: string;
  timestamp: string;
  type: 'EVENTO' | 'GPS';
  eventoTipo?: string;
  manifiestoId: string;
  manifiestoNumero: string;
  descripcion: string;
  latitud?: number;
  longitud?: number;
  velocidad?: number;
  direccion?: number;
  generador?: { razonSocial: string; lat: number; lng: number; cuit?: string; categoria?: string };
  operador?: { razonSocial: string; lat: number; lng: number; cuit?: string; categoria?: string };
  transportista?: { razonSocial: string; cuit?: string } | string;
  // Enriched fields from timeline endpoint
  estadoActual?: string;
  modalidad?: string;
  tratamientoMetodo?: string;
  residuos?: Array<{ codigo: string; nombre: string; cantidad: number; unidad: string }>;
  fechas?: { firma?: string; retiro?: string; entrega?: string; recepcion?: string; cierre?: string };
}

export interface ActorPosition {
  id: string;
  razonSocial: string;
  lat: number | null;
  lng: number | null;
  // Enriched fields
  cuit?: string;
  categoria?: string;
  domicilio?: string;
  cantManifiestos?: number;
  // Generador specific
  numeroInscripcion?: string;
  // Operador specific
  modalidades?: string[];
  numeroHabilitacion?: string;
  tratamientos?: string[];
  // Transportista specific
  vehiculos?: Array<{ patente: string; tipo: string }>;
  choferes?: Array<{ nombre: string }>;
}

export interface TimelineResponse {
  paginacion?: { pagina: number; siguiente: number | null };
  eventos: TimelineEvent[];
  actores: {
    generadores: ActorPosition[];
    transportistas: ActorPosition[];
    operadores: ActorPosition[];
  };
  resumen: {
    incompleto?: boolean;
    eventosRecortados?: boolean;
    gpsRecortados?: boolean;
    totalEventos: number;
    totalManifiestos: number;
    totalGpsPoints: number;
    primeraActividad: string | null;
    ultimaActividad: string | null;
  };
}

export interface EnTransitoItem {
  manifiestoId: string;
  numero: string;
  transportista: string;
  origen: { razonSocial: string; lat: number | null; lng: number | null };
  destino: { razonSocial: string; lat: number | null; lng: number | null };
  residuos?: Array<{ codigo: string; nombre: string; cantidad: number; unidad: string }>;
  vehiculo?: { patente: string; descripcion: string } | null;
  chofer?: { nombre: string } | null;
  fechaRetiro: string | null;
  ultimaPosicion: { latitud: number; longitud: number; velocidad?: number; direccion?: number; timestamp: string } | null;
  ruta: { lat: number; lng: number; velocidad?: number; timestamp: string }[];
}

export interface MonitorLiveResponse {
  estadisticas: {
    porEstado: Record<string, number>;
    total: number;
    manifiestosHoy: number;
    toneladas: number;
    enTransitoActivos: number;
  };
  enTransito: EnTransitoItem[];
  eventosRecientes: {
    id: string;
    tipo: string;
    descripcion: string;
    latitud?: number;
    longitud?: number;
    timestamp: string;
    manifiestoNumero: string;
  }[];
  actores: {
    generadores: ActorPosition[];
    transportistas: ActorPosition[];
    operadores: ActorPosition[];
  };
  topGeneradores: { razonSocial: string; cantidad: number }[];
  topOperadores: { razonSocial: string; cantidad: number }[];
  porDia: { fecha: string; cantidad: number }[];
  topResiduos: { nombre: string; total: number; categoria: string | null }[];
  tratamientosActivos: { metodo: string; cantidad: number }[];
}

export interface ForecastResponse {
  pendienteRetiro: {
    manifiestoId: string;
    numero: string;
    generador: string;
    operador: string;
    transportista: string;
    fechaEstimadaRetiro: string | null;
    diasEspera: number;
    origenLatLng: [number, number] | null;
    destinoLatLng: [number, number] | null;
  }[];
  pendienteTratamiento: {
    manifiestoId: string;
    numero: string;
    operador: string;
    estado: string;
    diasEnEspera: number;
    operadorLatLng: [number, number] | null;
  }[];
  vencimientosProximos: {
    tipo: string;
    entidad: string;
    fechaVencimiento: string;
    diasRestantes: number;
  }[];
}

export async function fetchTimeline(fecha: string, dias = 1, signal?: AbortSignal): Promise<TimelineResponse> {
  let result: TimelineResponse | undefined;
  const seen = new Set<string>();
  const corte = new Date().toISOString();
  for (let pagina = 1; pagina <= 100; pagina++) {
    const { data } = await monitorApi.get('/centro-control/timeline', { params: { fecha, dias, pagina, corte }, signal });
    const batch = data.data as TimelineResponse;
    if (!result) result = { ...batch, eventos: [], resumen: { ...batch.resumen } };
    for (const event of batch.eventos) {
      if (event.id && seen.has(event.id)) continue;
      if (event.id) seen.add(event.id);
      result.eventos.push(event);
    }
    // A phone must not allocate an unbounded month of GPS. Never turn this
    // safety boundary into a partial movie labelled as the complete period.
    if (result.eventos.length > 25000) throw new Error('El historial supera 25.000 registros. Elegí un período más corto para reproducirlo.');
    if (!batch.paginacion?.siguiente) {
      if (batch.resumen.incompleto) throw new Error('El servidor devolvió un historial incompleto. Elegí un período más corto.');
      result.eventos.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || (a.id || '').localeCompare(b.id || ''));
      result.paginacion = { pagina, siguiente: null };
      result.resumen = { ...result.resumen, incompleto: false, eventosRecortados: false, gpsRecortados: false,
        totalEventos: result.eventos.length, totalGpsPoints: result.eventos.filter(e => e.type === 'GPS').length,
        primeraActividad: result.eventos[0]?.timestamp ?? null, ultimaActividad: result.eventos.at(-1)?.timestamp ?? null };
      return result;
    }
    if (batch.paginacion.siguiente !== pagina + 1) throw new Error('La paginación del historial no avanzó. Volvé a cargar el período.');
  }
  throw new Error('El historial es demasiado grande. Elegí un período más corto.');
}

export async function fetchMonitorLive(): Promise<MonitorLiveResponse> {
  const { data } = await monitorApi.get('/centro-control/monitor-live');
  return data.data;
}

export async function fetchForecast(dias = 7): Promise<ForecastResponse> {
  const { data } = await monitorApi.get('/centro-control/forecast', { params: { dias } });
  return data.data;
}

export async function fetchActiveDays(): Promise<string[]> {
  const { data } = await monitorApi.get('/centro-control/active-days');
  return data.data.days;
}
