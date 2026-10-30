import cron from 'node-cron';
import { createHash } from 'node:crypto';
import prisma from '../lib/prisma';
import { isTrainingSession } from '../lib/trainingScope';
import { OPERATION_REMINDER_WINDOW_MS, operationReminderDate, operationReminderText } from '../domain/operationReminder';
import { manifestCompanyRecipients, type ManifestCompanyAccess } from '../services/manifestCompanyRecipients.service';
import { scheduleCommittedManifestPush } from '../services/committed-manifest-push.service';

export function iniciarRecordatorioJob(): void {
  const instanceId = process.env.NODE_APP_INSTANCE || process.env.pm_id || '0';
  if (instanceId !== '0') return;
  cron.schedule('0 */6 * * *', async () => {
    try { await ejecutarRecordatorios(); }
    catch (error) { console.error('[RecordatorioJob] Evaluación incompleta:', error); }
  });
}

/** The prior notice was not per recipient. Only use its date to avoid repeating
 * a legacy FIJO reminder to the same person; it did not cover other people. */
function legacyRecipient(data: string | null, date: string): boolean {
  try { const parsed = JSON.parse(data || 'null'); return parsed?.tipo === 'recordatorio_retiro' && parsed.fechaRetiro === date; }
  catch { return false; }
}

/** Save each notice atomically with its current manifest state. The old inbox
 * is retained, and outside channels remain behind their existing gates. */
export async function ejecutarRecordatorios(now = new Date()): Promise<number> {
  if (isTrainingSession()) return 0;
  if (!Number.isFinite(now.getTime())) throw new Error('Fecha de evaluación inválida');
  const until = new Date(now.getTime() + OPERATION_REMINDER_WINDOW_MS);
  let cursor: string | undefined, manifests = 0, failures = 0;
  for (;;) {
    const rows = await prisma.manifiesto.findMany({ where: { isDemoData: false, estado: 'APROBADO',
      fechaEstimadaRetiro: { gte: now, lte: until } }, select: { id: true }, orderBy: { id: 'asc' }, take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    for (const row of rows) {
      try {
        const result = await prisma.$transaction(async tx => {
          const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM manifiestos WHERE id = ${row.id} FOR UPDATE`;
          if (!locked.length) return { count: 0, pushIds: [] as string[] };
          const m = await tx.manifiesto.findUnique({ where: { id: row.id }, include: {
            generador: { include: { usuario: true } }, transportista: { include: { usuario: true } }, operador: { include: { usuario: true } },
          } });
          const date = m?.fechaEstimadaRetiro;
          if (!m || m.isDemoData || m.estado !== 'APROBADO' || !date || date < now || date > until
            || (m.modalidad !== 'FIJO' && m.modalidad !== 'IN_SITU')) return { count: 0, pushIds: [] as string[] };
          const fecha = operationReminderDate(date), label = operationReminderText(m.modalidad, m.numero, fecha);
          const recipients = new Set([m.generador, m.transportista, m.operador].flatMap(party => party?.activo && party.usuario.activo ? [party.usuario.id] : []));
          const company = new Map<string, ManifestCompanyAccess[]>();
          for (const recipient of await manifestCompanyRecipients(tx, m.id)) {
            if (!recipients.has(recipient.usuarioId) && recipient.accesosEmpresa.length) {
              recipients.add(recipient.usuarioId); company.set(recipient.usuarioId, recipient.accesosEmpresa);
            }
          }
          const old = m.modalidad === 'FIJO' ? await tx.notificacion.findMany({ where: { manifiestoId: m.id,
            datos: { contains: 'recordatorio_retiro' } }, select: { usuarioId: true, datos: true } }) : [];
          const legacyUsers = new Set(old.filter(item => legacyRecipient(item.datos, fecha)).map(item => item.usuarioId));
          const context = m.contextoEmpresa as { rol?: string; establecimientoId?: string | null;
            establecimiento?: { id?: string; latitud?: unknown; longitud?: unknown } } | null;
          const site = context?.rol === 'GENERADOR' && context.establecimientoId
            && context.establecimiento?.id === context.establecimientoId ? context.establecimiento : null;
          const useActor = !context || ['TRANSPORTISTA', 'OPERADOR'].includes(context.rol || '');
          const lat = site ? site.latitud : useActor ? m.generador.latitud : null;
          const lng = site ? site.longitud : useActor ? m.generador.longitud : null;
          const mapsUrl = m.modalidad === 'FIJO' && typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
            && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? `https://maps.google.com/?q=${lat},${lng}` : null;
          const notices = [...recipients].filter(usuarioId => !legacyUsers.has(usuarioId)).map(usuarioId => ({
            id: 'operacion_' + createHash('sha256').update(JSON.stringify([m.id, m.modalidad, fecha, usuarioId])).digest('hex'),
            usuarioId, manifiestoId: m.id, tipo: 'ALERTA_SISTEMA' as const, prioridad: 'ALTA' as const, ...label,
            datos: JSON.stringify({ tipo: 'recordatorio_operacion', version: 1, modalidad: m.modalidad, fechaDia: fecha,
              ...(mapsUrl && usuarioId === m.transportista?.usuario.id ? { mapsUrl } : {}),
              ...(company.has(usuarioId) ? { destino: 'representante', accesosEmpresa: company.get(usuarioId) } : {}) }),
          }));
          if (!notices.length) return { count: 0, pushIds: [] as string[] };
          const existing = await tx.notificacion.findMany({ where: { id: { in: notices.map(item => item.id) } }, select: { id: true } });
          const seen = new Set(existing.map(item => item.id)), fresh = notices.filter(item => !seen.has(item.id));
          if (!fresh.length) return { count: 0, pushIds: [] as string[] };
          const inserted = await tx.notificacion.createMany({ data: fresh, skipDuplicates: true });
          return { count: inserted.count, pushIds: inserted.count === fresh.length ? fresh.map(item => item.id) : [] };
        });
        if (result.count) manifests++;
        if (result.pushIds.length) scheduleCommittedManifestPush(result.pushIds);
      } catch (error) {
        failures++; console.error('[RecordatorioJob] No se pudo evaluar un manifiesto', row.id, error);
      }
    }
    if (rows.length < 100) break;
    cursor = rows[rows.length - 1].id;
  }
  if (failures) throw new Error(`Evaluación de recordatorios incompleta: ${failures} manifiesto(s) no evaluados`);
  return manifests;
}
