import { z } from 'zod';
import { assertCertificateCommandAvailable, recoverCertificateCommand } from '../services/certificateRecovery.service';
import type { Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { isTrainingSession } from '../lib/trainingScope';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { assertCanAccessManifiesto } from '../utils/roleFilter';
import { prepareManifiestoSignature } from '../domain/manifiestoSignature';
import { certificateCommand, certifiedRows, CertificateRow } from '../domain/trainingCertificate';
import { CERTIFICATE_EVENT, certificatesEnabled, sha256, lockManifestDocuments, certificateReadiness, renderManifestCertificate, notifyCertificateParties, CertificateSnapshot } from '../services/manifestCertificate.service';

async function scope(req:AuthRequest) {
 if(isTrainingSession())throw new AppError('Usá el circuito de capacitación',404);
 await assertCanAccessManifiesto(prisma,req.user,req.params.id);
}
export async function listManifestCertificates(req:AuthRequest,res:Response,next:NextFunction) {
 try {
  await scope(req);
  const rows=await prisma.certificadoManifiesto.findMany({where:{manifiestoId:req.params.id},orderBy:{createdAt:'asc'},select:{id:true,numero:true,tipo:true,createdAt:true,documento:true,pdfSha256:true}});
  const {unresolved,hallazgos,problemas}=await certificateReadiness(prisma,req.params.id);
  res.json({success:true,data:rows,emisionHabilitada:certificatesEnabled(),adendasSinResolver:unresolved,hallazgos,problemasHallazgos:problemas});
 } catch(e){next(e);}
}
export async function releaseManifestCertificate(req:AuthRequest,res:Response,next:NextFunction) {
 try {
  await scope(req);
  if(!certificatesEnabled())throw new AppError('La emisión de certificados está deshabilitada',409);
  if(req.user.rol!=='OPERADOR'||!req.user.operador?.id||req.user.restricted||req.user.impersonatedBy)throw new AppError('Sólo el operador vinculado puede firmar y emitir',403);
  const parsed=certificateCommand.safeParse(req.body);
  if(!parsed.success)throw new AppError(parsed.error.issues[0].message,400);
  const command=parsed.data, firma=await prepareManifiestoSignature(command.firma);
  if(!firma)throw new AppError('La firma del operador es obligatoria',400);
  command.cantidades.sort((a,b)=>a.residuoId.localeCompare(b.residuoId));
  command.exclusionesHallazgos?.sort();
  const fingerprint=sha256(JSON.stringify({...command,firma:firma.sha256}));
  const result=await prisma.$transaction(async tx=>{
   await lockManifestDocuments(tx,req.params.id);
   const m=await tx.manifiesto.findUniqueOrThrow({where:{id:req.params.id},include:{residuos:{include:{tipoResiduo:true}},operador:true,generador:true,transportista:true}});
   if(m.operadorId!==req.user.operador.id||!m.operador.activo)throw new AppError('Sólo el operador activo vinculado puede emitir',403);
   const existing=await tx.certificadoManifiesto.findUnique({where:{id:command.id},select:{id:true,manifiestoId:true,autorId:true,solicitudSha256:true,numero:true,pdfSha256:true}});
   if(existing){
    if(existing.manifiestoId!==m.id||existing.autorId!==req.user.id||existing.solicitudSha256!==fingerprint)throw new AppError('La solicitud ya tiene otro contenido',409);
    return {id:existing.id,numero:existing.numero,pdfSha256:existing.pdfSha256,replayed:true};
   }
   await assertCertificateCommandAvailable(tx, command.id);
   const prior=await tx.certificadoManifiesto.findMany({where:{manifiestoId:m.id},orderBy:{createdAt:'asc'},select:{tipo:true,numero:true,documento:true}});
   if(prior.some(p=>p.tipo==='FINAL'))throw new AppError('El certificado final ya fue emitido; el expediente firmado se conserva',409);
   if(!['EN_TRATAMIENTO','TRATADO'].includes(m.estado))throw new AppError('Registrá el tratamiento antes de certificar',409);
   if(command.tipo==='FINAL'&&m.estado!=='TRATADO')throw new AppError('Cerrá el tratamiento antes de emitir el final',409);
   const {adendas,unresolved,hallazgos,problemas}=await certificateReadiness(tx,m.id);
   if(command.tipo==='FINAL'&&unresolved)throw new AppError('Resolvé las adendas pendientes, observadas o rechazadas antes del final',409);
   if(problemas.length&&(command.tipo==='FINAL'||command.cantidades.some(row=>row.residuoId.startsWith('hallazgo:'))))throw new AppError(problemas[0],409);
   const cantidades=certifiedRows(command,m.residuos,prior.map(p=>(p.documento as {cantidades:CertificateRow[]}).cantidades),hallazgos);
   const metodo=command.metodo||m.tratamientoMetodo;
   if(!metodo)throw new AppError('Falta el método de tratamiento registrado',409);
   const numero=m.numero+'-'+(command.tipo==='FINAL'?'F':'P'+String(prior.length+1).padStart(2,'0'));
   const now=new Date();
   const autor=await tx.usuario.findUniqueOrThrow({where:{id:req.user.id},select:{nombre:true,apellido:true,activo:true}});
   if(!autor.activo)throw new AppError('La cuenta no está activa',403);
   const documento:CertificateSnapshot={version:1,tipo:command.tipo,numero,manifiestoNumero:m.numero,generador:m.generador.razonSocial,transportista:m.transportista?.razonSocial||'In situ',operador:m.operador.razonSocial,modalidad:m.modalidad,autor:[autor.nombre,autor.apellido].filter(Boolean).join(' '),fecha:now.toISOString(),metodo,nota:command.nota,cantidades,parcialesPrevios:prior.map(p=>p.numero),adendas:adendas.map(a=>({id:a.id,version:a.version})),firmaSha256:firma.sha256,artificial:m.isDemoData,...(command.exclusionesHallazgos?.length?{hallazgosNoTratados:hallazgos.filter(f=>command.exclusionesHallazgos!.includes(f.id))}:{})};
   const pdf=await renderManifestCertificate(documento,command.id,firma.imagen),pdfSha256=sha256(pdf);
   await tx.certificadoManifiesto.create({data:{id:command.id,manifiestoId:m.id,autorId:req.user.id,tipo:command.tipo,numero,finalKey:command.tipo==='FINAL'?'FINAL':null,documento:documento as unknown as Prisma.InputJsonValue,pdf,pdfSha256,firmaImagen:firma.imagen,firmaSha256:firma.sha256,solicitudSha256:fingerprint,createdAt:now}});
   await tx.eventoManifiesto.create({data:{manifiestoId:m.id,usuarioId:req.user.id,tipo:CERTIFICATE_EVENT,descripcion:JSON.stringify({id:command.id,tipo:command.tipo,numero,pdfSha256})}});
   await notifyCertificateParties(tx,m,{id:command.id,tipo:command.tipo,numero},req.user.id);
   return {id:command.id,numero,pdfSha256,replayed:false};
  },{timeout:15000});
  res.status(result.replayed?200:201).json({success:true,data:result});
 } catch(e){next(e);}
}
export function sendStoredCertificate(res:Response,record:{pdf:Uint8Array;pdfSha256:string;id:string;tipo:string}) {
 res.setHeader('Content-Type','application/pdf');
 res.setHeader('Content-Disposition','attachment; filename="SITREP-'+record.tipo+'-'+record.id+'.pdf"');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Document-SHA256',record.pdfSha256);
 res.send(Buffer.from(record.pdf));
}
export async function downloadManifestCertificate(req:AuthRequest,res:Response,next:NextFunction) {
 try {
  await scope(req);
  const record=await prisma.certificadoManifiesto.findFirst({where:{id:req.params.documentId,manifiestoId:req.params.id}});
  if(!record)throw new AppError('Certificado no encontrado',404);
  sendStoredCertificate(res,record);
 } catch(e){next(e);}
}

export async function recoverManifestCertificate(req:AuthRequest,res:Response,next:NextFunction) {
 try {
  await scope(req);
  if(req.user.rol!=='OPERADOR'||!req.user.operador?.id||req.user.restricted||req.user.impersonatedBy)throw new AppError('Sólo el operador vinculado puede recuperar su envío',403);
  const parsed=z.string().uuid().safeParse(req.params.commandId);
  if(!parsed.success)throw new AppError('Identificador de solicitud inválido',400);
  const result=await prisma.$transaction(async tx=>{
   await lockManifestDocuments(tx,req.params.id);
   const manifest=await tx.manifiesto.findUniqueOrThrow({where:{id:req.params.id},include:{operador:true}});
   if(manifest.operadorId!==req.user.operador.id||!manifest.operador.activo)throw new AppError('Sólo el operador activo vinculado puede recuperar',403);
   return recoverCertificateCommand(tx,manifest.id,req.user.id,parsed.data);
  },{timeout:15000});
  res.json({success:true,data:result});
 }catch(e){next(e);}
}
