import type { Prisma } from '@prisma/client';
import { requirementSituation } from './alertCataloguePolicy.service';
import { exchangePartyForUser, PARTICIPANT_VISIBLE_STATES } from './inspectionExchange.service';
import { inspectionParticipantNoticeWhere } from './inspectionExchangeNotice.service';

type Notice = { usuarioId?: string; tipo?: string; titulo?: string; mensaje?: string; datos: string | null };
type Facts = { familia: string; version: number; tipo: string; entidad: string; entidadId: string; inspeccionId: string;
  tipoActor: string | null; actorId: string | null; vencimiento: string; casoId: string; destino: 'participacion' | 'inspeccion';
  [key: string]: unknown };
const parse = (raw: string | null): any => { try { return JSON.parse(raw || 'null'); } catch { return null; } };
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
function reference(notice: Notice): Facts | null {
  const data = parse(notice.datos);
  if (notice.tipo !== 'INFO_GENERAL' || data?.familia !== 'catalogo_verificable' || data.version !== 1
    || data.tipo !== 'requerimiento_inspeccion' || !['participacion', 'inspeccion'].includes(data.destino) || data.representacionVersion === 1) return null;
  return data as Facts;
}
function unavailable<T extends Notice>(notice: T): T {
  return { ...notice, titulo: 'Aviso no disponible', mensaje: 'Tu acceso a esta información ya no está disponible. Revisá tus autorizaciones.',
    datos: JSON.stringify({ tipo: 'alerta_no_disponible', version: 1 }) };
}

/** Update each recipient's own existing reminder at read time. Do not infer
 * subsanation from a reply or reveal new status after activity access changes. */
export async function withInspectionDeadlineDirectNoticeContext<T extends Notice>(db: Prisma.TransactionClient, notices: T[]): Promise<T[]> {
  const refs = notices.map(reference);
  if (!refs.some(Boolean)) return notices;
  const caseIds = [...new Set(refs.flatMap(ref => ref && safeId(ref.casoId) ? [ref.casoId] : []))];
  const cases = caseIds.length ? await db.alertaGenerada.findMany({ where: { id: { in: caseIds } },
    select: { id: true, datos: true, estado: true, regla: { select: { activa: true } } } }) : [];
  const caseById = new Map(cases.map(item => [item.id, item]));
  const requestIds = [...new Set(refs.flatMap(ref => ref && safeId(ref.entidadId) ? [ref.entidadId] : []))];
  const requests = requestIds.length ? await db.intercambioInspeccion.findMany({ where: { id: { in: requestIds } }, select: {
    id: true, inspeccionId: true, tipo: true, parte: true, destinatario: true, plazoRespuestaAt: true,
    respuestas: { select: { tipo: true, parte: true } }, inspeccion: { select: {
      id: true, numero: true, estado: true, inspectorId: true, tipoActor: true, generadorId: true, transportistaId: true, operadorId: true,
      generador: { select: { usuarioId: true, activo: true } }, transportista: { select: { usuarioId: true, activo: true } },
      operador: { select: { usuarioId: true, activo: true } },
    } },
  } }) : [];
  const requestById = new Map(requests.map(item => [item.id, item]));
  const participantIds = [...new Set(notices.flatMap((notice, index) => refs[index]?.destino === 'participacion' && safeId(notice.usuarioId) ? [notice.usuarioId] : []))];
  const participantRequests = new Set(refs.flatMap(ref => ref?.destino === 'participacion' ? [ref.entidadId] : []));
  const inspections = [...new Map(requests.filter(request => participantRequests.has(request.id)).map(request => [request.inspeccion.id, request.inspeccion])).values()];
  // Group by activity: one authorization query per role, not one per notice.
  const roles = ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] as const;
  const grants = new Set<string>();
  if (participantIds.length) await Promise.all(roles.map(async role => {
    const candidates = inspections.filter(inspection => inspection.tipoActor === role && PARTICIPANT_VISIBLE_STATES.includes(inspection.estado));
    const owners = candidates.map(inspectionParticipantNoticeWhere).filter((owner): owner is Prisma.UsuarioWhereInput => owner !== null);
    if (!owners.length) return;
    const users = await db.usuario.findMany({ where: { AND: [{ activo: true, id: { in: participantIds } }, { OR: owners }] }, select: {
      id: true, generador: { select: { id: true } }, transportista: { select: { id: true } }, operador: { select: { id: true } },
    } });
    for (const user of users) {
      const actor = role === 'GENERADOR' ? user.generador : role === 'TRANSPORTISTA' ? user.transportista : user.operador;
      if (actor) grants.add(JSON.stringify([role, actor.id, user.id]));
    }
  }));
  const authorityIds = [...new Set(notices.flatMap((notice, index) => refs[index]?.destino === 'inspeccion' && safeId(notice.usuarioId) ? [notice.usuarioId] : []))];
  const authorities = authorityIds.length ? await db.usuario.findMany({ where: { activo: true, id: { in: authorityIds } },
    select: { id: true, rol: true, esInspector: true } }) : [];
  const authorityById = new Map(authorities.map(user => [user.id, user]));
  return notices.map((notice, index) => {
    const ref = refs[index]; if (!ref) return notice;
    const item = safeId(ref.casoId) ? caseById.get(ref.casoId) : null;
    const original = item && parse(item.datos);
    const request = safeId(ref.entidadId) ? requestById.get(ref.entidadId) : null;
    const inspection = request?.inspeccion;
    const actor = inspection?.tipoActor === 'GENERADOR' ? inspection.generador : inspection?.tipoActor === 'TRANSPORTISTA'
      ? inspection.transportista : inspection?.tipoActor === 'OPERADOR' ? inspection.operador : null;
    const actorId = inspection?.tipoActor === 'GENERADOR' ? inspection.generadorId : inspection?.tipoActor === 'TRANSPORTISTA'
      ? inspection.transportistaId : inspection?.tipoActor === 'OPERADOR' ? inspection.operadorId : null;
    const sameSource = original && original.familia === 'catalogo_verificable' && original.version === 1
      && original.tipo === ref.tipo && original.entidad === 'REQUERIMIENTO' && ref.entidad === 'REQUERIMIENTO'
      && original.entidadId === ref.entidadId && original.inspeccionId === ref.inspeccionId
      && original.tipoActor === ref.tipoActor && original.actorId === ref.actorId && original.vencimiento === ref.vencimiento;
    const authorized = ref.destino === 'inspeccion' ? !!inspection && exchangePartyForUser(authorityById.get(notice.usuarioId || ''), inspection) === 'AUTORIDAD'
      : !!actor?.activo && actor.usuarioId === notice.usuarioId && grants.has(JSON.stringify([ref.tipoActor, ref.actorId, notice.usuarioId]));
    if (!item || !sameSource || !request || !inspection || !notice.usuarioId || !safeId(ref.inspeccionId)
      || request.inspeccionId !== ref.inspeccionId || inspection.tipoActor !== ref.tipoActor || actorId !== ref.actorId
      || !authorized
      || request.tipo !== 'REQUERIMIENTO' || request.parte !== 'AUTORIDAD' || request.destinatario !== 'INSPECCIONADO') return unavailable(notice);
    const situation = requirementSituation(request, new Date());
    const active = item.regla.activa && ['PENDIENTE', 'EN_REVISION'].includes(item.estado)
      && request.plazoRespuestaAt?.toISOString() === ref.vencimiento && situation === 'PENDIENTE';
    if (active) return notice;
    const description = situation === 'RESPONDIDO'
      ? 'Se registró una respuesta. Revisá el estado del requerimiento; responder no implica aprobación.'
      : 'El recordatorio anterior ya no está activo. Abrí el requerimiento para revisar su estado actual.';
    const message = `${inspection.numero} · ${description}`;
    return { ...notice, titulo: 'Estado actualizado de requerimiento', mensaje: message,
      datos: JSON.stringify({ ...ref, estadoDetectado: 'ACTUALIZADO', descripcion: message }) };
  });
}
