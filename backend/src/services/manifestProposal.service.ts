import { createHash } from 'node:crypto';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Parties = { generadorId: string; transportistaId: string | null; operadorId: string };
async function parties(tx: Tx, p: Parties) {
  const [g,t,o] = await Promise.all([
    tx.generador.findUnique({where:{id:p.generadorId},include:{usuario:{select:{id:true,activo:true}}}}),
    p.transportistaId ? tx.transportista.findUnique({where:{id:p.transportistaId},include:{usuario:{select:{id:true,activo:true}}}}) : null,
    tx.operador.findUnique({where:{id:p.operadorId},include:{usuario:{select:{id:true,activo:true}}}}),
  ]);
  return [g?.usuario,t?.usuario,o?.usuario];
}
export async function validateProposalParties(tx: Tx, p: Parties) {
  const users=await parties(tx,p);
  if(users.some(u=>!u?.activo))throw new AppError('Las tres partes deben tener una cuenta activa para aprobar. Si falta un alta, usá Eventuales.',400);
}
/** Internal inbox only. Creation and notice commit together; retries never send external deliveries. */
export async function notifyManifestParties(tx: Tx, manifest: Parties & {id:string;numero:string;creadoPorId:string;fechaEstimadaRetiro:Date|null}, phase:string, author:string) {
  const users=await parties(tx,manifest);
  const partyUsers=users.filter(u=>u?.activo).map(u=>u!.id);
  const recipients=[...new Set([...partyUsers,manifest.creadoPorId])];
  const date=manifest.fechaEstimadaRetiro?.toLocaleDateString('es-AR',{timeZone:'America/Argentina/Mendoza'})||'sin fecha';
  const approvedRole=phase.startsWith('aprobacion-')?({GENERADOR:'Generador',TRANSPORTISTA:'Transporte',OPERADOR:'Operador'} as Record<string,string>)[phase.slice(11)]:null;
  const title=phase==='creada'?'Manifiesto pendiente de tu aprobación':phase==='aprobada'?'¡Tres aprobaciones! Listos para iniciar':phase==='iniciada'?'¡Coordinación iniciada! Preparar el retiro':phase==='rechazada'?'Manifiesto detenido: una parte rechazó':approvedRole?`${approvedRole} aprobó su participación`:'Certificación disponible para descargar';
  const next=phase==='creada'?'Abrí el manifiesto para aprobar o rechazar.':phase==='aprobada'?'Una de las tres partes debe pulsar Iniciar coordinación.':phase==='iniciada'?'Generador: prepará la carga. Operador: coordiná la recepción. Transporte: confirmá el retiro cuando ocurra.':phase==='rechazada'?'No se puede iniciar ni retirar. Revisá el motivo.':approvedRole?'Revisá qué aprobaciones faltan.':'El operador la firmó. Abrí Certificaciones para descargarla.';
  await tx.notificacion.createMany({skipDuplicates:true,data:recipients.map(usuarioId=>({
    id:createHash('sha256').update(`${manifest.id}:${phase}:${usuarioId}`).digest('hex'),usuarioId,tipo:'INFO_GENERAL',
    titulo:phase==='creada'&&!partyUsers.includes(usuarioId)?'Manifiesto enviado a las partes':title,mensaje:`${manifest.numero}. Fecha prevista: ${date}. ${next}`,
    manifiestoId:manifest.id,datos:JSON.stringify({tipo:'propuesta_partes',fase:phase,autorId:author,url:`/manifiestos/${manifest.id}`}),
  }))});
}
