import type { Prisma } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';
export const CERTIFICATE_WITHDRAWN = 'CERTIFICACION_ENVIO_RETIRADO';
/** Called only while holding the manifest document row lock, shared with issuance. */
export async function assertCertificateCommandAvailable(tx: Prisma.TransactionClient, id: string) {
 const event = await tx.eventoManifiesto.findUnique({where:{id},select:{tipo:true}});
 if(event) throw new AppError('Este envío fue retirado o su identificador ya está en uso. Prepará una nueva solicitud.',409);
}
/** A durable tombstone prevents a delayed POST from issuing after recovery. */
export async function recoverCertificateCommand(tx: Prisma.TransactionClient, manifestId: string, userId: string, id: string) {
 const issued=await tx.certificadoManifiesto.findUnique({where:{id},select:{id:true,manifiestoId:true,autorId:true,numero:true,pdfSha256:true}});
 if(issued) {
  if(issued.manifiestoId!==manifestId||issued.autorId!==userId) throw new AppError('No se puede recuperar este envío.',404);
  return {id:issued.id,status:'confirmed' as const,numero:issued.numero,pdfSha256:issued.pdfSha256};
 }
 const prior=await tx.eventoManifiesto.findUnique({where:{id}});
 if(prior && (prior.manifiestoId!==manifestId||prior.usuarioId!==userId||prior.tipo!==CERTIFICATE_WITHDRAWN)) throw new AppError('No se puede recuperar este envío.',404);
 if(!prior) await tx.eventoManifiesto.create({data:{id,manifiestoId:manifestId,usuarioId:userId,tipo:CERTIFICATE_WITHDRAWN,descripcion:'Solicitud de certificación retirada sin emitir. Se conserva el contenido para corregirlo.'}});
 return {id,status:'withdrawn' as const};
}
