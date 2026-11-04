import { mayRegisterScheduledJob } from '../config/scheduledTaskGate';
import cron from 'node-cron';
import { createHash } from 'node:crypto';
import prisma from '../lib/prisma';
import { isTrainingSession } from '../lib/trainingScope';
import { manifestCompanyRecipients, type ManifestCompanyAccess } from '../services/manifestCompanyRecipients.service';

export function signatureReminderPhase(signedAt: Date | null, state: string, now: Date): 'SEMANA' | 'TREINTA_DIAS' | null {
  if (!signedAt || ['BORRADOR', 'PENDIENTE_APROBACION', 'TRATADO', 'CANCELADO', 'RECHAZADO'].includes(state)) return null;
  const elapsed = (now.getTime() - signedAt.getTime()) / 86400000;
  return elapsed >= 30 ? 'TREINTA_DIAS' : elapsed >= 23 ? 'SEMANA' : null;
}

/** Only durable internal notices. Delivery remains behind existing explicit gates. */
export async function ejecutarRecordatorioFirma(now = new Date()): Promise<number> {
  if (isTrainingSession()) return 0;
  let cursor: string | undefined, inserted = 0, failures = 0;
  for (;;) {
    const rows = await prisma.manifiesto.findMany({ where: { isDemoData: false,
      estado: { in: ['APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO'] },
      fechaFirma: { lte: new Date(now.getTime() - 23 * 86400000) } }, select: { id: true },
      orderBy: { id: 'asc' }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    for (const row of rows) try {
      const count = await prisma.$transaction(async tx => {
        // Serialize with a terminal workflow update before deciding whether the
        // reminder is still applicable. An unlocked snapshot could announce an
        // open manifest after a concurrent closure committed.
        const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM manifiestos WHERE id = ${row.id} FOR UPDATE`;
        if (!locked.length) return 0;
        const m = await tx.manifiesto.findUnique({ where: { id: row.id }, include: {
          generador: { select: { usuario: { select: { id: true, activo: true } } } },
          transportista: { select: { usuario: { select: { id: true, activo: true } } } },
          operador: { select: { usuario: { select: { id: true, activo: true } } } },
        } });
        if (!m || m.isDemoData) return 0;
        const fase = signatureReminderPhase(m.fechaFirma, m.estado, now);
        if (!fase) return 0;
        const fechaReferencia = new Date(m.fechaFirma!.getTime() + 30 * 86400000).toISOString();
        const recipients = new Set([m.generador, m.transportista, m.operador].flatMap(party => party?.usuario.activo ? [party.usuario.id] : []));
        const companyAccesses = new Map<string, ManifestCompanyAccess[]>();
        for (const recipient of await manifestCompanyRecipients(tx, m.id)) {
          if (!recipients.has(recipient.usuarioId) && recipient.accesosEmpresa.length) {
            recipients.add(recipient.usuarioId);
            companyAccesses.set(recipient.usuarioId, recipient.accesosEmpresa);
          }
        }
        // Do not classify legal lateness, modify deadlines or reopen a terminal workflow.
        const result = await tx.notificacion.createMany({ skipDuplicates: true, data: [...recipients].map(usuarioId => ({
          id: 'firma_' + createHash('sha256').update(JSON.stringify([m.id, m.fechaFirma, fase, usuarioId])).digest('hex'),
          usuarioId, manifiestoId: m.id, tipo: 'VENCIMIENTO_PROXIMO', prioridad: 'ALTA',
          titulo: fase === 'SEMANA' ? 'Manifiesto: se acercan los 30 días desde la firma' : 'Manifiesto: 30 días desde la firma',
          mensaje: `${m.numero}. Se cumplen 30 días desde la firma el ${new Date(fechaReferencia).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' })}. Revisá el estado y coordiná las acciones pendientes. Este recordatorio no determina una infracción.`,
          datos: JSON.stringify({ tipo: 'recordatorio_firma', version: 1, fase, fechaFirma: m.fechaFirma!.toISOString(), fechaReferencia,
            ...(companyAccesses.has(usuarioId) ? { destino: 'representante', accesosEmpresa: companyAccesses.get(usuarioId) } : {}) }),
        })) });
        return result.count;
      });
      inserted += count;
    } catch (error) {
      // One locked or unavailable manifest must not suppress the rest of the
      // sweep. Signal the incomplete run so the operational log records it.
      failures++;
      console.error('[RecordatorioFirma] No se pudo evaluar un manifiesto', row.id, error);
    }
    if (rows.length < 100) break;
    cursor = rows[rows.length - 1].id;
  }
  if (failures) throw new Error(`Evaluación de recordatorios incompleta: ${failures} manifiesto(s) no evaluados`);
  return inserted;
}
export function iniciarRecordatorioFirmaJob() {
  if (!mayRegisterScheduledJob('manifestSignatureReminder')) return;
  let running = false;
  cron.schedule('15 8 * * *', async () => {
    if (running) return; running = true;
    try { await ejecutarRecordatorioFirma(); }
    catch (error) { console.error('[RecordatorioFirma] No se completó el recordatorio', error); }
    finally { running = false; }
  }, { timezone: 'America/Argentina/Mendoza' });
}
