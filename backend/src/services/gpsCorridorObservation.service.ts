import prisma from '../lib/prisma';
import logger from '../utils/logger';
import { domainEvents } from './domainEvent.service';
import { assessGeographicCorridor } from './gpsCorridor.service';

type Endpoint = { latitud: number | null; longitud: number | null } | null | undefined;
type Segment = { kind: 'original' } | { kind: 'relay'; id: string; order: number };

/**
 * Receipt-order observations are scoped to the vehicle/relay which sent them.
 * The original carrier uses legacy null tramoId; replacement legs have an id.
 * This runs after acknowledging a stored point and is deliberately best-effort.
 */
export async function observeGpsCorridor(input: {
  manifiestoId: string;
  numero: string;
  origin: Endpoint;
  destination: Endpoint;
  segment: Segment;
  userId?: string;
}): Promise<void> {
  const { origin, destination, segment } = input;
  if (origin?.latitud == null || origin.longitud == null ||
      destination?.latitud == null || destination.longitud == null) return;
  try {
    const recent = await prisma.trackingGPS.findMany({
      where: { manifiestoId: input.manifiestoId, tramoId: segment.kind === 'original' ? null : segment.id },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: 3,
      select: { latitud: true, longitud: true },
    });
    const assessment = assessGeographicCorridor(recent, {
      origin: { latitud: origin.latitud, longitud: origin.longitud },
      destination: { latitud: destination.latitud, longitud: destination.longitud },
    });
    if (!assessment) return;
    const label = segment.kind === 'original' ? 'del transporte original' : `del tramo de relevo ${segment.order}`;
    domainEvents.emit({
      type: 'ANOMALIA_GPS',
      manifiestoId: input.manifiestoId,
      numero: input.numero,
      tipoAnomalia: 'FUERA_CORREDOR_GEOGRAFICO',
      descripcion: `Tres posiciones recibidas ${label} superan 50 km del corredor geográfico estimado (mín. ${assessment.minimumDistanceKm.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km). No se compara una ruta vial autorizada. Hora de captura no disponible. Verificá el caso con transporte.`,
      severidad: 'ALTA',
      ...(input.userId ? { userId: input.userId } : {}),
    });
  } catch (error) {
    // A stored GPS point was already acknowledged. Don't send a second HTTP
    // response or pretend this in-process analysis is a durable queue.
    logger.error({ err: error, manifiestoId: input.manifiestoId }, 'No se pudo evaluar la observación GPS');
  }
}
