import cron from 'node-cron';
import { createHash } from 'node:crypto';
import prisma from '../lib/prisma';

/** Internal follow-up, not a late/legal classification. Never invokes a delivery provider. */
export async function ejecutarSeguimientoCierre(now = new Date()): Promise<number> {
  let cursor: string | undefined;
  let checked = 0;
  for (;;) {
    const batch = await prisma.manifiesto.findMany({
      where: { estado: { in: ['RECIBIDO', 'EN_TRATAMIENTO'] } },
      select: { id: true }, orderBy: { id: 'asc' }, take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const row of batch) {
      await prisma.$transaction(async tx => {
        // Re-read after the scan. The inbox also reconciles with current state:
        // a workflow can still change concurrently after this read.
        const m = await tx.manifiesto.findUnique({ where: { id: row.id },
          include: { operador: { include: { usuario: true } } } });
        if (!m || !['RECIBIDO', 'EN_TRATAMIENTO'].includes(m.estado) || !m.operador?.usuario.activo) return;
        const userId = m.operador.usuario.id;
        const id = 'seguimiento_' + createHash('sha256').update(JSON.stringify([m.id, userId, m.estado, 1])).digest('hex');
        const received = m.fechaRecepcion;
        const days = received && received.getTime() <= now.getTime() ? Math.floor((now.getTime() - received.getTime()) / 86400000) : null;
        const action = m.estado === 'RECIBIDO' ? 'Revisá el pesaje y registrá el tratamiento o el cierre permitido.' : 'Completá el tratamiento y el cierre cuando corresponda.';
        const data = {
          usuarioId: userId, manifiestoId: m.id, tipo: 'INFO_GENERAL' as const, prioridad: 'NORMAL' as const,
          titulo: 'Seguimiento de manifiesto',
          mensaje: `${m.numero} · Evaluado el ${now.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' })}. ${days === null ? 'Sin fecha de recepción válida registrada.' : `Recibido hace ${days} día${days === 1 ? '' : 's'}.`} ${action}`,
          datos: JSON.stringify({ tipo: 'seguimiento_cierre', version: 1, estadoDetectado: m.estado,
            fechaRecepcion: received?.toISOString() ?? null, evaluadoAt: now.toISOString() }),
        };
        // Unique deterministic primary key is safe across retries/workers. Preserve read state.
        await tx.notificacion.upsert({ where: { id }, create: { id, ...data }, update: data });
        checked++;
      });
    }
    if (batch.length < 100) break;
    cursor = batch[batch.length - 1].id;
  }
  return checked;
}

export function iniciarSeguimientoCierreJob(): void {
  if ((process.env.NODE_APP_INSTANCE || process.env.pm_id || '0') !== '0') return;
  let running = false;
  cron.schedule('0 8 * * *', async () => {
    if (running) return;
    running = true;
    try { await ejecutarSeguimientoCierre(); }
    catch (error) { console.error('[SeguimientoCierre] No se completó el seguimiento interno', error); }
    finally { running = false; }
  }, { timezone: 'America/Argentina/Mendoza' });
}
