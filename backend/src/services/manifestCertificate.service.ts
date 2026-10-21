import { createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';
import type { Prisma } from '@prisma/client';
import { isTrainingSession } from '../lib/trainingScope';
import { AppError } from '../middlewares/errorHandler';
import type { CertificateRow } from '../domain/trainingCertificate';

export const CERTIFICATE_EVENT = 'CERTIFICADO_OPERADOR_V1';
export const CERTIFICATE_MANAGED = 'CERTIFICACION_OPERADOR_V1';
export const certificatesEnabled = () => !isTrainingSession() && process.env.MANIFEST_CERTIFICATES_ENABLED === 'true';
export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export type CertificateSnapshot = {
 version: 1; tipo: 'PARCIAL' | 'FINAL'; numero: string; manifiestoNumero: string;
 generador: string; transportista: string; operador: string; autor: string;
 fecha: string; metodo: string; nota: string; cantidades: CertificateRow[];
 parcialesPrevios: string[]; adendas: {id:string;version:number}[]; firmaSha256: string; artificial: boolean;
};
export async function lockManifestDocuments(tx: Prisma.TransactionClient, id: string) {
 const rows = await tx.$queryRaw<{id:string}[]>`SELECT id FROM manifiestos WHERE id = ${id} FOR UPDATE`;
 if (!rows.length) throw new AppError('Manifiesto no encontrado',404);
}
export async function certificateReadiness(tx: Prisma.TransactionClient, id: string) {
 const adendas = await tx.adendaManifiesto.findMany({where:{manifiestoId:id},select:{id:true,version:true,revisiones:true}});
 return {adendas, unresolved: adendas.filter(a => (a.revisiones as {decision:string}[]).at(-1)?.decision !== 'APROBADA').length};
}
export async function notifyCertificateParties(tx: Prisma.TransactionClient, manifest: {id:string;numero:string;generadorId:string;transportistaId:string|null;operadorId:string}, record: {id:string;tipo:string;numero:string}, authorId:string) {
 const select={activo:true,usuario:{select:{id:true,activo:true}}} as const;
 const parties=await Promise.all([
  tx.generador.findUnique({where:{id:manifest.generadorId},select}),
  manifest.transportistaId ? tx.transportista.findUnique({where:{id:manifest.transportistaId},select}) : null,
  tx.operador.findUnique({where:{id:manifest.operadorId},select}),
 ]);
 const recipients=[...new Set(parties.filter(p=>p?.activo&&p.usuario?.activo).map(p=>p!.usuario!.id))].filter(id=>id!==authorId);
 await tx.notificacion.createMany({skipDuplicates:true,data:recipients.map(usuarioId=>({
  id:sha256('certificate:'+record.id+':'+usuarioId),usuarioId,tipo:'INFO_GENERAL',prioridad:'NORMAL',manifiestoId:manifest.id,
  titulo:record.tipo==='FINAL'?'Certificación final total disponible':'Certificación parcial disponible',
  mensaje:record.numero+'. Ya podés ver y descargar el documento firmado por el operador.',
  datos:JSON.stringify({tipo:'certificado_manifiesto',version:1,documentoId:record.id,tipoCertificado:record.tipo,url:'/manifiestos/'+manifest.id+'?certificado='+record.id+'#certificaciones'}),
 }))});
}
export function renderManifestCertificate(data:CertificateSnapshot, id:string, signature:string):Promise<Buffer> {
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',margins:{top:100,bottom:55,left:45,right:45},info:{Title:data.numero,Author:'SITREP · '+data.operador,CreationDate:new Date(data.fecha)}});
  const chunks:Buffer[]=[];doc.on('data',chunk=>chunks.push(chunk));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
  function header(){
   doc.roundedRect(45,25,65,48,10).fill('#165B3C');
   doc.font('Helvetica-Bold').fontSize(30).fillColor('#FFFFFF').text('C3',52,32,{lineBreak:false});
   doc.fontSize(12).fillColor('#165B3C').text('SITREP · Certificaciones',125,35,{lineBreak:false});
   doc.font('Helvetica').fontSize(9).fillColor('#475569').text('Documento emitido por el operador',125,56,{lineBreak:false});
   doc.x=45;doc.y=100;doc.font('Helvetica').fontSize(11).fillColor('#182822');
  }
  doc.on('pageAdded',header);header();
  doc.font('Helvetica-Bold').fontSize(18).text(data.tipo==='FINAL'?'Certificación final total':'Certificación parcial');
  doc.fontSize(12).text(data.numero).moveDown();
  if(data.artificial) doc.fontSize(10).text('DATOS ARTIFICIALES · SIN VALIDEZ OFICIAL').moveDown();
  doc.font('Helvetica').fontSize(11).text('Manifiesto: '+data.manifiestoNumero).text('Generador: '+data.generador).text('Transporte: '+data.transportista).text('Operador: '+data.operador).text('Emitido por: '+data.autor);
  doc.text('Fecha: '+new Date(data.fecha).toLocaleString('es-AR',{timeZone:'America/Argentina/Mendoza',hour12:false})+' (Mendoza)');
  doc.moveDown().text('Método declarado: '+data.metodo);
  if(data.nota)doc.text('Observaciones: '+data.nota);
  doc.moveDown().font('Helvetica-Bold').text(data.tipo==='FINAL'?'Total recibido y tratado (incluye los parciales previos)':'Cantidad tratada certificada en este parcial').font('Helvetica');
  for(const row of data.cantidades)doc.text(row.corriente+': '+row.cantidad+' '+row.unidad);
  if(data.parcialesPrevios.length)doc.moveDown().text('Parciales previos: '+data.parcialesPrevios.join(', '));
  if(data.adendas.length)doc.moveDown().text((data.tipo==='FINAL'?'Adendas resueltas: ':'Adendas vinculadas: ')+data.adendas.map(a=>a.id+' v'+a.version).join(', '));
  if(doc.y>610)doc.addPage();
  doc.moveDown().text('Firma manuscrita del operador:');
  doc.image(Buffer.from(signature.split(',')[1],'base64'),45,doc.y,{fit:[220,90]});doc.y+=100;
  doc.fontSize(8).text('Registro: '+id).text('Huella de la firma: '+data.firmaSha256);
  doc.end();
 });
}
