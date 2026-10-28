import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import type { CertificateFinding } from './certificateFindings';
export const certificateCommand = z.object({
 id:z.string().uuid(),tipo:z.enum(['PARCIAL','FINAL']),firma:z.string().min(1),
 metodo:z.string().trim().max(200).default(''),nota:z.string().trim().max(500).default(''),
 cantidades:z.array(z.object({residuoId:z.string().min(1),cantidad:z.number().finite().positive()})).min(1).max(200,'El certificado admite hasta 200 cantidades; consultá a Administración para continuar.'),
 exclusionesHallazgos:z.array(z.string().min(1)).max(200,'El certificado admite hasta 200 exclusiones; consultá a Administración para continuar.').optional(),
}).strict();
export type CertificateRow={residuoId:string;corriente:string;cantidad:number;unidad:string;origen?:'HALLAZGO';adendas?:{id:string;version:number}[]};
export function certifiedRows(command:z.infer<typeof certificateCommand>,residues:{id:string;cantidadRecibida:number|null;unidad:string;tipoResiduo:{codigo:string}}[], prior:CertificateRow[][], findings:CertificateFinding[]=[]){
 if(new Set(command.cantidades.map(r=>r.residuoId)).size!==command.cantidades.length)throw new AppError('No repitas un residuo en el certificado',400);
 const excluded=command.exclusionesHallazgos||[];
 const byResidue=new Map(residues.map(row=>[row.id,row])),byFinding=new Map(findings.map(row=>[row.id,row]));
 const excludedSet=new Set(excluded),declaredCodes=new Set(residues.map(row=>row.tipoResiduo.codigo));
 const certifiedBefore=prior.flat(),priorAmounts=new Map<string,number>();
 for(const row of certifiedBefore)priorAmounts.set(row.residuoId,(priorAmounts.get(row.residuoId)||0)+row.cantidad);
 if(command.tipo!=='FINAL'&&excluded.length)throw new AppError('Las exclusiones de hallazgos corresponden sólo al certificado final',400);
 if(excludedSet.size!==excluded.length||excluded.some(id=>!byFinding.has(id)))throw new AppError('Revisá las corrientes halladas antes de certificar',409);
 if(command.tipo==='FINAL'&&excluded.length)throw new AppError('Para emitir el certificado final, completá el tratamiento de todas las corrientes halladas.',409);
 if(findings.some(f=>declaredCodes.has(f.corriente)))throw new AppError('Una corriente hallada ya figura en la declaración; revisá las adendas',409);
 if(command.tipo==='FINAL'&&certifiedBefore.some(r=>r.origen==='HALLAZGO'&&!byFinding.has(r.residuoId)))throw new AppError('Un hallazgo certificado antes ya no coincide con las adendas; revisá el expediente',409);
 const rows=command.cantidades.map(item=>{
  const residue=byResidue.get(item.residuoId);
  const finding=byFinding.get(item.residuoId);
  if(finding){
   if(excludedSet.has(item.residuoId))throw new AppError('Un hallazgo no puede estar tratado y excluido a la vez',400);
   const already=priorAmounts.get(finding.id)||0;
   if(command.tipo==='PARCIAL'&&item.cantidad+already>finding.observado+1e-9)throw new AppError('La cantidad tratada supera lo observado en la adenda',409);
   if(command.tipo==='FINAL'&&(item.cantidad>finding.observado+1e-9||item.cantidad+1e-9<already))throw new AppError('La cantidad tratada debe respetar lo observado y lo ya certificado',409);
   if(command.tipo==='FINAL'&&Math.abs(item.cantidad-finding.observado)>1e-9)throw new AppError('Para emitir el certificado final, completá el tratamiento de todas las corrientes halladas.',409);
   return {residuoId:finding.id,corriente:finding.corriente,cantidad:item.cantidad,unidad:finding.unidad,origen:'HALLAZGO' as const,adendas:finding.adendas};
  }
  if(!residue||residue.cantidadRecibida===null||residue.cantidadRecibida<=0)throw new AppError('Registrá el pesaje recibido antes de certificar',409);
  const already=priorAmounts.get(residue.id)||0;
  if(command.tipo==='PARCIAL'&&item.cantidad+already>residue.cantidadRecibida+1e-9)throw new AppError('La cantidad supera lo recibido pendiente de certificar',409);
  if(command.tipo==='FINAL'&&Math.abs(item.cantidad-residue.cantidadRecibida)>1e-9)throw new AppError('El final debe incluir el total recibido de cada residuo',409);
  return {residuoId:residue.id,corriente:residue.tipoResiduo.codigo,cantidad:item.cantidad,unidad:residue.unidad};
 });
 if(command.tipo==='FINAL'){
  const included=new Set(rows.map(row=>row.residuoId));
  if(residues.some(r=>!included.has(r.id)))throw new AppError('El final debe incluir todos los residuos',409);
  for(const finding of findings){
   if(!included.has(finding.id))throw new AppError('Para emitir el certificado final, completá el tratamiento de todas las corrientes halladas.',409);
  }
 }
 return rows;
}
