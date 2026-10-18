import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { isTrainingSession } from '../lib/trainingScope';
export const SCHOOL_CERTIFICATE='CERTIFICADO_CAP_V1';
type Tx=Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export async function lockTrainingDocuments(tx:Tx,id:string){
 if(isTrainingSession())await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`school-documents:${id}`}))::text AS "lock"`;
}
export async function hasFinalTrainingCertificate(tx:Tx,id:string){
 if(!isTrainingSession())return false;
 const documents=await tx.eventoManifiesto.findMany({where:{manifiestoId:id,tipo:SCHOOL_CERTIFICATE},select:{descripcion:true}});
 return documents.some(d=>JSON.parse(d.descripcion).tipo==='FINAL');
}
export async function assertNoFinalTrainingCertificate(tx:Tx,id:string){
 if(await hasFinalTrainingCertificate(tx,id))throw new AppError('El certificado final ya fue liberado. Se conserva el expediente firmado; no se modifica desde este ensayo.',409);
}
