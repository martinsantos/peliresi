import type { SeveridadAnomalia, TipoAnomalia } from '@prisma/client';
import { distanciaHaversine } from '../utils/geo';

/** The timestamp is server receipt time, not sensor capture time. */
export interface ReceivedGpsPoint {
  id: string;
  latitud: number;
  longitud: number;
  timestamp: Date;
  tramoId?: string | null;
  emisor?: string | null;
  tramo?: { orden: number } | null;
}
export interface ReceptionObservation {
  previousId: string;
  currentId: string;
  authorId?: string;
  anomaly: {
    tipo: TipoAnomalia;
    descripcion: string;
    latitud: number;
    longitud: number;
    valorDetectado: number;
    valorEsperado: number;
    severidad: SeveridadAnomalia;
  };
}

/** Caller supplies stable receipt order (timestamp, id). Null leg IDs are
 * grouped as original or legacy-unidentified; historical identity cannot be
 * inferred. Neither receipt timing nor these observations prove an event. */
export function detectGpsReceptionObservations(
  points: ReceivedGpsPoint[],
  options: { userId?: string; automatic?: boolean } = {},
): ReceptionObservation[] {
  const result: ReceptionObservation[] = [];
  const previousByLeg = new Map<string | null, ReceivedGpsPoint>();
  for (const current of points) {
    const legId = current.tramoId ?? null;
    const previous = previousByLeg.get(legId);
    previousByLeg.set(legId, current);
    if (!previous) continue;
    const scope = legId ? `Tramo de relevo${current.tramo?.orden == null ? '' : ` ${current.tramo.orden}`}. `
      : 'Transporte original o puntos sin tramo identificado. ';
    const authorId = options.automatic
      ? (!legId && options.userId && previous.emisor === `usuario:${options.userId}`
        && current.emisor === `usuario:${options.userId}` ? options.userId : undefined)
      : options.userId;
    const distance = distanciaHaversine(previous.latitud, previous.longitud, current.latitud, current.longitud);
    const hours = (current.timestamp.getTime() - previous.timestamp.getTime()) / 3_600_000;
    const speed = hours > 0 ? distance / hours : 0;
    const add = (anomaly: ReceptionObservation['anomaly']) =>
      result.push({ previousId: previous.id, currentId: current.id, authorId, anomaly });
    if (speed > 120) add({ tipo: 'VELOCIDAD_ANORMAL',
      descripcion: scope + 'Hora de captura no disponible. Verificá el caso con transporte. La distancia y el intervalo entre dos recepciones superan el umbral de velocidad; esto no confirma la velocidad real.',
      latitud: current.latitud, longitud: current.longitud, valorDetectado: speed, valorEsperado: 100, severidad: 'ALTA' });
    if (distance < 0.1 && hours > 2) add({ tipo: 'PARADA_PROLONGADA',
      descripcion: scope + `Hora de captura no disponible. Verificá el caso con transporte. Se recibieron dos posiciones próximas con ${(hours * 60).toFixed(0)} minutos de diferencia; esto no confirma una parada.`,
      latitud: current.latitud, longitud: current.longitud, valorDetectado: hours * 60, valorEsperado: 60,
      severidad: hours > 4 ? 'ALTA' : 'MEDIA' });
    if (hours > 0.5 && distance > 10) add({ tipo: 'GPS_PERDIDO',
      descripcion: scope + `Hora de captura no disponible. Verificá el caso con transporte. Pasaron ${(hours * 60).toFixed(0)} minutos entre dos recepciones; esto no confirma pérdida de señal.`,
      latitud: current.latitud, longitud: current.longitud, valorDetectado: hours * 60, valorEsperado: 5, severidad: 'MEDIA' });
  }
  return result;
}
