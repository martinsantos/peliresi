import prisma from '../lib/prisma';
import { DomainEvent } from '../services/domainEvent.service';

const EVENT_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

async function createIncidentOnce(manifiestoId: string, usuarioId: string, prefix: string, descripcion: string): Promise<void> {
  // The transaction-scoped lock coordinates every API/consumer process. A hash
  // collision can only serialize unrelated keys: the lookup still checks the
  // manifest and literal class prefix. Never hold a session-level lock in a pool.
  const lockKey = JSON.stringify(['gps-incident', manifiestoId, prefix]);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text`;
    // Read the DB clock after waiting. PostgreSQL now() is the transaction start,
    // which may predate the lock; worker clocks need not be perfectly aligned.
    const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS "now"`;
    const recent = await tx.eventoManifiesto.findFirst({
      where: {
        manifiestoId,
        tipo: 'INCIDENTE',
        // Prisma startsWith uses LIKE. Underscores in GPS class names are literal.
        descripcion: { startsWith: prefix.replace(/[\\%_]/g, '\\$&') },
        createdAt: { gte: new Date(now.getTime() - EVENT_DEDUPE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (recent) return;
    await tx.eventoManifiesto.create({
      data: { manifiestoId, tipo: 'INCIDENTE', descripcion, usuarioId, createdAt: now },
    });
  }, { isolationLevel: 'ReadCommitted', maxWait: 10_000, timeout: 10_000 });
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
