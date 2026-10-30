import { createHash } from 'node:crypto';
import type { Prisma, RegistroManifiestoExcepcional } from '@prisma/client';
import { exceptionalApproval, type ExceptionalApprover, type ExceptionalEvent } from '../domain/manifiestoExcepcional';
import { designatedReviewAccount } from '../domain/manifestReviewAuthority';
import { approvedActivities, isActorActivity, type ActorActivity } from '../domain/actorActivities';
import { empresaEnabled } from '../domain/empresa';
import { isTrainingSession } from '../lib/trainingScope';

export const EVENTUAL_NOTICE_LABELS = {
  CREADO: ['Nuevo eventual: revisá tu participación', 'Te vincularon a un eventual. Abrilo para revisar los datos y la aprobación que corresponde a tu perfil.'],
  APROBACION: ['Una parte aprobó el eventual', 'Consultá qué aprobaciones faltan. Todavía no se habilita el avance hasta reunirlas.'],
  APROBADO: ['Eventual aprobado por sus participantes', 'Las partes requeridas aprobaron. Consultá el siguiente paso operativo.'],
  RECHAZADO: ['Participación rechazada en el eventual', 'El avance quedó bloqueado. Consultá el motivo y las decisiones conservadas.'],
  RETIRADO: ['Retiro registrado en el eventual', 'Se registró el retiro. Consultá el estado y la carga declarada.'],
  RECIBIDO: ['Recepción registrada en el eventual', 'Se registró la recepción. Consultá el estado y las diferencias informadas.'],
  TRATADO: ['Tratamiento registrado en el eventual', 'El tratamiento quedó registrado; la revisión documental se consulta por separado.'],
  DIFERENCIA: ['Nueva diferencia en el eventual', 'Hay una diferencia registrada. La declaración original se conserva.'],
  SOLICITAR_REVISION: ['Eventual con revisión solicitada', 'Se solicitó una revisión posterior. Abrí el eventual para ver si corresponde actuar a tu perfil.'],
  APROBADA_POST_FACTO: ['Revisión del eventual aprobada', 'La decisión quedó registrada; consultá su fundamento y trazabilidad.'],
  OBSERVADA_POST_FACTO: ['Revisión del eventual observada', 'Hay una observación sobre el registro o una diferencia. Consultá qué debe revisarse.'],
  RECHAZADA_POST_FACTO: ['Revisión del eventual rechazada', 'Consultá la decisión; los hechos y la declaración original se conservan.'],
} as const;
export type EventualNoticeKind = keyof typeof EVENTUAL_NOTICE_LABELS;

/** Resolve the committed event, using only the approvals that existed at that point. */
export function eventualNoticeEvent(record: RegistroManifiestoExcepcional, eventId: string): { kind: EventualNoticeKind; authorId: string; authorActivity?: EventualActorAccess } | null {
  if (eventId === 'creacion') {
    const authorActivity = isActorActivity(record.autorRol) && record.autorActorId ? { rol: record.autorRol, actorId: record.autorActorId } : undefined;
    return { kind: 'CREADO', authorId: record.creadoPorId, ...(authorActivity ? { authorActivity } : {}) };
  }
  if (!Array.isArray(record.eventos)) return null;
  const events = record.eventos as unknown as ExceptionalEvent[];
  const index = events.findIndex(event => event.id === eventId), event = events[index];
  if (!event) return null;
  const storedAuthor = isActorActivity(event.autorRol) && typeof event.autorActorId === 'string' && event.autorActorId
    ? { rol: event.autorRol, actorId: event.autorActorId } : undefined;
  if (event.tipo === 'APROBAR_PARTE' || event.tipo === 'RECHAZAR_PARTE') {
    const approvers = (record.datos as { aprobaciones?: ExceptionalApprover[] } | null)?.aprobaciones;
    const approver = approvers?.find(a => a.parte === event.parte);
    const authorActivity = storedAuthor || (approver && isActorActivity(approver.rol) && approver.actorId ? { rol: approver.rol, actorId: approver.actorId } : undefined);
    return { kind: event.tipo === 'RECHAZAR_PARTE' ? 'RECHAZADO' : exceptionalApproval(approvers, events.slice(0, index + 1)).estado === 'APROBADO' ? 'APROBADO' : 'APROBACION', authorId: event.autorId,
      ...(authorActivity ? { authorActivity } : {}) };
  }
  const kind = event.tipo === 'AVANCE' ? event.etapa
    : event.tipo === 'RESOLVER' ? `${event.decision}_POST_FACTO` : event.tipo;
  return kind && Object.prototype.hasOwnProperty.call(EVENTUAL_NOTICE_LABELS, kind)
    ? { kind: kind as EventualNoticeKind, authorId: event.autorId, ...(storedAuthor ? { authorActivity: storedAuthor } : {}) } : null;
}

export type EventualActorAccess = { rol: ActorActivity; actorId: string };
export type EventualCompanyAccess = EventualActorAccess & {
  empresaId: string; actividadId: string; autorizacionId: string; revision: number; razonSocial: string;
};
export type EventualRecipient = { id: string; actividadesPropias: EventualActorAccess[]; accesosEmpresa: EventualCompanyAccess[]; autoridad: boolean };
type EventualSpec = { record: RegistroManifiestoExcepcional; kind: EventualNoticeKind; authorId: string; authorActivity?: EventualActorAccess };

function partyRefs(record: RegistroManifiestoExcepcional): EventualActorAccess[] {
  const parties = record.datos as Partial<Record<'generador' | 'transportista', { padronId?: unknown }>> | null;
  return ([{ rol: 'GENERADOR', actorId: parties?.generador?.padronId },
    { rol: 'TRANSPORTISTA', actorId: parties?.transportista?.padronId },
    { rol: 'OPERADOR', actorId: record.operadorId }] as const)
    .filter((ref): ref is EventualActorAccess => typeof ref.actorId === 'string' && ref.actorId.length > 0);
}

/** A bounded set of queries for the entire inbox page. No free-text participant
 * is turned into an account. Eventuales have no site, so delegates need an
 * active grant for every site. The same checks run again when a notice is read. */
export async function eventualNoticeAudienceBatch(tx: Prisma.TransactionClient, specs: EventualSpec[], onlyUsers?: string[]): Promise<EventualRecipient[][]> {
  if (!specs.length || onlyUsers?.length === 0) return specs.map(() => []);
  const refs = [...new Map(specs.flatMap(s => partyRefs(s.record)).map(ref => [`${ref.rol}:${ref.actorId}`, ref])).values()];
  const activities = empresaEnabled() && !isTrainingSession() && refs.length
    ? await tx.empresaActividad.findMany({ where: { activa: true, OR: refs } }) : [];
  const grants = activities.length ? await tx.autorizacionEmpresa.findMany({ where: {
    activa: true, todosEstablecimientos: true, actividadId: { in: activities.map(a => a.id) },
    ...(onlyUsers ? { usuarioId: { in: onlyUsers } } : {}),
  } }) : [];
  const companyIds = [...new Set(activities.map(a => a.empresaId))];
  const idsFor = (role: ActorActivity) => refs.filter(ref => ref.rol === role).map(ref => ref.actorId);
  const or: Prisma.UsuarioWhereInput[] = [
    ...(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] as const).flatMap(role => {
      const ids = idsFor(role); if (!ids.length) return [];
      return [{ [role.toLowerCase()]: { is: { id: { in: ids } } } } as Prisma.UsuarioWhereInput];
    }),
    { rol: 'ADMIN', id: { in: specs.map(s => s.record.creadoPorId) } },
    ...(specs.some(s => s.kind === 'SOLICITAR_REVISION') ? [{ rol: 'ADMIN' as const }] : []),
    ...(grants.length ? [{ id: { in: [...new Set(grants.map(g => g.usuarioId))] } }] : []),
  ];
  const [users, companies, generators, carriers, operators] = await Promise.all([
    tx.usuario.findMany({ where: { activo: true, OR: or, ...(onlyUsers ? { id: { in: onlyUsers } } : {}) },
      select: { id: true, rol: true, emailVerified: true, generador: { select: { id: true, activo: true } },
        transportista: { select: { id: true, activo: true } }, operador: { select: { id: true, activo: true } } } }),
    companyIds.length ? tx.empresa.findMany({ where: { id: { in: companyIds }, activa: true } }) : [],
    activities.length ? tx.generador.findMany({ where: { id: { in: idsFor('GENERADOR') } }, select: { id: true, activo: true, cuit: true } }) : [],
    activities.length ? tx.transportista.findMany({ where: { id: { in: idsFor('TRANSPORTISTA') } }, select: { id: true, activo: true, cuit: true } }) : [],
    activities.length ? tx.operador.findMany({ where: { id: { in: idsFor('OPERADOR') } }, select: { id: true, activo: true, cuit: true } }) : [],
  ]);
  const approvals = process.env.ACTOR_MULTIROLE_ENABLED === 'true' && users.length
    ? await tx.solicitudInscripcion.findMany({ where: { usuarioId: { in: users.map(u => u.id) }, estado: 'APROBADA' },
      select: { usuarioId: true, tipoActor: true, generadorId: true, transportistaId: true, operadorId: true } }) : [];
  const companyById = new Map(companies.map(c => [c.id, c]));
  const actorByRef = new Map<string, { activo: boolean; cuit: string }>([
    ...generators.map(a => [`GENERADOR:${a.id}`, a] as const), ...carriers.map(a => [`TRANSPORTISTA:${a.id}`, a] as const),
    ...operators.map(a => [`OPERADOR:${a.id}`, a] as const),
  ]);
  const companyAccesses = new Map<string, EventualCompanyAccess[]>();
  for (const grant of grants) {
    const activity = activities.find(a => a.id === grant.actividadId);
    const company = activity && companyById.get(activity.empresaId);
    const actor = activity && actorByRef.get(`${activity.rol}:${activity.actorId}`);
    const user = users.find(u => u.id === grant.usuarioId);
    if (!activity || !isActorActivity(activity.rol) || !company || !actor?.activo || grant.empresaId !== company.id
      || actor.cuit.replace(/\D/g, '') !== company.cuit || !user?.emailVerified || !isActorActivity(user.rol)) continue;
    const access = { empresaId: company.id, actividadId: activity.id, autorizacionId: grant.id, revision: grant.revision,
      rol: activity.rol, actorId: activity.actorId, razonSocial: company.razonSocial };
    companyAccesses.set(user.id, [...(companyAccesses.get(user.id) || []), access]);
  }
  return specs.map(({ record, kind, authorId, authorActivity }) => {
    const parties = partyRefs(record), contains = (ref: EventualActorAccess) => parties.some(p => p.rol === ref.rol && p.actorId === ref.actorId);
    return users.flatMap(user => {
      // When the same person represents another party, the action they just
      // performed must not hide the outstanding action in their other role.
      if (user.id === authorId && !authorActivity) return [];
      const roles = isActorActivity(user.rol)
        ? process.env.ACTOR_MULTIROLE_ENABLED === 'true' ? approvedActivities(user, approvals.filter(a => a.usuarioId === user.id)) : approvedActivities(user, []).filter(role => role === user.rol)
        : [];
      const isOther = (a: EventualActorAccess) => user.id !== authorId || !authorActivity || a.rol !== authorActivity.rol || a.actorId !== authorActivity.actorId;
      const propias = roles.flatMap(rol => {
        const actor = user[rol.toLowerCase() as 'generador' | 'transportista' | 'operador'];
        const ref = actor && { rol, actorId: actor.id }; return ref && contains(ref) && isOther(ref) ? [ref] : [];
      });
      const empresas = (companyAccesses.get(user.id) || []).filter(a => contains(a) && isOther(a));
      const authority = user.rol === 'ADMIN' && (user.id === record.creadoPorId ||
        (kind === 'SOLICITAR_REVISION' && user.id !== record.impersonadoPorId && user.id !== record.creadoPorId && designatedReviewAccount(user.id)));
      return propias.length || empresas.length || authority ? [{ id: user.id, actividadesPropias: propias, accesosEmpresa: empresas, autoridad: authority }] : [];
    });
  });
}

export async function eventualNoticeAudience(tx: Prisma.TransactionClient, record: RegistroManifiestoExcepcional,
  kind: EventualNoticeKind, authorId: string, authorActivity?: EventualActorAccess): Promise<EventualRecipient[]> {
  return (await eventualNoticeAudienceBatch(tx, [{ record, kind, authorId, authorActivity }]))[0];
}

export async function notifyEventualParties(tx: Prisma.TransactionClient, record: RegistroManifiestoExcepcional, eventId: string) {
  const event = eventualNoticeEvent(record, eventId);
  if (!event) return;
  const recipients = await eventualNoticeAudience(tx, record, event.kind, event.authorId, event.authorActivity);
  if (!recipients.length) return;
  const [title, action] = EVENTUAL_NOTICE_LABELS[event.kind];
  await tx.notificacion.createMany({ skipDuplicates: true, data: recipients.map(user => ({
    id: createHash('sha256').update(`eventual:${record.id}:${eventId}:${user.id}`).digest('hex'),
    usuarioId: user.id, tipo: 'INFO_GENERAL', titulo: title, mensaje: `BI-${record.id} · ${action}`,
    prioridad: ['CREADO', 'SOLICITAR_REVISION', 'OBSERVADA_POST_FACTO'].includes(event.kind) ? 'ALTA' : 'NORMAL',
    datos: JSON.stringify({ tipo: 'manifiesto_eventual', version: 1, correoVersion: 1, registroId: record.id, eventoId: eventId, evento: event.kind,
      accesoVersion: 1, actividadesPropias: user.actividadesPropias, accesosEmpresa: user.accesosEmpresa, autoridad: user.autoridad }),
  })) });
}
