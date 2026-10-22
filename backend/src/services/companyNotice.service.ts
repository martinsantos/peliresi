export const COMPANY_NOTICE_LABELS: Record<string, [string, string]> = {
  FICHA_ACTUALIZADA: ['Ficha de actividad actualizada', 'Administración actualizó datos de la actividad. Revisá la ficha y su historial.'],
  ACTIVIDAD_DESACTIVADA: ['Actividad dada de baja', 'La actividad ya no permite nuevas operaciones. El historial y las otras actividades aprobadas se conservan.'],
  ACTIVIDAD_REACTIVADA: ['Actividad reactivada', 'Administración reactivó esta actividad. Revisá el acceso y la ficha antes de operar.'],
  ALTA_VINCULADA: ['Tu actividad está habilitada', 'La inscripción aprobada quedó vinculada a tu entidad. Revisá sus actividades y personas autorizadas.'],
  PERSONA_AUTORIZADA: ['Acceso a la entidad autorizado', 'Se autorizó una persona en una actividad. Revisá el rol y los establecimientos que puede utilizar.'],
  PERSONA_REVOCADA: ['Acceso a la entidad revocado', 'Se revocó una autorización. Los demás accesos conservan su alcance; consultá tus avisos y tu perfil.'],
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
  await db.notificacion.createMany({ data: users.map((u: any) => ({ usuarioId: u.id, tipo: 'INFO_GENERAL', titulo: label[0], mensaje: label[1], prioridad: 'ALTA',
    datos: JSON.stringify({ tipo: 'representacion_empresa', version: 1, empresaId: event.empresaId, eventoId: event.id, evento: event.tipo }),
  })) });
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
