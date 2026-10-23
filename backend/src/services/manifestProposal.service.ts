import { createHash } from 'node:crypto';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { manifestPartyEligibility, type ManifestPartyField } from '../domain/manifestPartyEligibility';
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Parties = { generadorId: string; transportistaId: string | null; operadorId: string };
async function parties(tx: Tx, p: Parties) {
  const [g,t,o] = await Promise.all([
    tx.generador.findUnique({where:{id:p.generadorId},include:{usuario:{select:{id:true,activo:true}}}}),
    p.transportistaId ? tx.transportista.findUnique({where:{id:p.transportistaId},include:{usuario:{select:{id:true,activo:true}}}}) : null,
    tx.operador.findUnique({where:{id:p.operadorId},include:{usuario:{select:{id:true,activo:true}}}}),
  ]);
  const roles = ['Generador', 'Transporte', 'Operador'];
  return [g,t,o].map((actor, index) => ({
    usuario: actor?.activo === false ? undefined : actor?.usuario,
    nombre: actor?.razonSocial,
    rol: roles[index],
    aprobacion: manifestPartyEligibility(actor, (['generador', 'transportista', 'operador'] as const)[index]),
    field: (['generador', 'transportista', 'operador'] as const)[index],
  }));
}
export async function validateProposalParties(tx: Tx, p: Parties) {
  const users=await parties(tx,p);
  const required = p.transportistaId ? users : [users[0], users[2]];
  const fieldErrors: Partial<Record<ManifestPartyField, string>> = {};
  for (const party of required) if (party.aprobacion.mensaje) fieldErrors[party.field] = party.aprobacion.mensaje;
  if (Object.keys(fieldErrors).length) {
    const error = new AppError(Object.values(fieldErrors).join(' '), 400);
    error.fieldErrors = fieldErrors;
    throw error;
  }
}
/** Creation and inbox commit together. Return only fresh IDs for a caller's
 * post-commit dispatch; CAP never sends external notifications. */
export async function notifyManifestParties(tx: Tx, manifest: Parties & {id:string;numero:string;creadoPorId:string;fechaEstimadaRetiro:Date|null;modalidad?:string|null}, phase:string, author:string) {
  const users=await parties(tx,manifest);
  const partyUsers=users.filter(p=>p.usuario?.activo).map(p=>p.usuario!.id);
  const origin=users.find(p=>p.usuario?.id===author);
  const sender=phase==='creada'&&origin?.nombre ? `${origin.nombre} (${origin.rol}) propuso este manifiesto. ` : '';
  const context=users.filter(p=>p.nombre).map(p=>`${p.rol}: ${p.nombre}`).join(' · ');
  const recipients=[...new Set([...partyUsers,manifest.creadoPorId])];
  const date=manifest.fechaEstimadaRetiro?.toLocaleDateString('es-AR',{timeZone:'America/Argentina/Mendoza'})||'sin fecha';
  const approvedRole=phase.startsWith('aprobacion-')?({GENERADOR:'Generador',TRANSPORTISTA:'Transporte',OPERADOR:'Operador'} as Record<string,string>)[phase.slice(11)]:null;
  const inSitu=manifest.modalidad==='IN_SITU';
  const title=phase==='creada'?'Manifiesto pendiente de tu aprobación':phase==='aprobada'?(inSitu?'Generador y operador aprobaron: listos para iniciar':'¡Tres aprobaciones! Listos para iniciar'):phase==='iniciada'?(inSitu?'Coordinación iniciada: tratamiento en origen':'¡Coordinación iniciada! Preparar el retiro'):phase==='rechazada'?'Manifiesto detenido: una parte rechazó':approvedRole?`${approvedRole} aprobó su participación`:'Certificación disponible para descargar';
  const next=phase==='creada'?'Abrí el manifiesto para aprobar o rechazar.':phase==='aprobada'?(inSitu?'Generador u operador debe pulsar Iniciar coordinación.':'Una de las tres partes debe pulsar Iniciar coordinación.'):phase==='iniciada'?(inSitu?'El operador debe confirmar la recepción en el domicilio del generador. No hay retiro, viaje ni GPS.':'Generador: prepará la carga. Operador: coordiná la recepción. Transporte: confirmá el retiro cuando ocurra.'):phase==='rechazada'?'No se puede iniciar la operación. Revisá el motivo.':approvedRole?'Revisá qué aprobaciones faltan.':'El operador la firmó. Abrí Certificaciones para descargarla.';
  const data=recipients.map(usuarioId=>({
    id:createHash('sha256').update(`${manifest.id}:${phase}:${usuarioId}`).digest('hex'),usuarioId,tipo:'INFO_GENERAL' as const,
    prioridad: (['creada','aprobada','rechazada'].includes(phase) ? 'ALTA' : 'NORMAL') as 'ALTA' | 'NORMAL',
    titulo:phase==='creada'&&!partyUsers.includes(usuarioId)?'Manifiesto enviado a las partes':title,mensaje:`${manifest.numero}. ${sender}${context ? context + '. ' : ''}Fecha prevista: ${date}. ${next}`,
    manifiestoId:manifest.id,datos:JSON.stringify({tipo:'propuesta_partes',fase:phase,autorId:author,url:`/manifiestos/${manifest.id}`}),
  }));
  const inserted=await tx.notificacion.createMany({skipDuplicates:true,data});
  return inserted.count===data.length?data.map(notice=>notice.id):[];
}
