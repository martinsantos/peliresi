import prisma from '../lib/prisma';
import { DomainEvent } from '../services/domainEvent.service';

/**
 * Crea EventoManifiesto para eventos GPS que NO tienen creación inline en el controller.
 * Los eventos de workflow (FIRMA, RETIRO, ENTREGA, etc.) ya crean su EventoManifiesto
 * dentro de la transacción del controller — no se duplican aquí.
 */
export async function eventoManifiestoSubscriber(event: DomainEvent): Promise<void> {
  switch (event.type) {
    case 'ANOMALIA_GPS':
      await prisma.eventoManifiesto.create({
        data: {
          manifiestoId: event.manifiestoId,
          tipo: 'INCIDENTE',
          descripcion: `Anomalía GPS detectada (${event.tipoAnomalia}): ${event.descripcion}`,
          usuarioId: event.userId,
        },
      });
      break;

    case 'TIEMPO_EXCESIVO':
      await prisma.eventoManifiesto.create({
        data: {
          manifiestoId: event.manifiestoId,
          tipo: 'INCIDENTE',
          descripcion: `Tiempo de tránsito excesivo: ${event.horasTransito.toFixed(1)} horas en tránsito`,
          usuarioId: event.userId,
        },
      });
      break;

    case 'DESVIO_RUTA':
      await prisma.eventoManifiesto.create({
        data: {
          manifiestoId: event.manifiestoId,
          tipo: 'INCIDENTE',
          descripcion: `Desvío de ruta detectado: ${event.distanciaKm.toFixed(1)} km fuera del corredor`,
          usuarioId: event.userId,
        },
      });
      break;

    default:
      // Otros eventos ya tienen EventoManifiesto creado inline en el controller (dentro de transacción).
      break;
  }
}
