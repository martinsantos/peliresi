import cron from 'node-cron';
import { createHash } from 'node:crypto';
import prisma from '../lib/prisma';
import { isTrainingSession } from '../lib/trainingScope';

export function signatureReminderPhase(signedAt: Date | null, state: string, now: Date): 'SEMANA' | 'TREINTA_DIAS' | null {
  if (!signedAt || ['BORRADOR', 'PENDIENTE_APROBACION', 'TRATADO', 'CANCELADO', 'RECHAZADO'].includes(state)) return null;
  const elapsed = (now.getTime() - signedAt.getTime()) / 86400000;
  return elapsed >= 30 ? 'TREINTA_DIAS' : elapsed >= 23 ? 'SEMANA' : null;
}

/** Only durable internal notices. Delivery remains behind existing explicit gates. */
export async function ejecutarRecordatorioFirma(now = new Date()): Promise<number> {
  if (isTrainingSession()) return 0;
  let cursor: string | undefined, inserted = 0;
  for (;;) {
    const rows = await prisma.manifiesto.findMany({ where: { isDemoData: false,
      estado: { in: ['APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO'] },
      fechaFirma: { lte: new Date(now.getTime() - 23 * 86400000) } }, select: { id: true },
      orderBy: { id: 'asc' }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    for (const row of rows) await prisma.$transaction(async tx => {
      const m = await tx.manifiesto.findUnique({ where: { id: row.id }, include: {
        generador: { select: { usuario: { select: { id: true, activo: true } } } },
        transportista: { select: { usuario: { select: { id: true, activo: true } } } },
        operador: { select: { usuario: { select: { id: true, activo: true } } } },
      } });
      if (!m || m.isDemoData) return;
      const fase = signatureReminderPhase(m.fechaFirma, m.estado, now);
      if (!fase) return;
      const fechaReferencia = new Date(m.fechaFirma!.getTime() + 30 * 86400000).toISOString();
      const recipients = [m.generador, m.transportista, m.operador].flatMap(party => party?.usuario.activo ? [party.usuario.id] : []);
      // Do not classify legal lateness, modify deadlines or reopen a terminal workflow.
      const result = await tx.notificacion.createMany({ skipDuplicates: true, data: [...new Set(recipients)].map(usuarioId => ({
        id: 'firma_' + createHash('sha256').update(JSON.stringify([m.id, m.fechaFirma, fase, usuarioId])).digest('hex'),
        usuarioId, manifiestoId: m.id, tipo: 'VENCIMIENTO_PROXIMO', prioridad: 'ALTA',
        titulo: fase === 'SEMANA' ? 'Manifiesto: se acercan los 30 días desde la firma' : 'Manifiesto: 30 días desde la firma',
        mensaje: `${m.numero}. Se cumplen 30 días desde la firma el ${new Date(fechaReferencia).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' })}. Revisá el estado y coordiná las acciones pendientes. Este recordatorio no determina una infracción.`,
        datos: JSON.stringify({ tipo: 'recordatorio_firma', version: 1, fase, fechaFirma: m.fechaFirma!.toISOString(), fechaReferencia }),
      })) });
      inserted += result.count;
    });
    if (rows.length < 100) break;
    cursor = rows[rows.length - 1].id;
  }
  return inserted;
}
export function iniciarRecordatorioFirmaJob() {
  if ((process.env.NODE_APP_INSTANCE || process.env.pm_id || '0') !== '0') return;
  let running = false;
  cron.schedule('15 8 * * *', async () => {
    if (running) return; running = true;
    try { await ejecutarRecordatorioFirma(); }
    catch (error) { console.error('[RecordatorioFirma] No se completó el recordatorio', error); }
    finally { running = false; }
  }, { timezone: 'America/Argentina/Mendoza' });
}
