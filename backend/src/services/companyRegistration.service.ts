import { AppError } from '../middlewares/errorHandler';
import { verifiedCuit } from '../domain/conciliacionExterna';
import { empresaEnabled } from '../domain/empresa';
import { reserveCompanyPerson } from './companyPeople.service';
import { enterpriseEvent } from './empresa.service';

/** New shared identities use one representation of CUIT/email across entry paths. */
export function actorRegistrationIdentity(cuit: unknown, email: unknown) {
  if (!empresaEnabled() && process.env.ACTOR_MULTIROLE_ENABLED !== 'true') return { cuit, email };
  if (typeof cuit !== 'string' || !/^[\d\s-]+$/.test(cuit) || typeof email !== 'string') throw new AppError('Revisá el CUIT y el correo de la cuenta.', 400);
  const digits = cuit.replace(/\D/g, '');
  if (digits.length !== 11 || empresaEnabled() && !verifiedCuit(digits)) throw new AppError('Revisá el CUIT: el prefijo o el dígito verificador no coinciden.', 400);
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new AppError('Revisá el correo de la cuenta.', 400);
  return { cuit: digits.slice(0, 2)+'-'+digits.slice(2, 10)+'-'+digits.slice(10), email: normalizedEmail };
}

/** Called only inside the reviewed application's approval transaction. No legacy
 * backfill, guessed representative, or self-approved activity. The approving
 * administrator is recorded as the source of this initial responsibility. */
export async function linkApprovedRegistration(db: any, application: { id: string; usuarioId: string; tipoActor: string }, actorId: string, reviewer: { id: string }) {
  if (!empresaEnabled()) return;
  const owner = await db.usuario.findUniqueOrThrow({ where: { id: application.usuarioId } });
  const actor = await db[application.tipoActor.toLowerCase()].findUniqueOrThrow({ where: { id: actorId } });
  const cuit = verifiedCuit(owner.cuit || '');
  if (!cuit || verifiedCuit(actor.cuit) !== cuit) throw new AppError('Revisá el CUIT de la inscripción: debe ser válido y coincidir con la cuenta antes de habilitar su representación.', 400);
  if (!owner.activo || !owner.emailVerified) throw new AppError('La persona titular debe verificar su correo antes de aprobar el alta con representación.', 409);
  // All applications of a CUIT share the same account. Also lock existing entity
  // below, so concurrent invitations cannot create an extra person.
  const company = await db.empresa.upsert({ where: { cuit }, update: {}, create: {
    cuit, razonSocial: actor.razonSocial,
    domicilioLegal: { calle: actor.domicilioLegalCalle || '', localidad: actor.domicilioLegalLocalidad || '', departamento: actor.domicilioLegalDepto || '' },
  } });
  if (!company.activa) throw new AppError('La entidad está inactiva. Requiere revisión de administración antes de agregar una actividad.', 409);
  await reserveCompanyPerson(db, company.id, owner);
  const existing = await db.empresaActividad.findUnique({ where: { empresaId_rol: { empresaId: company.id, rol: application.tipoActor } } });
  if (existing && (!existing.activa || existing.actorId !== actorId)) throw new AppError('La entidad ya tiene otra ficha para esta actividad. Revisá su vinculación antes de aprobar.', 409);
  const activity = existing || await db.empresaActividad.create({ data: { empresaId: company.id, rol: application.tipoActor, actorId, aprobadaPor: reviewer.id } });
  const responsible = await db.responsableEmpresa.findUnique({ where: { empresaId_usuarioId: { empresaId: company.id, usuarioId: owner.id } } });
  // A further role must never restore a previously revoked responsibility/access.
  if (!responsible) await db.responsableEmpresa.create({ data: { empresaId: company.id, usuarioId: owner.id, validadoPor: reviewer.id, motivo: 'Alta aprobada: ' + application.id } });
  const grant = await db.autorizacionEmpresa.findUnique({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: owner.id } } });
  if (!grant) await db.autorizacionEmpresa.create({ data: { empresaId: company.id, actividadId: activity.id, usuarioId: owner.id, todosEstablecimientos: true, establecimientoIds: [], otorgadaPor: reviewer.id } });
  await enterpriseEvent(db, reviewer, company.id, 'ALTA_VINCULADA', { usuarioId: owner.id, solicitudId: application.id, actividadId: activity.id });
  return company.id;
}

/** Ficha changes are recorded in the same transaction as the reviewed edit. */
export async function notifyCompanyActorChange(db: any, role: string, before: any, after: any, reviewer: { id: string }) {
  if (!empresaEnabled()) return;
  const activity = await db.empresaActividad.findUnique({ where: { rol_actorId: { rol: role, actorId: after.id } } });
  if (!activity) return;
  const event = before.activo !== after.activo ? after.activo ? 'ACTIVIDAD_REACTIVADA' : 'ACTIVIDAD_DESACTIVADA' : 'FICHA_ACTUALIZADA';
  await enterpriseEvent(db, reviewer, activity.empresaId, event, { usuarioId: after.usuarioId, actividadId: activity.id });
}
