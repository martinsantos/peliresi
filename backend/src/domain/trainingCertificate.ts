import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
export const certificateCommand = z.object({
 id:z.string().uuid(),tipo:z.enum(['PARCIAL','FINAL']),firma:z.string().min(1),
 metodo:z.string().trim().min(1).max(200),nota:z.string().trim().min(1).max(500),
 cantidades:z.array(z.object({residuoId:z.string().min(1),cantidad:z.number().finite().positive()})).min(1).max(50),
}).strict();
export type CertificateRow={residuoId:string;corriente:string;cantidad:number;unidad:string};
export function certifiedRows(command:z.infer<typeof certificateCommand>,residues:{id:string;cantidadRecibida:number|null;unidad:string;tipoResiduo:{codigo:string}}[], prior:CertificateRow[][]){
 if(new Set(command.cantidades.map(r=>r.residuoId)).size!==command.cantidades.length)throw new AppError('No repitas un residuo en el certificado',400);
 const rows=command.cantidades.map(item=>{
  const residue=residues.find(r=>r.id===item.residuoId);
  if(!residue||residue.cantidadRecibida===null||residue.cantidadRecibida<=0)throw new AppError('Registrá el pesaje recibido antes de certificar',409);
  const already=prior.flat().filter(r=>r.residuoId===residue.id).reduce((n,r)=>n+r.cantidad,0);
  if(command.tipo==='PARCIAL'&&item.cantidad+already>residue.cantidadRecibida+1e-9)throw new AppError('La cantidad supera lo recibido pendiente de certificar',409);
  if(command.tipo==='FINAL'&&Math.abs(item.cantidad-residue.cantidadRecibida)>1e-9)throw new AppError('El final debe incluir el total recibido de cada residuo',409);
  return {residuoId:residue.id,corriente:residue.tipoResiduo.codigo,cantidad:item.cantidad,unidad:residue.unidad};
 });
 if(command.tipo==='FINAL'&&rows.length!==residues.length)throw new AppError('El final debe incluir todos los residuos',409);
 return rows;
}
