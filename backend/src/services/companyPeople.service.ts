import { AppError } from '../middlewares/errorHandler';

export const COMPANY_PEOPLE_LIMIT = 2;
const emailKey = (value: string) => value.trim().toLowerCase();
type Person = { id: string; email: string; nombre: string; activo: boolean };
/** One slot per person, across activities and sites; live invitations reserve a slot.
 * A suspended account retains its slot until the underlying authority is revoked.
 * Historical over-capacity is reported, never repaired by deleting access/history.
 */
export async function companyPeople(db: any, empresaId: string, now = new Date()) {
  const company = await db.empresa.findUnique({ where: { id: empresaId } });
  if (!company?.activa) throw new AppError('Empresa no encontrada', 404);
  const [grants, responsibles, invitations, activities] = await Promise.all([
    db.autorizacionEmpresa.findMany({ where: { empresaId, activa: true } }),
    db.responsableEmpresa.findMany({ where: { empresaId, revocadoAt: null } }),
    db.invitacionEmpresa.findMany({ where: { empresaId, aceptadaAt: null, revocadaAt: null, venceAt: { gt: now } }, select: { email: true } }),
    db.empresaActividad.findMany({ where: { empresaId, activa: true } }),
  ]);
  const linkedOwners = (await Promise.all(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].map(rol => {
    const ids = activities.filter((a: any) => a.rol === rol).map((a: any) => a.actorId);
    return ids.length ? db[rol.toLowerCase()].findMany({ where: { id: { in: ids } }, select: { usuarioId: true } }) : [];
  }))).flat();
  const ids = [...new Set([...grants, ...responsibles, ...linkedOwners].map((p: any) => p.usuarioId))];
  const cuit = String(company.cuit).replace(/\D/g, '');
  const formatted = cuit.slice(0, 2) + '-' + cuit.slice(2, 10) + '-' + cuit.slice(10);
  // Include the identity that owns the CUIT, even before its first company grant.
  const users: Person[] = await db.usuario.findMany({ where: { OR: [{ id: { in: ids } }, { cuit: { in: [cuit, formatted] } }] }, select: { id: true, email: true, nombre: true, activo: true } });
  const persons = users.map(user => ({ ...user, responsable: responsibles.some((r: any) => r.usuarioId === user.id),
    roles: [...new Set(grants.filter((g: any) => g.usuarioId === user.id).map((g: any) => activities.find((a: any) => a.id === g.actividadId)?.rol).filter(Boolean))] as string[] }));
  const emails = new Set(persons.map(p => emailKey(p.email)));
  const pending = [...new Set<string>(invitations.map((i: any) => emailKey(i.email)))].filter(email => !emails.has(email));
  return { maximo: COMPANY_PEOPLE_LIMIT, ocupados: persons.length + pending.length, personas: persons, reservas: pending };
}

/** All callers run in a transaction. Lock the entity shared by every role/path. */
export async function reserveCompanyPerson(db: any, empresaId: string, candidate: { id?: string; email: string }) {
  await db.$queryRaw`SELECT id FROM empresas WHERE id = ${empresaId} FOR UPDATE`;
  const capacity = await companyPeople(db, empresaId);
  const email = emailKey(candidate.email);
  const alreadyCounted = capacity.personas.some(p => candidate.id ? p.id === candidate.id : emailKey(p.email) === email) || capacity.reservas.includes(email);
  if (!alreadyCounted && capacity.ocupados >= COMPANY_PEOPLE_LIMIT) {
    throw new AppError('Esta entidad ya tiene dos personas o invitaciones vigentes. Revocá un acceso o una invitación antes de agregar otra persona. Agregar roles no aumenta el cupo.', 409);
  }
  return capacity;
}
