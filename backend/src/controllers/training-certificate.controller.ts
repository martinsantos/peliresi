import { drawSitrepMark } from '../services/inspectionPdfBranding.service';
import { createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';
import { Response,NextFunction } from 'express';
import prisma from '../lib/prisma';
import { isTrainingSession } from '../lib/trainingScope';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { assertCanAccessManifiesto } from '../utils/roleFilter';
import { prepareManifiestoSignature } from '../domain/manifiestoSignature';
import { certificateCommand,certifiedRows,CertificateRow } from '../domain/trainingCertificate';
import { SCHOOL_CERTIFICATE,lockTrainingDocuments,assertNoFinalTrainingCertificate } from '../services/trainingCertificate.service';
import { notifyManifestParties } from '../services/manifestProposal.service';
import { documentaryResolution } from '../domain/manifiestoAdendaDocument';
import { certificateFindings } from '../domain/certificateFindings';
async function scope(req:AuthRequest){
 if(!isTrainingSession())throw new AppError('Documento disponible sólo en capacitación',404);
 await assertCanAccessManifiesto(prisma,req.user,req.params.id);
}
export async function listTrainingCertificates(req:AuthRequest,res:Response,next:NextFunction){
 try{await scope(req);
 const rows=await prisma.eventoManifiesto.findMany({where:{manifiestoId:req.params.id,tipo:SCHOOL_CERTIFICATE},orderBy:{createdAt:'asc'},select:{id:true,descripcion:true,createdAt:true,usuarioId:true,firmaSha256:true}});
 const adendas=await prisma.adendaManifiesto.findMany({where:{manifiestoId:req.params.id},orderBy:[{createdAt:'asc'},{id:'asc'}],select:{id:true,version:true,rectificaId:true,revisiones:true,informeHallazgo:true,declaracion:true,residuos:true}});
 const {hallazgos,problemas}=certificateFindings(adendas);
 res.json({success:true,data:rows.map(r=>({...r,documento:JSON.parse(r.descripcion),descripcion:undefined})),hallazgos,problemasHallazgos:problemas});
 }catch(e){next(e);}
}
export async function releaseTrainingCertificate(req:AuthRequest,res:Response,next:NextFunction){
 try{
 await scope(req);
 if(req.user.rol!=='OPERADOR'||!req.user.operador?.id||req.user.restricted)throw new AppError('Sólo el operador vinculado libera sus certificados',403);
 const parsed=certificateCommand.safeParse(req.body);if(!parsed.success)throw new AppError(parsed.error.issues[0].message,400);
 const command=parsed.data;const firma=await prepareManifiestoSignature(command.firma);if(!firma)throw new AppError('La firma del operador es obligatoria',400);
 const fingerprint=createHash('sha256').update(JSON.stringify(command)).digest('hex');
 const result=await prisma.$transaction(async tx=>{
  await lockTrainingDocuments(tx,req.params.id);
  const manifest=await tx.manifiesto.findUniqueOrThrow({where:{id:req.params.id},include:{residuos:{include:{tipoResiduo:true}},operador:{select:{razonSocial:true}},generador:{select:{razonSocial:true}},transportista:{select:{razonSocial:true}}}});
  if(manifest.operadorId!==req.user.operador.id)throw new AppError('Operador ajeno al manifiesto',403);
  const existing=await tx.eventoManifiesto.findUnique({where:{id:command.id}});
  if(existing){if(existing.manifiestoId!==manifest.id||existing.usuarioId!==req.user.id||existing.tipo!==SCHOOL_CERTIFICATE||JSON.parse(existing.descripcion).huellaSolicitud!==fingerprint)throw new AppError('La solicitud ya tiene otro contenido',409);return existing;}
  await assertNoFinalTrainingCertificate(tx,manifest.id);
  if(!['EN_TRATAMIENTO','TRATADO'].includes(manifest.estado))throw new AppError('Registrá el tratamiento antes de liberar un certificado',409);
  if(command.tipo==='FINAL'&&manifest.estado!=='TRATADO')throw new AppError('El certificado final requiere operación Tratada',409);
  const adendas=await tx.adendaManifiesto.findMany({where:{manifiestoId:manifest.id},orderBy:[{createdAt:'asc'},{id:'asc'}],select:{id:true,version:true,rectificaId:true,revisiones:true,informeHallazgo:true,declaracion:true,residuos:true}});
  const {counts}=documentaryResolution(adendas);
  if(command.tipo==='FINAL'&&(counts.pendientes||counts.observadas||counts.rechazadas))throw new AppError('Hay adendas pendientes, observadas o rechazadas; resolvelas antes del final',409);
  const {hallazgos,problemas}=certificateFindings(adendas);
  if(problemas.length&&(command.tipo==='FINAL'||command.cantidades.some(row=>row.residuoId.startsWith('hallazgo:'))))throw new AppError(problemas[0],409);
  const prior=await tx.eventoManifiesto.findMany({where:{manifiestoId:manifest.id,tipo:SCHOOL_CERTIFICATE},orderBy:{createdAt:'asc'}});
  const rows=certifiedRows(command,manifest.residuos,prior.map(e=>JSON.parse(e.descripcion).cantidades as CertificateRow[]),hallazgos);
  const metodo=command.metodo || manifest.tratamientoMetodo;
  if(!metodo)throw new AppError('Falta el método registrado. Completalo antes de firmar.',409);
  const document={generador:manifest.generador.razonSocial,transportista:manifest.transportista?.razonSocial||'In situ',formato:SCHOOL_CERTIFICATE,tipo:command.tipo,numero:manifest.numero,operador:manifest.operador.razonSocial,metodo,nota:command.nota,cantidades:rows,parcialesPrevios:prior.map(e=>e.id),adendas:adendas.map(a=>({id:a.id,version:a.version})),hallazgosNoTratados:hallazgos.filter(f=>command.exclusionesHallazgos?.includes(f.id)),huellaSolicitud:fingerprint,autorId:req.user.id,sinValidezOficial:true};
  const event=await tx.eventoManifiesto.create({data:{id:command.id,manifiestoId:manifest.id,usuarioId:req.user.id,tipo:SCHOOL_CERTIFICATE,descripcion:JSON.stringify(document),firmaImagen:firma.imagen,firmaSha256:firma.sha256}});
  await notifyManifestParties(tx,manifest,'documento-'+event.id,req.user.id,req.user.rol);
  return event;
 });
 res.status(201).json({success:true,data:{id:result.id}});
 }catch(e){next(e);}
}
export async function downloadTrainingCertificate(req:AuthRequest,res:Response,next:NextFunction){
 try{
 await scope(req);
 const record=await prisma.eventoManifiesto.findFirst({where:{id:req.params.documentId,manifiestoId:req.params.id,tipo:SCHOOL_CERTIFICATE}});
 if(!record)throw new AppError('Documento no encontrado',404);
 const data=JSON.parse(record.descripcion);
 const pdf=await new Promise<Buffer>((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',margins:{top:120,bottom:60,left:45,right:45}});const chunks:Buffer[]=[];
  doc.on('data',chunk=>chunks.push(chunk));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
  function heading(){
   const y=doc.y;
   drawSitrepMark(doc,45,25,{width:220});
   doc.font('Helvetica').fontSize(9).fillColor('#475569').text('Registro compartido entre las partes',300,50,{lineBreak:false});
   doc.rect(45,84,505,22).fill('#FEF3C7');doc.font('Helvetica-Bold').fontSize(9).fillColor('#78350F').text('CAPACITACIÓN - SIN VALIDEZ OFICIAL',54,91,{lineBreak:false});
   doc.y=Math.max(y,125);doc.x=45;doc.fillColor('#182822').font('Helvetica').fontSize(11);
  }
  doc.on('pageAdded',heading);heading();
  doc.font('Helvetica-Bold').fontSize(18).text(data.tipo==='FINAL'?'Certificación final total':'Certificación parcial');
  doc.moveDown().font('Helvetica').fontSize(11).text('Simulación con datos artificiales. No presentar como documento oficial.');
  doc.moveDown().text(`Manifiesto: ${data.numero}`).text(`Generador: ${data.generador||'Ver manifiesto original'}`).text(`Transporte: ${data.transportista||'Ver manifiesto original'}`).text(`Operador: ${data.operador}`).text(`Liberado por: ${record.usuarioId}`).text(`Fecha: ${record.createdAt.toLocaleString('es-AR',{timeZone:'America/Argentina/Mendoza',hour12:false})} (Mendoza)`);
  doc.moveDown().text(`Método declarado: ${data.metodo}`);if(data.nota)doc.text(`Observaciones: ${data.nota}`);
  doc.moveDown().font('Helvetica-Bold').text(data.tipo==='FINAL'?'Total recibido y tratado (incluye parciales previos)':'Cantidad tratada certificada en este parcial');doc.font('Helvetica');
  for(const row of data.cantidades)doc.text(`${row.corriente}: ${row.cantidad} ${row.unidad}`);
  const fromFindings=data.cantidades.filter((row:CertificateRow)=>row.origen==='HALLAZGO');
  if(fromFindings.length)doc.moveDown().text('Corrientes informadas en adendas: '+fromFindings.map((row:CertificateRow)=>{
   const refs=(row.adendas||[]).map(a=>data.adendas.findIndex((d:{id:string})=>d.id===a.id)).filter((i:number)=>i>=0).map((i:number)=>'adenda '+(i+1));
   return row.corriente+' · '+(refs.length?refs.join(', '):'adenda vinculada');
  }).join(' / '));
  if(data.adendas?.length)doc.moveDown().text('Adendas vinculadas: '+data.adendas.map((a:{version:number},i:number)=>'Adenda '+(i+1)+' · versión '+a.version).join(' / '));
  if(data.hallazgosNoTratados?.length)doc.moveDown().text('Hallazgos declarados no tratados en esta certificación: '+data.hallazgosNoTratados.map((row:{corriente:string})=>row.corriente).join(', '));
  if(data.parcialesPrevios.length)doc.moveDown().text(`Parciales previos: ${data.parcialesPrevios.join(', ')}`);
  doc.moveDown().text('Firma del operador que libera este documento:');
  if(doc.y>630)doc.addPage();
  if(record.firmaImagen)doc.image(Buffer.from(record.firmaImagen.split(',')[1],'base64'),45,doc.y,{fit:[220,90]});doc.y+=100;
  doc.fontSize(8).text(`Registro: ${record.id}`).text(`Huella de firma: ${record.firmaSha256}`);
  doc.end();
 });
 res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="CAP-${data.tipo}-${data.numero}.pdf"`);res.setHeader('Cache-Control','no-store');res.send(pdf);
 }catch(e){next(e);}
}
