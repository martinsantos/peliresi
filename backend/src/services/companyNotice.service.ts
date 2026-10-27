export const COMPANY_NOTICE_LABELS: Record<string, [string, string]> = {
  FICHA_ACTUALIZADA: ['Ficha de actividad actualizada', 'Administración actualizó datos de la actividad. Revisá la ficha y su historial.'],
  ACTIVIDAD_DESACTIVADA: ['Actividad dada de baja', 'La actividad ya no permite nuevas operaciones. El historial y las otras actividades aprobadas se conservan.'],
  ACTIVIDAD_REACTIVADA: ['Actividad reactivada', 'Administración reactivó esta actividad. Revisá el acceso y la ficha antes de operar.'],
  ALTA_VINCULADA: ['Tu actividad está habilitada', 'La inscripción aprobada quedó vinculada a tu entidad. Revisá sus actividades y personas autorizadas.'],
  PERSONA_AUTORIZADA: ['Acceso autorizado', 'Se autorizó una persona en una actividad. Revisá el rol y los establecimientos que puede utilizar.'],
  PERSONA_REVOCADA: ['Acceso revocado', 'Se revocó una autorización. Los demás accesos conservan su alcance; consultá tus avisos y tu perfil.'],
  PERSONA_INVITADA: ['Invitación preparada', 'Hay una invitación pendiente de aceptación. Reserva un lugar durante 24 horas y todavía no habilita el acceso.'],
  INVITACION_ACEPTADA: ['Invitación aceptada', 'La persona confirmó su cuenta y ya puede usar la actividad autorizada.'],
  INVITACION_REVOCADA: ['Invitación revocada', 'La invitación ya no permite aceptar el acceso. Revisá las personas autorizadas.'],
  RESPONSABLE_VALIDADO: ['Responsable designado', 'Se designó un responsable ante SITREP. Puede gestionar la entidad y sus representantes, sin facultades de administración pública.'],
  RESPONSABLE_REVOCADO: ['Responsabilidad revocada', 'Se retiró la gestión de representantes. Los accesos operativos deben revisarse por separado.'],
  ACTIVIDAD_VINCULADA: ['Actividad vinculada a la entidad', 'Hay una actividad aprobada vinculada. Los roles no aumentan el límite de dos personas por entidad.'],
  DOMICILIO_LEGAL_ACTUALIZADO: ['Datos de la entidad actualizados', 'Se guardó un cambio en los datos legales. Consultá su historial.'],
  ESTABLECIMIENTO_CREADO: ['Establecimiento registrado', 'Se registró un establecimiento de la entidad. Revisá qué personas pueden operar en él.'],
  ESTABLECIMIENTO_ACTUALIZADO: ['Establecimiento actualizado', 'Se guardó un cambio en un establecimiento. Consultá su historial.'],
};
export function validCompanyNotice(data: Record<string, unknown>): boolean {
  return data.tipo === 'representacion_empresa' && data.version === 1
    && typeof data.empresaId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.empresaId)
    && typeof data.eventoId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.eventoId)
    && typeof data.evento === 'string' && Object.prototype.hasOwnProperty.call(COMPANY_NOTICE_LABELS, data.evento);
}
export function affectedCompanyPerson(data: any): string | undefined {
  return data?.usuarioId || data?.despues?.usuarioId || data?.antes?.usuarioId;
}
const ACTIVITY_NAMES: Record<string, string> = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transportista', OPERADOR: 'Operador' };
type CompanyNoticeContext = { empresa: string; actividad?: string; persona?: string; paraMi?: boolean; alcance?: 'TODOS' | 'SELECCIONADOS' };
function shortName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) : '';
}
/** Only allow-listed display context is used in email and the internal inbox.
 * Never copy the event JSON (it contains private reasons and invitation data). */
export function companyNoticeMessage(data: Record<string, unknown>): [string, string] | undefined {
  if (!validCompanyNotice(data)) return undefined;
  const base = COMPANY_NOTICE_LABELS[String(data.evento)];
  const context = data.contexto as CompanyNoticeContext | undefined;
  const company = shortName(context?.empresa);
  if (!company) return base;
  const role = ACTIVITY_NAMES[String(context?.actividad)] || '';
  const person = shortName(context?.persona);
  const subject = context?.paraMi === true ? 'Tu acceso' : person ? 'El acceso de ' + person : 'El acceso de la persona autorizada';
  const scope = context?.alcance === 'TODOS' ? 'Todos los establecimientos.' : context?.alcance === 'SELECCIONADOS' ? 'Sólo los establecimientos seleccionados.' : '';
  const body: Record<string, string> = {
    PERSONA_AUTORIZADA: subject + ' quedó autorizado.' + (scope ? ' ' + scope : ''),
    PERSONA_REVOCADA: subject + ' fue revocado para esta actividad. Los demás accesos conservan su alcance.',
    INVITACION_ACEPTADA: (context?.paraMi ? 'Aceptaste la invitación.' : person ? person + ' aceptó la invitación.' : 'La invitación fue aceptada.') + ' Consultá la actividad y el alcance vigentes en la entidad.',
    RESPONSABLE_VALIDADO: (context?.paraMi ? 'Te designaron responsable ante SITREP.' : person ? person + ' fue designado/a responsable ante SITREP.' : base[1]) + ' Esta función permite gestionar la entidad y sus representantes.',
    RESPONSABLE_REVOCADO: (context?.paraMi ? 'Se retiró tu función de responsable.' : person ? 'Se retiró la función de responsable de ' + person + '.' : base[1]) + ' Los accesos operativos se revisan por separado.',
    ALTA_VINCULADA: 'La inscripción aprobada quedó vinculada a esta entidad. Consultá la actividad habilitada.',
    ACTIVIDAD_VINCULADA: 'La actividad aprobada quedó vinculada a esta entidad. El límite sigue siendo dos personas en total.',
  };
  return [base[0] + (role ? ' · ' + role : ''), company + '. ' + (body[String(data.evento)] || base[1])];
}

/** Bounded batches for a page of events; activity and invitation references
 * must belong to the event company, even for historical records. */
async function companyContexts(db: any, events: any[]): Promise<Map<string, CompanyNoticeContext & { affected?: string }>> {
  if (!events.length) return new Map();
  const companyIds = [...new Set(events.map(e => e.empresaId))];
  const invitationIds = [...new Set(events.map(e => e.datos?.invitacionId).filter(Boolean))];
  const [companies, invitations] = await Promise.all([
    db.empresa.findMany({ where: { id: { in: companyIds } }, select: { id: true, razonSocial: true } }),
    invitationIds.length ? db.invitacionEmpresa.findMany({ where: { id: { in: invitationIds }, empresaId: { in: companyIds } }, select: { id: true, empresaId: true, actividadId: true, aceptadaPor: true, todosEstablecimientos: true } }) : [],
  ]);
  const refs = events.map(e => {
    const d = e.datos || {}, node = d.despues || d.antes || {};
    const invitation = invitations.find((i: any) => i.id === d.invitacionId && i.empresaId === e.empresaId);
    return { event: e, activityId: d.actividadId || node.actividadId || d.actividad?.id || invitation?.actividadId,
      affected: affectedCompanyPerson(d) || invitation?.aceptadaPor,
      allSites: typeof node.todosEstablecimientos === 'boolean' ? node.todosEstablecimientos : invitation?.todosEstablecimientos };
  });
  const activityIds = [...new Set(refs.map(r => r.activityId).filter(Boolean))];
  const personIds = [...new Set(refs.map(r => r.affected).filter(Boolean))];
  const [activities, people] = await Promise.all([
    activityIds.length ? db.empresaActividad.findMany({ where: { id: { in: activityIds }, empresaId: { in: companyIds } }, select: { id: true, empresaId: true, rol: true } }) : [],
    personIds.length ? db.usuario.findMany({ where: { id: { in: personIds } }, select: { id: true, nombre: true } }) : [],
  ]);
  return new Map(refs.flatMap(r => {
    const company = companies.find((c: any) => c.id === r.event.empresaId);
    if (!company) return [];
    const activity = activities.find((a: any) => a.id === r.activityId && a.empresaId === r.event.empresaId);
    const person = people.find((p: any) => p.id === r.affected);
    return [[r.event.id, { empresa: shortName(company.razonSocial), ...(ACTIVITY_NAMES[activity?.rol] ? { actividad: activity.rol } : {}),
      ...(person?.nombre ? { persona: shortName(person.nombre) } : {}), affected: r.affected,
      ...(typeof r.allSites === 'boolean' ? { alcance: r.allSites ? 'TODOS' as const : 'SELECCIONADOS' as const } : {}) }]];
  }));
}

/** Called only after filtering notices by their recipient. Read-only historical
 * projection: no notification or audit records are rewritten. */
export async function withCompanyNoticeContext<T extends { datos: string | null; usuarioId?: string }>(db: any, notices: T[]): Promise<T[]> {
  const references = notices.map(n => {
    try { const d = JSON.parse(n.datos || 'null'); return d && validCompanyNotice(d) && !d.contexto ? d : null; } catch { return null; }
  });
  const wanted = references.filter(Boolean);
  if (!wanted.length) return notices;
  const events = await db.eventoEmpresa.findMany({ where: { OR: wanted.map(d => ({ id: d.eventoId, empresaId: d.empresaId, tipo: d.evento })) }, select: { id: true, empresaId: true, tipo: true, datos: true } });
  const contexts = await companyContexts(db, events);
  return notices.map((notice, index) => {
    const d = references[index], found = d && events.find((e: any) => e.id === d.eventoId && e.empresaId === d.empresaId && e.tipo === d.evento);
    const c = found && contexts.get(found.id);
    if (!c) return notice;
    const { affected, ...display } = c;
    const data = { ...d, contexto: { ...display, paraMi: !!affected && affected === notice.usuarioId }, contextoReconstruido: true };
    const message = companyNoticeMessage(data)!;
    return { ...notice, titulo: message[0], mensaje: message[1], datos: JSON.stringify(data) };
  });
}
/** Same transaction as the mutation, a single notice per person even across roles.
 * Never include invitation tokens, email addresses or free-text reasons. */
export async function companyEventNotices(db: any, event: any) {
  const label = COMPANY_NOTICE_LABELS[event.tipo];
  if (!label) return;
  const responsibles = await db.responsableEmpresa.findMany({ where: { empresaId: event.empresaId, revocadoAt: null }, select: { usuarioId: true } });
  const affected = affectedCompanyPerson(event.datos);
  const activityRecipients = ['FICHA_ACTUALIZADA', 'ACTIVIDAD_DESACTIVADA', 'ACTIVIDAD_REACTIVADA'].includes(event.tipo) && event.datos?.actividadId
    ? await db.autorizacionEmpresa.findMany({ where: { empresaId: event.empresaId, actividadId: event.datos.actividadId, activa: true }, select: { usuarioId: true } }) : [];
  const ids = [...new Set<string>([...responsibles.map((r: any) => r.usuarioId), ...activityRecipients.map((r: any) => r.usuarioId), ...(affected ? [affected] : [])])];
  if (!ids.length) return;
  const users = await db.usuario.findMany({ where: { id: { in: ids }, activo: true, emailVerified: true }, select: { id: true } });
  const context = (await companyContexts(db, [event])).get(event.id);
  await db.notificacion.createMany({ data: users.map((u: any) => {
    const { affected: contextPerson, ...display } = context || {};
    const data = { tipo: 'representacion_empresa', version: 1, empresaId: event.empresaId, eventoId: event.id, evento: event.tipo,
      ...(context ? { contexto: { ...display, paraMi: !!contextPerson && contextPerson === u.id } } : {}) };
    const message = companyNoticeMessage(data) || label;
    return { usuarioId: u.id, tipo: 'INFO_GENERAL', titulo: message[0], mensaje: message[1], prioridad: 'ALTA', datos: JSON.stringify(data) };
  }) });
}
export async function companyNoticeEligible(db: any, usuarioId: string | undefined, data: Record<string, unknown>): Promise<boolean> {
  if (!usuarioId || !validCompanyNotice(data)) return false;
  const event = await db.eventoEmpresa.findFirst({ where: { id: data.eventoId, empresaId: data.empresaId, tipo: data.evento } });
  if (!event) return false;
  const affected = affectedCompanyPerson(event.datos);
  if (['PERSONA_REVOCADA', 'RESPONSABLE_REVOCADO'].includes(event.tipo) && affected === usuarioId) return true;
  const company = await db.empresa.findUnique({ where: { id: event.empresaId } });
  if (!company?.activa) return false;
  const responsible = await db.responsableEmpresa.findFirst({ where: { empresaId: event.empresaId, usuarioId, revocadoAt: null } });
  if (responsible) return true;
  if (['FICHA_ACTUALIZADA', 'ACTIVIDAD_DESACTIVADA', 'ACTIVIDAD_REACTIVADA'].includes(event.tipo) && event.datos?.actividadId)
    return !!await db.autorizacionEmpresa.findFirst({ where: { empresaId: event.empresaId, actividadId: event.datos.actividadId, usuarioId, activa: true } });
  return affected === usuarioId && !!await db.autorizacionEmpresa.findFirst({ where: { empresaId: event.empresaId, usuarioId, activa: true } });
}

/** Manager-only history projection. Names are current display names, never an
 * assertion about a person's name at the time of the event. No audit writes. */
export async function withCompanyHistoryContext<T extends { id: string; empresaId: string; tipo: string; usuarioId: string | null; datos: unknown }>(db: any, events: T[]) {
  if (!events.length) return [];
  const authorIds = [...new Set(events.map(e => e.usuarioId).filter((id): id is string => typeof id === 'string' && !!id))];
  const [contexts, authors] = await Promise.all([
    companyContexts(db, events),
    authorIds.length ? db.usuario.findMany({ where: { id: { in: authorIds } }, select: { id: true, nombre: true } }) : [],
  ]);
  return events.map(event => {
    const context = contexts.get(event.id);
    const data = event.datos as Record<string, any> | null;
    const title = event.tipo === 'EMPRESA_CREADA' ? 'Empresa registrada'
      : event.tipo === 'ALTA_VINCULADA' ? 'Inscripción aprobada y vinculada'
      : Object.prototype.hasOwnProperty.call(COMPANY_NOTICE_LABELS, event.tipo) ? COMPANY_NOTICE_LABELS[event.tipo][0] : 'Cambio registrado';
    return { ...event, presentacion: {
      titulo: title,
      autor: shortName(authors.find((person: any) => person.id === event.usuarioId)?.nombre) || null,
      persona: context?.persona || null,
      actividad: ACTIVITY_NAMES[String(context?.actividad)] || null,
      establecimiento: ['ESTABLECIMIENTO_CREADO', 'ESTABLECIMIENTO_ACTUALIZADO'].includes(event.tipo) ? shortName(data?.despues?.nombre || data?.antes?.nombre) || null : null,
    } };
  });
}
