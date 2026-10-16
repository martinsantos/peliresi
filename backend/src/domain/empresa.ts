import { z } from 'zod';
import { verifiedCuit } from './conciliacionExterna';
export const empresaEnabled = () => process.env.ENTERPRISE_ENABLED === 'true';
const id = z.string().trim().min(1).max(100);
export const actividadEmpresa = z.enum(['GENERADOR','TRANSPORTISTA','OPERADOR']);
export const domicilioLegal = z.object({ calle:z.string().trim().max(300), localidad:z.string().trim().max(150), departamento:z.string().trim().max(100) }).strict();
export const createEmpresa = z.object({ cuit:z.string().refine(v=>!!verifiedCuit(v),'CUIT no verificable'),razonSocial:z.string().trim().min(1).max(250),nombreFantasia:z.string().trim().max(250).optional(),domicilioLegal }).strict();
export const editEmpresa = z.object({ revision:z.number().int().nonnegative(),razonSocial:z.string().trim().min(1).max(250),nombreFantasia:z.string().trim().max(250).optional(),domicilioLegal,motivo:z.string().trim().min(1).max(500) }).strict();
const coords = z.number().finite().nullable().optional();
const siteFields = { codigo:z.string().trim().min(1).max(80).transform(s=>s.toUpperCase()),nombre:z.string().trim().min(1).max(200),domicilio:z.string().trim().max(300),localidad:z.string().trim().max(150).optional(),departamento:z.string().trim().max(100).optional(),latitud:coords,longitud:coords,certificados:z.array(z.string().trim().min(1).max(100)).max(100) };
export const createEstablecimiento = z.object(siteFields).strict().refine(s=>(s.latitud==null)===(s.longitud==null)&& (s.latitud==null||Math.abs(s.latitud)<=90)&& (s.longitud==null||Math.abs(s.longitud)<=180),'Coordenadas incompletas o inválidas');
export const editEstablecimiento = z.object({...siteFields,revision:z.number().int().nonnegative(),activo:z.boolean(),motivo:z.string().trim().min(1).max(500)}).strict().refine(s=>(s.latitud==null)===(s.longitud==null)&& (s.latitud==null||Math.abs(s.latitud)<=90)&& (s.longitud==null||Math.abs(s.longitud)<=180),'Coordenadas incompletas o inválidas');
export const scopeSchema = z.object({actividadId:id,todosEstablecimientos:z.boolean(),establecimientoIds:z.array(id).max(100)}).refine(s=>s.todosEstablecimientos?s.establecimientoIds.length===0:s.establecimientoIds.length>0,'Elegí todos los establecimientos o una selección explícita');
export const invitationSchema = scopeSchema.safeExtend({email:z.string().trim().toLowerCase().email().max(254)});
export const personSchema = scopeSchema.safeExtend({email:z.string().trim().toLowerCase().email().max(254),revision:z.number().int().nonnegative().optional()});
export type EnterpriseContext = { empresaId:string;razonSocial:string;actividadId:string;rol:string;actorId:string;establecimientoId:string|null;establecimiento?:{id:string;nombre:string;domicilio:string;localidad?:string|null;departamento?:string|null;certificados:unknown};autorizacionId:string;revision:number;todasSedes:boolean;domicilioLegal:unknown };
/** Delegated access never guesses the site of an old, unassigned manifest. */
export function canReadEnterpriseManifest(context:EnterpriseContext|undefined,manifest:{contextoEmpresa?:unknown}) {
 if(!context||context.todasSedes)return true;
 const snapshot=manifest.contextoEmpresa as {empresaId?:string;establecimientoId?:string}|null;
 return snapshot?.empresaId===context.empresaId&&snapshot?.establecimientoId===context.establecimientoId;
}
