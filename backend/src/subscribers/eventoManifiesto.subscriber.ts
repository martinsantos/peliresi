import prisma from '../lib/prisma';
import { DomainEvent } from '../services/domainEvent.service';

const EVENT_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

async function createIncidentOnce(manifiestoId: string, usuarioId: string, prefix: string, descripcion: string): Promise<void> {
  const recent = await prisma.eventoManifiesto.findFirst({
    where: {
      manifiestoId,
      tipo: 'INCIDENTE',
      descripcion: { startsWith: prefix },
      createdAt: { gte: new Date(Date.now() - EVENT_DEDUPE_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (recent) return;
  await prisma.eventoManifiesto.create({ data: { manifiestoId, tipo: 'INCIDENTE', descripcion, usuarioId } });
}

/**
 * Crea EventoManifiesto para eventos GPS que NO tienen creación inline en el controller.
 * Los eventos de workflow (FIRMA, RETIRO, ENTREGA, etc.) ya crean su EventoManifiesto
 * dentro de la transacción del controller — no se duplican aquí.
 */
export async function eventoManifiestoSubscriber(event: DomainEvent): Promise<void> {
  switch (event.type) {
    case 'ANOMALIA_GPS':
      await createIncidentOnce(
        event.manifiestoId,
        event.userId,
        `Anomalía GPS detectada (${event.tipoAnomalia})`,
        `Anomalía GPS detectada (${event.tipoAnomalia}): ${event.descripcion}`,
      );
      break;

    case 'TIEMPO_EXCESIVO':
      await createIncidentOnce(
        event.manifiestoId,
        event.userId,
        'Tiempo de tránsito excesivo:',
        `Tiempo de tránsito excesivo: ${event.horasTransito.toFixed(1)} horas en tránsito`,
      );
      break;

    case 'DESVIO_RUTA':
      await createIncidentOnce(
        event.manifiestoId,
        event.userId,
        'Desvío de ruta detectado:',
        `Desvío de ruta detectado: ${event.distanciaKm.toFixed(1)} km fuera del corredor`,
      );
      break;

    default:
      // Otros eventos ya tienen EventoManifiesto creado inline en el controller (dentro de transacción).
      break;
  }
}
