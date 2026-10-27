import { manifestCompanyRecipients } from './manifestCompanyRecipients.service';
import { createHash } from 'node:crypto';
import { institutionalPdf, PDF_STYLE } from './institutionalPdf.service';
import type { Prisma } from '@prisma/client';
import { isTrainingSession } from '../lib/trainingScope';
import { AppError } from '../middlewares/errorHandler';
import type { CertificateRow } from '../domain/trainingCertificate';
import { documentaryResolution } from '../domain/manifiestoAdendaDocument';
import { certificateFindings, type CertificateFinding } from '../domain/certificateFindings';

export const CERTIFICATE_EVENT = 'CERTIFICADO_OPERADOR_V1';
export const CERTIFICATE_MANAGED = 'CERTIFICACION_OPERADOR_V1';
export const certificatesEnabled = () => !isTrainingSession() && process.env.MANIFEST_CERTIFICATES_ENABLED === 'true';
export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export type CertificateSnapshot = {
 version: 1; tipo: 'PARCIAL' | 'FINAL'; numero: string; manifiestoNumero: string;
 generador: string; transportista: string; operador: string; autor: string;
 fecha: string; metodo: string; nota: string; cantidades: CertificateRow[];
 parcialesPrevios: string[]; adendas: {id:string;version:number}[]; firmaSha256: string; artificial: boolean;
 hallazgosNoTratados?: CertificateFinding[];
};
export async function lockManifestDocuments(tx: Prisma.TransactionClient, id: string) {
 const rows = await tx.$queryRaw<{id:string}[]>`SELECT id FROM manifiestos WHERE id = ${id} FOR UPDATE`;
 if (!rows.length) throw new AppError('Manifiesto no encontrado',404);
}
export async function certificateReadiness(tx: Prisma.TransactionClient, id: string) {
 const adendas = await tx.adendaManifiesto.findMany({where:{manifiestoId:id},select:{id:true,version:true,rectificaId:true,revisiones:true,informeHallazgo:true,declaracion:true,residuos:true}});
 const {counts}=documentaryResolution(adendas);
 return {adendas, unresolved: counts.pendientes + counts.observadas + counts.rechazadas, ...certificateFindings(adendas)};
}
export async function notifyCertificateParties(tx: Prisma.TransactionClient, manifest: {id:string;numero:string;generadorId:string;transportistaId:string|null;operadorId:string}, record: {id:string;tipo:string;numero:string}, authorId:string) {
 const select={activo:true,usuario:{select:{id:true,activo:true}}} as const;
 const parties=await Promise.all([
  tx.generador.findUnique({where:{id:manifest.generadorId},select}),
  manifest.transportistaId ? tx.transportista.findUnique({where:{id:manifest.transportistaId},select}) : null,
  tx.operador.findUnique({where:{id:manifest.operadorId},select}),
 ]);
 const companyRecipients=await manifestCompanyRecipients(tx,manifest.id);
 const companyAccess=new Map(companyRecipients.map(p=>[p.usuarioId,p.accesosEmpresa]));
 const recipients=[...new Set([...parties.filter(p=>p?.activo&&p.usuario?.activo).map(p=>p!.usuario!.id),...companyRecipients.map(p=>p.usuarioId)])].filter(id=>id!==authorId);
 await tx.notificacion.createMany({skipDuplicates:true,data:recipients.map(usuarioId=>({
  id:sha256('certificate:'+record.id+':'+usuarioId),usuarioId,tipo:'INFO_GENERAL',prioridad:'NORMAL',manifiestoId:manifest.id,
  titulo:record.tipo==='FINAL'?'Certificación final total disponible':'Certificación parcial disponible',
  mensaje:record.numero+'. Ya podés ver y descargar el documento firmado por el operador.',
  datos:JSON.stringify({tipo:'certificado_manifiesto',version:1,documentoId:record.id,tipoCertificado:record.tipo,...(companyAccess.has(usuarioId)?{accesosEmpresa:companyAccess.get(usuarioId)}:{}),url:'/manifiestos/'+manifest.id+'?certificado='+record.id+'#certificaciones'}),
 }))});
}
export function renderManifestCertificate(data: CertificateSnapshot, id: string, signature: string): Promise<Buffer> {
 return institutionalPdf(data.tipo === 'FINAL' ? 'Certificación final total' : 'Certificación parcial', data.numero, layout => {
  const doc = layout.doc;
  layout.text(data.tipo === 'FINAL' ? 'Certificación final total' : 'Certificación parcial', true, 22, PDF_STYLE.green);
  layout.text(data.numero, true, 13);
  if (data.artificial) layout.text('DATOS ARTIFICIALES · SIN VALIDEZ OFICIAL', true, 10);
  layout.fields([{label: 'Manifiesto', value: data.manifiestoNumero}, {label: 'Emisión (Mendoza)', value: new Date(data.fecha).toLocaleString('es-AR', {timeZone:'America/Argentina/Mendoza',hour12:false})}]);
  layout.section('01  PARTES Y EMISOR');
  layout.fields([{label:'Generador',value:data.generador}]);
  layout.fields([{label:'Transporte',value:data.transportista}]);
  layout.fields([{label:'Operador',value:data.operador},{label:'Emitido por',value:data.autor}]);
  layout.section('02  TRATAMIENTO CERTIFICADO');
  layout.fields([{label:'Método declarado',value:data.metodo}]);
  if (data.nota) { layout.text('Observaciones',true,9); layout.text(data.nota); }
  layout.text(data.tipo==='FINAL'?'Total recibido y tratado (incluye los parciales previos)':'Cantidad tratada certificada en este parcial',true,10);
  layout.table(['Corriente','Cantidad','Unidad'],data.cantidades.map(row=>[row.corriente,String(row.cantidad),row.unidad]),[260,155,92]);
  if(data.hallazgosNoTratados?.length) {
   layout.text('Hallazgos declarados no tratados en esta certificación',true,9);
   layout.text(data.hallazgosNoTratados.map(row=>row.corriente+' · observado: '+row.observado+' '+row.unidad).join(', '),false,9);
  }
  if(data.parcialesPrevios.length) { layout.text('Parciales previos',true,9); layout.text(data.parcialesPrevios.join(', '),false,9); }
  if(data.adendas.length) { layout.text(data.tipo==='FINAL'?'Adendas resueltas':'Adendas vinculadas',true,9); layout.text(data.adendas.map(a=>a.id+' v'+a.version).join(', '),false,8); }
  layout.section('03  FIRMA E INTEGRIDAD', 155);
  layout.text('Firma manuscrita del operador',true,10);
  const y=doc.y;doc.image(Buffer.from(signature.split(',')[1],'base64'),44,y,{fit:[220,60]});doc.y=y+70;
  layout.text('Registro: '+id,false,8);layout.text('Huella de la firma: '+data.firmaSha256,false,8,PDF_STYLE.muted);
 }, new Date(data.fecha));
}
