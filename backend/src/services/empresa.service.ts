import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { empresaEnabled, type EnterpriseContext } from '../domain/empresa';
import { isActorActivity } from '../domain/actorActivities';

export const canAdministerCompanies=(user:any)=>user?.rol==='ADMIN'&&!user.restricted&&!user.impersonatedBy;
export async function requireCompanyManager(db:any,user:any,empresaId:string) {
 if(!user.activo||!user.emailVerified||user.restricted||user.impersonatedBy)throw new AppError('No autorizado para administrar personas de esta empresa',403);
 const company=await db.empresa.findUnique({where:{id:empresaId}});
 if(!company?.activa)throw new AppError('Empresa no encontrada',404);
 if(!canAdministerCompanies(user)) {
  const owner=await db.responsableEmpresa.findUnique({where:{empresaId_usuarioId:{empresaId,usuarioId:user.id}}});
  if(!owner||owner.revocadoAt)throw new AppError('Se requiere responsable validado por DGFA',403);
 }
 return company;
}
export async function checkCompanyScope(db:any,empresaId:string,scope:{actividadId:string;todosEstablecimientos:boolean;establecimientoIds:string[]}) {
 const activity=await db.empresaActividad.findFirst({where:{id:scope.actividadId,empresaId,activa:true}});
 if(!activity||!isActorActivity(activity.rol))throw new AppError('Actividad no aprobada para esta empresa',400);
 if(activity.rol!=='GENERADOR'&&!scope.todosEstablecimientos)throw new AppError('El alcance por sede requiere origen de generador identificado. Para esta actividad elegí alcance completo de empresa.',400);
 if(scope.todosEstablecimientos&&scope.establecimientoIds.length||!scope.todosEstablecimientos&&!scope.establecimientoIds.length||new Set(scope.establecimientoIds).size!==scope.establecimientoIds.length)throw new AppError('Alcance de establecimientos inválido',400);
 if(scope.establecimientoIds.length&&await db.establecimientoEmpresa.count({where:{empresaId,activo:true,id:{in:scope.establecimientoIds}}})!==scope.establecimientoIds.length)throw new AppError('Establecimiento ajeno o inactivo',400);
 return activity;
}
/** Metadata only: listing a page must not hydrate every establishment of every company. */
export async function accessibleCompanyIds(user:any) {
 if(!empresaEnabled()||!user.activo||!user.emailVerified||user.restricted||user.impersonatedBy)return [];
 const [owners,grants]=await Promise.all([
  prisma.responsableEmpresa.findMany({where:{usuarioId:user.id,revocadoAt:null},select:{empresaId:true}}),
  prisma.autorizacionEmpresa.findMany({where:{usuarioId:user.id,activa:true},select:{empresaId:true,actividadId:true}}),
 ]);
 const activities=grants.length?await prisma.empresaActividad.findMany({where:{id:{in:grants.map(g=>g.actividadId)},activa:true},select:{id:true,empresaId:true}}):[];
 const active=new Map(activities.map(a=>[a.id,a.empresaId]));
 return [...new Set([...owners.map(o=>o.empresaId),...grants.filter(g=>active.get(g.actividadId)===g.empresaId).map(g=>g.empresaId)])];
}
export async function companyContexts(user:any,empresaIds?:string[]) {
 if(!empresaEnabled()||!user.activo||!user.emailVerified||user.restricted||user.impersonatedBy)return [];
 const grants=await prisma.autorizacionEmpresa.findMany({where:{usuarioId:user.id,activa:true,...(empresaIds?{empresaId:{in:empresaIds}}:{})},orderBy:[{createdAt:'asc'},{id:'asc'}]});
 if(!grants.length)return [];
 const companyIds=[...new Set(grants.map(g=>g.empresaId))];
 const [companies,activities,sites]=await Promise.all([
  prisma.empresa.findMany({where:{id:{in:companyIds},activa:true}}),
  prisma.empresaActividad.findMany({where:{empresaId:{in:companyIds},activa:true}}),
  prisma.establecimientoEmpresa.findMany({where:{empresaId:{in:companyIds},activo:true},orderBy:{codigo:'asc'}}),
 ]);
 const companiesById=new Map(companies.map(c=>[c.id,c])),activitiesById=new Map(activities.map(a=>[a.id,a]));
 const sitesByCompany=new Map<string,typeof sites>();
 for(const site of sites){const list=sitesByCompany.get(site.empresaId)||[];list.push(site);sitesByCompany.set(site.empresaId,list);}
 return grants.flatMap(g=>{
  const company=companiesById.get(g.empresaId),activity=activitiesById.get(g.actividadId);
  if(!company||!activity||activity.empresaId!==g.empresaId)return [];
  return [{empresaId:company.id,razonSocial:company.razonSocial,actividadId:activity.id,rol:activity.rol,autorizacionId:g.id,revision:g.revision,todosEstablecimientos:g.todosEstablecimientos,
   establecimientos:(sitesByCompany.get(company.id)||[]).filter(s=>g.todosEstablecimientos||g.establecimientoIds.includes(s.id)).map(s=>({id:s.id,codigo:s.codigo,nombre:s.nombre,domicilio:s.domicilio}))}];
 });
}
/** Resolve anew on EVERY request. JWT/sessionStorage never grants a company role. */
export async function resolveCompanyContext(user:any,headers:Record<string,unknown>) {
 const companyId=headers['x-sitrep-empresa'], activityId=headers['x-sitrep-empresa-actividad'],siteId=headers['x-sitrep-establecimiento'];
 if(companyId===undefined&&activityId===undefined&&siteId===undefined)return null;
 if(!empresaEnabled()||!user.activo||!user.emailVerified||user.restricted||user.impersonatedBy||!isActorActivity(user.rol))throw new AppError('Contexto de empresa no permitido',403);
 if(typeof companyId!=='string'||typeof activityId!=='string'||companyId.length>100||activityId.length>100||siteId!==undefined&&(typeof siteId!=='string'||siteId.length>100))throw new AppError('Contexto de empresa inválido',400);
 const [company,activity,grant]=await Promise.all([
  prisma.empresa.findUnique({where:{id:companyId}}),
  prisma.empresaActividad.findFirst({where:{id:activityId,empresaId:companyId,activa:true}}),
  prisma.autorizacionEmpresa.findUnique({where:{actividadId_usuarioId:{actividadId:activityId,usuarioId:user.id}}}),
 ]);
 if(!company?.activa||!activity||!grant?.activa||grant.empresaId!==companyId)throw new AppError('La autorización de empresa ya no está disponible',403);
 const site=typeof siteId==='string'?await prisma.establecimientoEmpresa.findFirst({where:{id:siteId,empresaId:companyId,activo:true}}):null;
 if(siteId&&!site||!grant.todosEstablecimientos&&(!site||!grant.establecimientoIds.includes(site.id)))throw new AppError('Establecimiento fuera de tu autorización',403);
 if(!isActorActivity(activity.rol))throw new AppError('Actividad inválida',403);
 const key=activity.rol.toLowerCase() as 'generador'|'transportista'|'operador';
 const actor=await (prisma[key] as any).findUnique({where:{id:activity.actorId}});
 if(!actor?.activo||actor.cuit.replace(/\D/g,'')!==company.cuit)throw new AppError('La ficha operativa no corresponde a la empresa',403);
 const context:EnterpriseContext={empresaId:company.id,razonSocial:company.razonSocial,actividadId:activity.id,rol:activity.rol,actorId:actor.id,establecimientoId:site?.id||null,
  ...(site?{establecimiento:site}:{}),autorizacionId:grant.id,revision:grant.revision,todasSedes:grant.todosEstablecimientos,domicilioLegal:company.domicilioLegal};
 return {context,actor,key};
}
export async function enterpriseEvent(db:any,user:any,empresaId:string,tipo:string,datos:unknown) {
 await db.eventoEmpresa.create({data:{empresaId,usuarioId:user.id,tipo,datos}});
}
