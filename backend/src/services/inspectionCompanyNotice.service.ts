import { createHash } from 'node:crypto';
import type { Prisma, TipoActorInspeccion } from '@prisma/client';
import { empresaEnabled } from '../domain/empresa';
import { INSPECTION_AGENDA_LABELS, INSPECTION_EXCHANGE_LABELS } from '../domain/inspectionNoticeLabels';
import { isTrainingSession } from '../lib/trainingScope';
import { PARTICIPANT_VISIBLE_STATES } from './inspectionExchange.service';

type InspectionRef = { id: string; tipoActor: TipoActorInspeccion | null; generadorId?: string | null;
  transportistaId?: string | null; operadorId?: string | null };
type Access = { empresaId: string; actividadId: string; rol: TipoActorInspeccion; razonSocial: string; actorId: string; autorizacionId: string };
type Recipient = { usuarioId: string; access: Access };
type Notice = { usuarioId?: string; tipo?: string; titulo?: string; mensaje?: string; datos: string | null };
type Reference = { tipo: 'psip_empresa'; version: 1; clase: 'intercambio' | 'agenda'; referencia: string; autorizacionId: string };
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const roleNames = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transportista', OPERADOR: 'Operador' } as const;
const participantAgenda = new Set(['NOTIFICADA', 'EN_TRAMITE_LEGAL', 'FINALIZADA']);

function actorReference(inspection: InspectionRef): { rol: TipoActorInspeccion; actorId: string } | null {
  const rol = inspection.tipoActor;
  if (!rol) return null;
  const actorId = rol === 'GENERADOR' ? inspection.generadorId : rol === 'TRANSPORTISTA' ? inspection.transportistaId : inspection.operadorId;
  return safeId(actorId) ? { rol, actorId } : null;
}

/** Inspections do not identify an authorized establishment. Only a current
 * company-wide grant can give an additional person access to the requirement. */
export async function inspectionCompanyRecipientsBatch(db: Prisma.TransactionClient, inspections: InspectionRef[], userIds?: string[]): Promise<Map<string, Recipient[]>> {
  const result = new Map<string, Recipient[]>();
  if (!empresaEnabled() || isTrainingSession() || !inspections.length || userIds?.length === 0) return result;
  const refs = [...new Map(inspections.flatMap(i => {
    const ref = actorReference(i); return ref ? [[ref.rol + ':' + ref.actorId, ref] as const] : [];
  })).values()];
  if (!refs.length) return result;
  const activities = await db.empresaActividad.findMany({ where: { activa: true, OR: refs } });
  if (!activities.length) return result;
  const companyIds = [...new Set(activities.map(a => a.empresaId))];
  const ids = (role: TipoActorInspeccion) => [...new Set(refs.filter(r => r.rol === role).map(r => r.actorId))];
  const [companies, grants, generators, carriers, operators] = await Promise.all([
    db.empresa.findMany({ where: { id: { in: companyIds }, activa: true }, select: { id: true, cuit: true, razonSocial: true } }),
    db.autorizacionEmpresa.findMany({ where: { actividadId: { in: activities.map(a => a.id) }, activa: true, todosEstablecimientos: true,
      ...(userIds ? { usuarioId: { in: [...new Set(userIds)] } } : {}) }, select: { id: true, empresaId: true, actividadId: true, usuarioId: true } }),
    db.generador.findMany({ where: { id: { in: ids('GENERADOR') } }, select: { id: true, activo: true, cuit: true } }),
    db.transportista.findMany({ where: { id: { in: ids('TRANSPORTISTA') } }, select: { id: true, activo: true, cuit: true } }),
    db.operador.findMany({ where: { id: { in: ids('OPERADOR') } }, select: { id: true, activo: true, cuit: true } }),
  ]);
  const users = grants.length ? await db.usuario.findMany({ where: { id: { in: [...new Set(grants.map(g => g.usuarioId))] },
    activo: true, emailVerified: true, rol: { in: ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] } }, select: { id: true } }) : [];
  const userSet = new Set(users.map(u => u.id));
  const companyById = new Map(companies.map(c => [c.id, c]));
  const actorByRef = new Map<string, { activo: boolean; cuit: string }>([
    ...generators.map(a => ['GENERADOR:' + a.id, a] as const),
    ...carriers.map(a => ['TRANSPORTISTA:' + a.id, a] as const),
    ...operators.map(a => ['OPERADOR:' + a.id, a] as const),
  ]);
  const activityByRef = new Map(activities.map(a => [a.rol + ':' + a.actorId, a]));
  const grantsByActivity = new Map<string, typeof grants>();
  for (const grant of grants) grantsByActivity.set(grant.actividadId, [...(grantsByActivity.get(grant.actividadId) || []), grant]);
  for (const inspection of inspections) {
    const ref = actorReference(inspection);
    if (!ref) continue;
    const activity = activityByRef.get(ref.rol + ':' + ref.actorId);
    const company = activity && companyById.get(activity.empresaId);
    const actor = actorByRef.get(ref.rol + ':' + ref.actorId);
    // Match the authorization middleware exactly: a malformed company CUIT
    // cannot produce an invitation that the recipient would be unable to open.
    if (!activity || !company || !actor?.activo || actor.cuit.replace(/\D/g, '') !== company.cuit) continue;
    result.set(inspection.id, (grantsByActivity.get(activity.id) || []).filter(g => g.empresaId === company.id && userSet.has(g.usuarioId))
      .map(g => ({ usuarioId: g.usuarioId, access: { empresaId: company.id, actividadId: activity.id, rol: ref.rol,
        razonSocial: company.razonSocial, actorId: ref.actorId, autorizacionId: g.id } })));
  }
  return result;
}

/** Store no case number, deadline, actor or free text: mutation responses are
 * deliberately generic even when an authorization is revoked concurrently. */
export async function inspectionCompanyNoticeRows(db: Prisma.TransactionClient, inspection: InspectionRef,
  reference: { clase: Reference['clase']; id: string; autorId: string }, exclude: string[]) {
  if (!safeId(reference.id)) return [];
  const recipients = (await inspectionCompanyRecipientsBatch(db, [inspection])).get(inspection.id) || [];
  const omitted = new Set([...exclude, reference.autorId]);
  return recipients.filter(r => !omitted.has(r.usuarioId)).map(r => ({
    id: createHash('sha256').update(JSON.stringify(['psip-empresa-v1', reference.clase, reference.id, r.usuarioId])).digest('hex'),
    usuarioId: r.usuarioId, tipo: 'INFO_GENERAL' as const, prioridad: 'NORMAL' as const,
    titulo: 'Aviso para tu empresa', mensaje: 'Consultá tus avisos para conocer la información disponible.',
    datos: JSON.stringify({ tipo: 'psip_empresa', version: 1, clase: reference.clase,
      referencia: reference.id, autorizacionId: r.access.autorizacionId } satisfies Reference),
  }));
}

function parseReference(raw: string | null): Reference | null {
  try {
    const d = JSON.parse(raw || 'null');
    return d && d.tipo === 'psip_empresa' && d.version === 1 && ['intercambio', 'agenda'].includes(d.clase)
      && safeId(d.referencia) && safeId(d.autorizacionId) ? d : null;
  } catch { return null; }
}
function isPrivateInspectionNotice(raw: string | null): boolean {
  try { return JSON.parse(raw || 'null')?.tipo === 'psip_empresa'; } catch { return false; }
}
function unavailable<T extends Notice>(notice: T): T {
  return { ...notice, titulo: 'Aviso no disponible', mensaje: 'Tu acceso a esta información ya no está disponible. Revisá tus autorizaciones.',
    datos: JSON.stringify({ tipo: 'alerta_empresa_no_disponible', version: 1 }) };
}

/** Reconstruct an own notice only from its current grant and its immutable
 * source event. A revoked grant never returns the case, deadline or link. */
export async function withInspectionCompanyNoticeContext<T extends Notice>(db: Prisma.TransactionClient, notices: T[]): Promise<T[]> {
  const refs = notices.map(n => n.tipo === 'INFO_GENERAL' ? parseReference(n.datos) : null);
  if (!refs.some(Boolean)) return notices.map(n => isPrivateInspectionNotice(n.datos) ? unavailable(n) : n);
  const exchangeIds = refs.flatMap(r => r?.clase === 'intercambio' ? [r.referencia] : []);
  const agendaIds = refs.flatMap(r => r?.clase === 'agenda' ? [r.referencia] : []);
  const [exchanges, events] = await Promise.all([
    exchangeIds.length ? db.intercambioInspeccion.findMany({ where: { id: { in: [...new Set(exchangeIds)] } }, select: {
      id: true, inspeccionId: true, secuencia: true, tipo: true, parte: true, destinatario: true, autorId: true, plazoRespuestaAt: true } }) : [],
    agendaIds.length ? db.eventoInspeccion.findMany({ where: { id: { in: [...new Set(agendaIds)] } }, select: {
      id: true, inspeccionId: true, tipo: true, estadoHasta: true, metadata: true, usuarioId: true } }) : [],
  ]);
  const inspectionIds = [...new Set([...exchanges.map(e => e.inspeccionId), ...events.map(e => e.inspeccionId)])];
  const inspections = inspectionIds.length ? await db.inspeccion.findMany({ where: { id: { in: inspectionIds } }, select: {
    id: true, numero: true, estado: true, tipoActor: true, generadorId: true, transportistaId: true, operadorId: true } }) : [];
  const eligible = await inspectionCompanyRecipientsBatch(db, inspections.filter(i => PARTICIPANT_VISIBLE_STATES.includes(i.estado)),
    [...new Set(notices.map(n => n.usuarioId).filter(safeId))]);
  const exchangeById = new Map(exchanges.map(e => [e.id, e]));
  const eventById = new Map(events.map(e => [e.id, e]));
  const inspectionById = new Map(inspections.map(i => [i.id, i]));
  return notices.map((notice, index) => {
    const ref = refs[index];
    if (!ref) return isPrivateInspectionNotice(notice.datos) ? unavailable(notice) : notice;
    const exchange = ref.clase === 'intercambio' ? exchangeById.get(ref.referencia) : undefined;
    const event = ref.clase === 'agenda' ? eventById.get(ref.referencia) : undefined;
    const inspection = inspectionById.get(exchange?.inspeccionId || event?.inspeccionId || '');
    const match = inspection && notice.usuarioId && (eligible.get(inspection.id) || [])
      .find(r => r.usuarioId === notice.usuarioId && r.access.autorizacionId === ref.autorizacionId);
    const data = event?.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata) ? event.metadata as Record<string, unknown> : {};
    const agendaType = typeof data.avisoAgenda === 'string' ? data.avisoAgenda : '';
    const validExchange = exchange && exchange.parte === 'AUTORIDAD' && exchange.destinatario === 'INSPECCIONADO'
      && exchange.autorId !== notice.usuarioId && Object.prototype.hasOwnProperty.call(INSPECTION_EXCHANGE_LABELS, exchange.tipo);
    const validAgenda = event && event.tipo === 'CAMBIO_ESTADO' && event.usuarioId !== notice.usuarioId
      && event.estadoHasta === agendaType && participantAgenda.has(agendaType);
    if (!inspection || !inspection.tipoActor || !match || !(validExchange || validAgenda)) return unavailable(notice);
    const { autorizacionId: _grant, ...access } = match.access;
    const common = { version: 1, inspeccionId: inspection.id, numero: inspection.numero, destino: 'participacion',
      tipoActor: inspection.tipoActor, correoVersion: 1, representacionVersion: 1, accesosEmpresa: [access] };
    if (validExchange && exchange) {
      const [title, action] = INSPECTION_EXCHANGE_LABELS[exchange.tipo];
      const deadline = exchange.plazoRespuestaAt ? ' Plazo para responder: ' + exchange.plazoRespuestaAt.toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' }) + '.' : '';
      return { ...notice, titulo: 'PSIP · ' + title, mensaje: `${roleNames[inspection.tipoActor]} · ${inspection.numero} · Actuación #${exchange.secuencia}. ${action}${deadline}`,
        datos: JSON.stringify({ ...common, tipo: 'intercambio_inspeccion', intercambioId: exchange.id, secuencia: exchange.secuencia,
          evento: exchange.tipo, parte: exchange.parte, ...(exchange.plazoRespuestaAt ? { plazoRespuestaAt: exchange.plazoRespuestaAt.toISOString() } : {}) }) };
    }
    const agendaLabel = INSPECTION_AGENDA_LABELS[agendaType as keyof typeof INSPECTION_AGENDA_LABELS];
    return { ...notice, titulo: 'PSIP · ' + agendaLabel[0], mensaje: `${inspection.numero} · ${agendaLabel[1]}`,
      datos: JSON.stringify({ ...common, tipo: 'agenda_inspeccion', eventoId: event!.id, evento: agendaType }) };
  });
}
