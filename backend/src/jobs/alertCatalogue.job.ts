import cron from 'node-cron';
import { createHash } from 'node:crypto';
import { Prisma, Rol, type ReglaAlerta } from '@prisma/client';
import prisma from '../lib/prisma';
import { catalogueCondition, validateCatalogueRule, requirementSituation, expirySituation, CATALOGUE_MARKER, type CatalogueCondition, type ExpiryEntity } from '../services/alertCataloguePolicy.service';
import { exchangePartyForUser } from '../services/inspectionExchange.service';

const requirementInclude = {
  respuestas: { select: { tipo: true, parte: true } },
  inspeccion: { include: { inspector: true, generador: { include: { usuario: true } }, transportista: { include: { usuario: true } }, operador: { include: { usuario: true } } } },
} satisfies Prisma.IntercambioInspeccionInclude;
type RequestRecord = Prisma.IntercambioInspeccionGetPayload<{ include: typeof requirementInclude }>;
type Facts = { familia: 'catalogo_verificable'; version: 1; tipo: CatalogueCondition['tipo']; entidad: string; entidadId: string;
  vencimiento: string; tipoActor: string | null; actorId: string | null; inspeccionId?: string; numero: string; descripcion: string; estadoDetectado: string };
type Source = { facts: Facts; ownerId: string | null; inspectorId?: string };

function requestSource(record: RequestRecord | null, now: Date): Source | null {
  if (!record || requirementSituation(record, now) !== 'PENDIENTE') return null;
  const inspection = record.inspeccion;
  const actor = inspection.tipoActor === 'GENERADOR' ? inspection.generador : inspection.tipoActor === 'TRANSPORTISTA' ? inspection.transportista : inspection.tipoActor === 'OPERADOR' ? inspection.operador : null;
  const ownerId = actor?.activo && actor.usuario.activo ? actor.usuario.id : null;
  return { ownerId, inspectorId: inspection.inspector.activo && exchangePartyForUser(inspection.inspector, inspection) === 'AUTORIDAD' ? inspection.inspectorId : undefined,
    facts: { familia: 'catalogo_verificable', version: 1, tipo: 'requerimiento_inspeccion', entidad: 'REQUERIMIENTO', entidadId: record.id,
      vencimiento: record.plazoRespuestaAt!.toISOString(), tipoActor: inspection.tipoActor, actorId: actor?.id ?? null,
      inspeccionId: inspection.id, numero: inspection.numero, estadoDetectado: 'SIN_RESPUESTA',
      descripcion: `${inspection.numero} · ${record.asunto}. Plazo registrado: ${record.plazoRespuestaAt!.toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza', hour12: false })} (Mendoza). Sin respuesta del inspeccionado vinculada a este requerimiento. Responder no equivale a subsanación aceptada.` } };
}

async function expirySource(tx: Prisma.TransactionClient, entity: ExpiryEntity, id: string, days: number, now: Date): Promise<Source | null> {
  let date: Date | null; let active: boolean; let owner: { id: string; usuarioId: string; activo: boolean; usuario: { activo: boolean } };
  let name: string; let category: string;
  if (entity === 'TRANSPORTISTA' || entity === 'OPERADOR') {
    const include = { usuario: { select: { activo: true } } };
    const record = entity === 'TRANSPORTISTA' ? await tx.transportista.findUnique({ where: { id }, include }) : await tx.operador.findUnique({ where: { id }, include });
    if (!record) return null;
    date = record.vencimientoHabilitacion; active = record.activo; owner = record; name = record.razonSocial; category = entity;
  } else {
    const include = { transportista: { include: { usuario: { select: { activo: true } } } } };
    const record = entity === 'VEHICULO' ? await tx.vehiculo.findUnique({ where: { id }, include }) : await tx.chofer.findUnique({ where: { id }, include });
    if (!record) return null;
    date = record.vencimiento; active = record.activo; owner = record.transportista; category = 'TRANSPORTISTA';
    name = 'patente' in record ? record.patente : `${record.nombre} ${record.apellido}`;
  }
  const situation = expirySituation(date, active && owner.activo && owner.usuario.activo, days, now);
  if (situation === 'FUERA_DE_ALCANCE') return null;
  return { ownerId: owner.usuarioId, facts: { familia: 'catalogo_verificable', version: 1, tipo: 'vencimiento_documental', entidad: entity, entidadId: id,
    vencimiento: date!.toISOString(), tipoActor: category, actorId: owner.id, numero: name, estadoDetectado: situation,
    descripcion: `${name} · ${entity === 'CHOFER' ? 'Licencia' : 'Habilitación'}: fecha registrada ${date!.toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza', hour12: false })} (Mendoza). ${situation === 'VENCIDO' ? 'Fecha registrada alcanzada; revisar vigencia y renovación.' : 'Próxima a vencer; revisar renovación.'} No determina una sanción automáticamente.` } };
}

function caseId(ruleId: string, facts: Facts): string {
  // Deadline/source identity, not current clock or status: no daily repeated cases.
  return 'catalogo_' + createHash('sha256').update(JSON.stringify([ruleId, facts.tipo, facts.entidad, facts.entidadId, facts.vencimiento, facts.tipoActor, facts.actorId, 1])).digest('hex');
}

async function sources(condition: CatalogueCondition, now: Date, visit: (source: Source) => Promise<void>): Promise<void> {
  if (condition.tipo === 'requerimiento_inspeccion') {
    let cursor: string | undefined;
    for (;;) {
      const batch = await prisma.intercambioInspeccion.findMany({ where: { tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', destinatario: 'INSPECCIONADO', plazoRespuestaAt: { lt: now },
        inspeccion: { estado: { in: ['NOTIFICADA', 'EN_DESCARGO', 'REQUIERE_SUBSANACION'] } },
        respuestas: { none: { parte: 'INSPECCIONADO', tipo: { in: ['RESPUESTA', 'DESCARGO', 'SUBSANACION'] } } } },
        select: { id: true }, take: 100, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      for (const row of batch) {
        const source = requestSource(await prisma.intercambioInspeccion.findUnique({ where: { id: row.id }, include: requirementInclude }), now);
        if (source) await visit(source);
      }
      if (batch.length < 100) break;
      cursor = batch[batch.length - 1].id;
    }
  } else {
    for (const entity of condition.entidades) {
      let cursor: string | undefined;
      for (;;) {
        const page = { select: { id: true }, take: 100, orderBy: { id: 'asc' as const }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) };
        const date = { lte: new Date(now.getTime() + condition.anticipacionDias * 86400000) };
        const batch = entity === 'TRANSPORTISTA' ? await prisma.transportista.findMany({ ...page, where: { activo: true, vencimientoHabilitacion: date } })
          : entity === 'OPERADOR' ? await prisma.operador.findMany({ ...page, where: { activo: true, vencimientoHabilitacion: date } })
          : entity === 'VEHICULO' ? await prisma.vehiculo.findMany({ ...page, where: { activo: true, vencimiento: date } })
          : await prisma.chofer.findMany({ ...page, where: { activo: true, vencimiento: date } });
        for (const row of batch) { const source = await expirySource(prisma, entity, row.id, condition.anticipacionDias, now); if (source) await visit(source); }
        if (batch.length < 100) break;
        cursor = batch[batch.length - 1].id;
      }
    }
  }
}

async function currentSource(tx: Prisma.TransactionClient, facts: Facts, condition: CatalogueCondition, now: Date): Promise<Source | null> {
  return condition.tipo === 'requerimiento_inspeccion'
    ? requestSource(await tx.intercambioInspeccion.findUnique({ where: { id: facts.entidadId }, include: requirementInclude }), now)
    : condition.entidades.includes(facts.entidad as ExpiryEntity) ? expirySource(tx, facts.entidad as ExpiryEntity, facts.entidadId, condition.anticipacionDias, now) : null;
}

async function ruleStillEnabled(tx: Prisma.TransactionClient, rule: ReglaAlerta): Promise<boolean> {
  const current = await tx.reglaAlerta.findUnique({ where: { id: rule.id }, select: { activa: true, evento: true, condicion: true, destinatarios: true } });
  return Boolean(current?.activa && current.evento === rule.evento && current.condicion === rule.condicion && current.destinatarios === rule.destinatarios);
}

export async function simularCatalogo(raw: string, now = new Date()) {
  const condition = catalogueCondition(raw);
  if (!condition) throw new Error('Familia no admitida');
  let total = 0; const ejemplos: Array<{ id: string; numero: string; estado: string; entidad: string; vencimiento: string }> = [];
  await sources(condition, now, async ({ facts }) => { total++; if (ejemplos.length < 20) ejemplos.push({ id: facts.entidadId, numero: facts.numero, estado: facts.estadoDetectado, entidad: facts.entidad, vencimiento: facts.vencimiento }); });
  return { total, ejemplos, evaluadoAt: now.toISOString(), escribeDatos: false, canal: 'interno' };
}

export async function ejecutarCatalogo(now = new Date()): Promise<number> {
  let updated = 0;
  const rules = await prisma.reglaAlerta.findMany({ where: { activa: true, evento: { in: ['TIEMPO_EXCESIVO', 'VENCIMIENTO'] } } });
  for (const rule of rules) {
    const condition = catalogueCondition(rule.condicion); if (!condition) continue;
    validateCatalogueRule(rule.evento, rule.condicion, rule.destinatarios);
    const roles = JSON.parse(rule.destinatarios) as string[];
    // Reconcile open cases from actual sources, not notification read state.
    let cursor: string | undefined;
    for (;;) {
      const cases = await prisma.alertaGenerada.findMany({ where: { reglaId: rule.id, estado: { in: ['PENDIENTE', 'EN_REVISION'] }, datos: { contains: CATALOGUE_MARKER } },
        take: 100, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      for (const item of cases) await prisma.$transaction(async tx => {
        if (!await ruleStillEnabled(tx, rule)) return;
        const facts = JSON.parse(item.datos) as Facts;
        const source = await currentSource(tx, facts, condition, now);
        if (!source || caseId(rule.id, source.facts) !== item.id) await tx.alertaGenerada.updateMany({ where: { id: item.id, estado: { in: ['PENDIENTE', 'EN_REVISION'] } },
          data: { estado: 'RESUELTA', fechaResolucion: now, resueltaPor: null,
            notas: condition.tipo === 'requerimiento_inspeccion' ? 'La ausencia de respuesta ya no se detecta: respuesta vinculada o expediente fuera de alcance. No certifica subsanación ni respuesta en término.' : 'La fecha, fuente o vigencia cambió; la condición ya no coincide. Se conserva la evidencia original.' } });
      });
      if (cases.length < 100) break;
      cursor = cases[cases.length - 1].id;
    }
    await sources(condition, now, async scanned => { await prisma.$transaction(async tx => {
      if (!await ruleStillEnabled(tx, rule)) return;
      const source = await currentSource(tx, scanned.facts, condition, now); if (!source) return;
      const { facts } = source; const id = caseId(rule.id, facts);
      // A scalar no-op update enables PostgreSQL's atomic ON CONFLICT upsert.
      // An empty update makes Prisma select then insert, which races across workers.
      // Never rewrite the original facts, creation date or administrative decision.
      const record = await tx.alertaGenerada.upsert({ where: { id }, create: { id, reglaId: rule.id, datos: JSON.stringify({ ...facts, evaluadoAt: now.toISOString() }) }, update: { id } });
      if (['RESUELTA', 'DESCARTADA'].includes(record.estado)) return;
      const ids = new Set<string>();
      if (source.ownerId && (roles.includes('INSPECCIONADO') || roles.includes(facts.tipoActor || ''))) ids.add(source.ownerId);
      if (roles.includes('INSPECTOR_ASIGNADO') && source.inspectorId) ids.add(source.inspectorId);
      const adminRoles = roles.filter(role => role === 'ADMIN' || role === `ADMIN_${facts.tipoActor}`) as Rol[];
      if (adminRoles.length) (await tx.usuario.findMany({ where: { activo: true, rol: { in: adminRoles } }, select: { id: true } })).forEach(user => ids.add(user.id));
      for (const usuarioId of ids) {
        const noticeId = 'aviso_' + createHash('sha256').update(JSON.stringify([id, usuarioId])).digest('hex');
        const participant = usuarioId === source.ownerId;
        const data = { usuarioId, tipo: 'INFO_GENERAL' as const, prioridad: 'NORMAL' as const, titulo: rule.nombre, mensaje: facts.descripcion,
          datos: JSON.stringify({ ...facts, casoId: id, reglaId: rule.id, evaluadoAt: now.toISOString(), destino: facts.inspeccionId ? (participant ? 'participacion' : 'inspeccion') : (participant ? 'perfil' : 'actor') }) };
        await tx.notificacion.upsert({ where: { id: noticeId }, create: { id: noticeId, ...data }, update: data });
        updated++;
      }
    }); });
  }
  return updated;
}

export function iniciarAlertCatalogueJob(): void {
  if ((process.env.NODE_APP_INSTANCE || process.env.pm_id || '0') !== '0') return;
  let running = false;
  cron.schedule('5 8 * * *', async () => {
    if (running) return; running = true;
    try { await ejecutarCatalogo(); } catch (error) { console.error('[AlertCatalogue] Evaluación incompleta', error); }
    finally { running = false; }
  }, { timezone: 'America/Argentina/Mendoza' });
}
