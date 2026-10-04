import cron from 'node-cron';
import { createHash } from 'node:crypto';
import prisma from '../lib/prisma';
import { FOLLOWUP_RULE_ID, FOLLOWUP_CONDITION, followupDays, validateFollowupRule } from '../services/alertFollowupPolicy.service';

/** Read-only preview. Counts every matching manifest; keeps only twenty sample rows. */
export async function simularSeguimientoCierre(diasRecepcion: number, now = new Date()) {
  followupDays(JSON.stringify({ tipo: 'seguimiento_cierre', diasRecepcion: { gte: diasRecepcion } }));
  const where = { estado: { in: ['RECIBIDO', 'EN_TRATAMIENTO'] as ('RECIBIDO' | 'EN_TRATAMIENTO')[] },
    operador: { usuario: { activo: true } },
    ...(diasRecepcion > 0 ? { fechaRecepcion: { lte: new Date(now.getTime() - diasRecepcion * 86400000) } } : {}) };
  const [total, ejemplos] = await Promise.all([
    prisma.manifiesto.count({ where }),
    prisma.manifiesto.findMany({ where, select: { id: true, numero: true, estado: true, fechaRecepcion: true }, orderBy: { id: 'asc' }, take: 20 }),
  ]);
  return { total, ejemplos, evaluadoAt: now.toISOString(), diasRecepcion, canal: 'interno', escribeDatos: false };
}

/** Internal follow-up, not a late/legal classification. Never invokes a delivery provider. */
export async function ejecutarSeguimientoCierre(now = new Date()): Promise<number> {
  // Adopt the already enabled operational follow-up into the repository once.
  // No startup scan, migration or external provider. Subsequent sweeps respect its switch.
  const existing = await prisma.reglaAlerta.findUnique({ where: { id: FOLLOWUP_RULE_ID } });
  if (!existing) {
    const admin = await prisma.usuario.findFirst({ where: { rol: 'ADMIN', activo: true }, orderBy: { id: 'asc' }, select: { id: true } });
    if (!admin) throw new Error('Seguimiento sin administrador activo para registrar su regla');
    await prisma.reglaAlerta.upsert({ where: { id: FOLLOWUP_RULE_ID }, update: {}, create: {
      id: FOLLOWUP_RULE_ID, nombre: 'Seguimiento de manifiesto',
      descripcion: 'Revisión operativa de recepción, tratamiento y cierre. No determina mora ni plazo legal.',
      evento: 'TIEMPO_EXCESIVO', condicion: FOLLOWUP_CONDITION, destinatarios: '["OPERADOR"]', creadoPorId: admin.id,
    } });
  }
  const rules = (await prisma.reglaAlerta.findMany({ where: { evento: 'TIEMPO_EXCESIVO', activa: true } }))
    .flatMap(rule => {
      const days = followupDays(rule.condicion);
      if (days === null) return [];
      validateFollowupRule(rule.evento, rule.condicion, rule.destinatarios);
      return [{ ...rule, days, roles: JSON.parse(rule.destinatarios) as string[] }];
    });
  // Closing the source resolves its open operational cases, without deleting their history.
  await prisma.alertaGenerada.updateMany({ where: { reglaId: { in: rules.map(rule => rule.id) },
    estado: { in: ['PENDIENTE', 'EN_REVISION'] }, manifiesto: { estado: { in: ['TRATADO', 'CANCELADO'] } } },
    data: { estado: 'RESUELTA', notas: 'El manifiesto alcanzó un estado terminal; conciliación automática.', fechaResolucion: now, resueltaPor: null } });
  if (!rules.length) return 0;
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
        const received = m.fechaRecepcion;
        const days = received && received.getTime() <= now.getTime() ? Math.floor((now.getTime() - received.getTime()) / 86400000) : null;
        const action = m.estado === 'RECIBIDO' ? 'Revisá el pesaje y registrá el tratamiento o el cierre permitido.' : 'Completá el tratamiento y el cierre cuando corresponda.';
        const message = `${m.numero} · Evaluado el ${now.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' })}. ${days === null ? 'Sin fecha de recepción válida registrada.' : `Recibido hace ${days} día${days === 1 ? '' : 's'}.`} ${action}`;
        for (const rule of rules) {
          if (rule.days > 0 && (days === null || days < rule.days)) continue;
          const casoId = 'caso_' + createHash('sha256').update(JSON.stringify([rule.id, m.id, m.estado, 1])).digest('hex');
          const snapshot = { tipo: 'seguimiento_cierre', version: 1, estadoDetectado: m.estado,
            fechaRecepcion: received?.toISOString() ?? null, evaluadoAt: now.toISOString(), descripcion: message, diasRecepcion: days };
          // Preserve the first observed facts as history, including on resolved cases.
          const caso = await tx.alertaGenerada.upsert({ where: { id: casoId },
            create: { id: casoId, reglaId: rule.id, manifiestoId: m.id, datos: JSON.stringify(snapshot) }, update: {} });
          if (['RESUELTA', 'DESCARTADA'].includes(caso.estado)) continue;
          const recipients = rule.roles.includes('OPERADOR') ? [userId] : [];
          const adminRoles = rule.roles.filter(role => role !== 'OPERADOR') as ('ADMIN' | 'ADMIN_OPERADOR')[];
          if (adminRoles.length) recipients.push(...(await tx.usuario.findMany({ where: { rol: { in: adminRoles }, activo: true }, select: { id: true } })).map(user => user.id));
          for (const recipient of new Set(recipients)) {
            // Keep the original default operator key: adoption must not duplicate existing notices.
            const key = rule.id === FOLLOWUP_RULE_ID ? [m.id, recipient, m.estado, 1] : [rule.id, m.id, recipient, m.estado, 1];
            const id = 'seguimiento_' + createHash('sha256').update(JSON.stringify(key)).digest('hex');
            const data = {
              usuarioId: recipient, manifiestoId: m.id, tipo: 'INFO_GENERAL' as const, prioridad: 'NORMAL' as const,
              titulo: rule.nombre, mensaje: message,
              datos: JSON.stringify({ ...snapshot, casoId, reglaId: rule.id }),
            };
            // Unique deterministic primary key is safe across retries/workers. Preserve read state.
            await tx.notificacion.upsert({ where: { id }, create: { id, ...data }, update: data });
            checked++;
          }
        }
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
