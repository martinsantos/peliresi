import { Response,NextFunction } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createEmpresa,editEmpresa,createEstablecimiento,editEstablecimiento,actividadEmpresa,invitationSchema,personSchema } from '../domain/empresa';
import { verifiedCuit } from '../domain/conciliacionExterna';
import { canAdministerCompanies,requireCompanyManager,checkCompanyScope,enterpriseEvent,companyContexts } from '../services/empresa.service';

const parse=<T>(schema:z.ZodType<T>,body:unknown):T=>{const result=schema.safeParse(body);if(!result.success)throw new AppError(result.error.issues[0].message,400);return result.data;};
const transaction=async<T>(fn:(db:any)=>Promise<T>)=>prisma.$transaction(fn,{isolationLevel:'Serializable'});
const send=(res:Response,data:unknown,status=200)=>res.status(status).json({success:true,data});
export const companyAction=(fn:(req:AuthRequest,res:Response)=>Promise<unknown>)=>(req:AuthRequest,res:Response,next:NextFunction)=>{void fn(req,res).catch((error:any)=>next(['P2002','P2034'].includes(error?.code)?new AppError('El registro cambió o ya existe. Recargá antes de volver a guardar.',409):error));};
const dgfa=(user:any)=>{if(!canAdministerCompanies(user))throw new AppError('Sólo DGFA puede validar responsables y actividades',403);};

export const listCompanies=companyAction(async(req,res)=>{
 const user=req.user,contexts=await companyContexts(user);
 const owners=await prisma.responsableEmpresa.findMany({where:{usuarioId:user.id,revocadoAt:null},select:{empresaId:true}});
 const companies=await prisma.empresa.findMany({where:canAdministerCompanies(user)?{activa:true}:{id:{in:[...new Set([...owners.map(o=>o.empresaId),...contexts.map(c=>c.empresaId)])]},activa:true},orderBy:{razonSocial:'asc'},take:200});
 return send(res,{empresas:companies,contextos:contexts,puedeValidar:canAdministerCompanies(user)});
});
export const getCompany=companyAction(async(req,res)=>{
 const id=req.params.id,user=req.user,company=await prisma.empresa.findUnique({where:{id}});
 if(!company?.activa)throw new AppError('Empresa no encontrada',404);
 const contexts=await companyContexts(user);
 let manage=canAdministerCompanies(user);
 if(!manage)manage=!!await prisma.responsableEmpresa.findFirst({where:{empresaId:id,usuarioId:user.id,revocadoAt:null}});
 if(!manage&&!contexts.some(c=>c.empresaId===id))throw new AppError('Empresa no encontrada',404);
 const [activities,sites,authorizations,responsibles,events,invitations]=await Promise.all([
  prisma.empresaActividad.findMany({where:{empresaId:id},orderBy:{rol:'asc'}}),
  prisma.establecimientoEmpresa.findMany({where:{empresaId:id,...(!manage?{id:{in:contexts.filter(c=>c.empresaId===id).flatMap(c=>c.establecimientos.map(s=>s.id))}}:{})},orderBy:{codigo:'asc'}}),
  manage?prisma.autorizacionEmpresa.findMany({where:{empresaId:id},orderBy:{createdAt:'asc'}}):[],
  manage?prisma.responsableEmpresa.findMany({where:{empresaId:id}}):[],
  manage?prisma.eventoEmpresa.findMany({where:{empresaId:id},orderBy:{createdAt:'desc'},take:50}):[],
  manage?prisma.invitacionEmpresa.findMany({where:{empresaId:id},select:{id:true,email:true,venceAt:true,aceptadaAt:true,revocadaAt:true,actividadId:true},orderBy:{createdAt:'desc'},take:50}):[],
 ]);
 const users=manage?await prisma.usuario.findMany({where:{id:{in:[...new Set([...authorizations.map(a=>a.usuarioId),...responsibles.map(r=>r.usuarioId)])]}},select:{id:true,nombre:true,email:true,activo:true,emailVerified:true}}):[];
 return send(res,{empresa:company,actividades:manage?activities:activities.filter(a=>contexts.some(c=>c.actividadId===a.id)),establecimientos:sites,autorizaciones:authorizations,responsables:responsibles,eventos:events,invitaciones:invitations,personas:users,puedeGestionar:manage,puedeValidar:canAdministerCompanies(user)});
});
export const addCompany=companyAction(async(req,res)=>{
 dgfa(req.user);const data=parse(createEmpresa,req.body);
 const company=await transaction(async db=>{
  const c=await db.empresa.create({data:{...data,cuit:verifiedCuit(data.cuit)!}});
  await enterpriseEvent(db,req.user,c.id,'EMPRESA_CREADA',{despues:c});return c;
 });return send(res,{empresa:company},201);
});
export const updateCompany=companyAction(async(req,res)=>{
 const {revision,motivo,...data}=parse(editEmpresa,req.body);
 const company=await transaction(async db=>{
  const before=await requireCompanyManager(db,req.user,req.params.id);
  if(before.revision!==revision)throw new AppError('La empresa cambió. Recargá para revisar las diferencias.',409);
  const after=await db.empresa.update({where:{id:before.id},data:{...data,revision:{increment:1}}});
  await enterpriseEvent(db,req.user,before.id,'DOMICILIO_LEGAL_ACTUALIZADO',{antes:before,despues:after,motivo});return after;
 });return send(res,{empresa:company});
});
export const addCompanyActivity=companyAction(async(req,res)=>{
 dgfa(req.user);const data=parse(z.object({rol:actividadEmpresa,actorId:z.string().min(1).max(100)}).strict(),req.body);
 const activity=await transaction(async db=>{
  const company=await requireCompanyManager(db,req.user,req.params.id);
  const actor=await db[data.rol.toLowerCase()].findUnique({where:{id:data.actorId}});
  if(!actor?.activo||verifiedCuit(actor.cuit)!==company.cuit)throw new AppError('La ficha debe estar activa y tener el mismo CUIT confirmado',400);
  // Link an existing approved role, never manufacture an actor or approval.
  const existing=await db.empresaActividad.findUnique({where:{empresaId_rol:{empresaId:company.id,rol:data.rol}}});
  if(existing){if(existing.actorId===actor.id&&existing.activa)return existing;throw new AppError('Esta actividad tiene otra ficha; requiere conciliación.',409);}
  const a=await db.empresaActividad.create({data:{empresaId:company.id,...data,aprobadaPor:req.user.id}});
  await enterpriseEvent(db,req.user,company.id,'ACTIVIDAD_VINCULADA',{actividad:a});return a;
 });return send(res,{actividad:activity},201);
});
export const validateResponsible=companyAction(async(req,res)=>{
 dgfa(req.user);const data=parse(z.object({email:z.string().trim().toLowerCase().email(),motivo:z.string().trim().min(1).max(500),revocar:z.boolean().optional()}).strict(),req.body);
 const result=await transaction(async db=>{
  await requireCompanyManager(db,req.user,req.params.id);
  const user=await db.usuario.findUnique({where:{email:data.email}});
  if(!user?.activo||!user.emailVerified)throw new AppError('El responsable necesita una cuenta activa con correo verificado',400);
  const r=await db.responsableEmpresa.upsert({where:{empresaId_usuarioId:{empresaId:req.params.id,usuarioId:user.id}},create:{empresaId:req.params.id,usuarioId:user.id,validadoPor:req.user.id,motivo:data.motivo,...(data.revocar?{revocadoAt:new Date()}:{})},update:{validadoPor:req.user.id,validadoAt:new Date(),revocadoAt:data.revocar?new Date():null,motivo:data.motivo}});
  await enterpriseEvent(db,req.user,req.params.id,data.revocar?'RESPONSABLE_REVOCADO':'RESPONSABLE_VALIDADO',{usuarioId:user.id,motivo:data.motivo});return r;
 });return send(res,{responsable:result});
});
export const saveSite=companyAction(async(req,res)=>{
 const edit=!!req.params.siteId;const parsed:any=edit?parse(editEstablecimiento,req.body):parse(createEstablecimiento,req.body);
 const site=await transaction(async db=>{
  await requireCompanyManager(db,req.user,req.params.id);const {revision,motivo,...data}=parsed;
  const before=edit?await db.establecimientoEmpresa.findFirst({where:{id:req.params.siteId,empresaId:req.params.id}}):null;
  if(edit&&(!before||before.revision!==revision))throw new AppError('El establecimiento cambió. Recargá antes de guardar.',409);
  const after=edit?await db.establecimientoEmpresa.update({where:{id:before.id},data:{...data,revision:{increment:1}}}):await db.establecimientoEmpresa.create({data:{...data,empresaId:req.params.id}});
  await enterpriseEvent(db,req.user,req.params.id,edit?'ESTABLECIMIENTO_ACTUALIZADO':'ESTABLECIMIENTO_CREADO',{antes:before,despues:after,motivo:motivo||null});return after;
 });return send(res,{establecimiento:site},edit?200:201);
});
async function authorizePerson(db:any,actor:any,empresaId:string,data:{actividadId:string;todosEstablecimientos:boolean;establecimientoIds:string[]},userId:string,revision?:number) {
 await checkCompanyScope(db,empresaId,data);
 const before=await db.autorizacionEmpresa.findUnique({where:{actividadId_usuarioId:{actividadId:data.actividadId,usuarioId:userId}}});
 if(before&&before.revision!==revision)throw new AppError('El acceso ya existe o cambió. Revisalo antes de modificarlo.',409);
 const after=before?await db.autorizacionEmpresa.update({where:{id:before.id},data:{...data,activa:true,otorgadaPor:actor.id,revision:{increment:1}}}):await db.autorizacionEmpresa.create({data:{...data,empresaId,usuarioId:userId,otorgadaPor:actor.id}});
 await enterpriseEvent(db,actor,empresaId,'PERSONA_AUTORIZADA',{antes:before,despues:after});return after;
}
export const addPerson=companyAction(async(req,res)=>{
 const data=parse(personSchema,req.body);
 const grant=await transaction(async db=>{
  await requireCompanyManager(db,req.user,req.params.id);
  const user=await db.usuario.findUnique({where:{email:data.email}});
  if(!user?.activo||!user.emailVerified||!['GENERADOR','TRANSPORTISTA','OPERADOR'].includes(user.rol))throw new AppError('La persona necesita una cuenta operativa activa y correo verificado. Podés invitarla para completar su acceso.',400);
  return authorizePerson(db,req.user,req.params.id,{actividadId:data.actividadId,todosEstablecimientos:data.todosEstablecimientos,establecimientoIds:data.establecimientoIds},user.id,data.revision);
 });return send(res,{autorizacion:grant},201);
});
export const revokePerson=companyAction(async(req,res)=>{
 const data=parse(z.object({revision:z.number().int().nonnegative(),motivo:z.string().trim().min(1).max(500)}).strict(),req.body);
 await transaction(async db=>{
  await requireCompanyManager(db,req.user,req.params.id);
  const g=await db.autorizacionEmpresa.findFirst({where:{id:req.params.grantId,empresaId:req.params.id}});
  if(!g||g.revision!==data.revision)throw new AppError('El acceso cambió. Recargá para revisarlo.',409);
  if(!g.activa)throw new AppError('El acceso ya está revocado',409);
  await db.autorizacionEmpresa.update({where:{id:g.id},data:{activa:false,revision:{increment:1}}});
  await enterpriseEvent(db,req.user,req.params.id,'PERSONA_REVOCADA',{antes:g,motivo:data.motivo});
 });return send(res,{revocada:true});
});
export const invitePerson=companyAction(async(req,res)=>{
 const data=parse(invitationSchema,req.body),token=crypto.randomBytes(32).toString('hex');
 const invitation=await transaction(async db=>{
  await requireCompanyManager(db,req.user,req.params.id);await checkCompanyScope(db,req.params.id,data);
  const i=await db.invitacionEmpresa.create({data:{...data,empresaId:req.params.id,tokenHash:crypto.createHash('sha256').update(token).digest('hex'),creadaPor:req.user.id,venceAt:new Date(Date.now()+86400000)}});
  await enterpriseEvent(db,req.user,req.params.id,'PERSONA_INVITADA',{invitacionId:i.id,email:i.email,actividadId:i.actividadId});return i;
 });return send(res,{invitacion:{id:invitation.id,email:invitation.email,venceAt:invitation.venceAt},ruta:'/empresa-invitacion/'+token,enviada:false},201);
});
const tokenHash=(token:unknown)=>{if(typeof token!=='string'||!/^\w{64}$/.test(token))throw new AppError('Invitación no disponible',404);return crypto.createHash('sha256').update(token).digest('hex');};
async function availableInvitation(db:any,hash:string) {
 const i=await db.invitacionEmpresa.findUnique({where:{tokenHash:hash}});
 if(!i||i.revocadaAt||i.aceptadaAt||i.venceAt<new Date())throw new AppError('Invitación vencida, utilizada o revocada',404);
 const issuer=await db.usuario.findUnique({where:{id:i.creadaPor}});
 if(!issuer?.activo)throw new AppError('Invitación no disponible',404);
 await requireCompanyManager(db,{...issuer,restricted:false},i.empresaId);
 const activity=await checkCompanyScope(db,i.empresaId,i);return {i,activity};
}
export const getInvitation=companyAction(async(req,res)=>{
 const {i,activity}=await availableInvitation(prisma,tokenHash(req.params.token));
 const company=await prisma.empresa.findUniqueOrThrow({where:{id:i.empresaId}});
 return send(res,{empresa:company.razonSocial,email:i.email,rol:activity.rol,venceAt:i.venceAt});
});
export const acceptInvitation=companyAction(async(req,res)=>{
 const data=parse(z.object({email:z.string().trim().toLowerCase().email(),password:z.string().min(1).max(200)}).strict(),req.body),hash=tokenHash(req.params.token);
 const {i}=await availableInvitation(prisma,hash);
 const user=await prisma.usuario.findUnique({where:{email:data.email}});
 if(i.email!==data.email||!user||!await bcrypt.compare(data.password,user.password))throw new AppError('No pudimos confirmar la cuenta de esta invitación',403);
 if(!user.emailVerified)throw new AppError('Verificá tu correo antes de aceptar la invitación',403);
 if(user.motivoInactividad==='SUSPENDIDA'||!['GENERADOR','TRANSPORTISTA','OPERADOR'].includes(user.rol))throw new AppError('Esta cuenta no puede aceptar la invitación',403);
 await transaction(async db=>{
  const {i:current}=await availableInvitation(db,hash);
  const fresh=await db.usuario.findUniqueOrThrow({where:{id:user.id}});
  if(!fresh.emailVerified||fresh.motivoInactividad==='SUSPENDIDA'||fresh.email!==current.email||fresh.password!==user.password)throw new AppError('Cuenta no disponible',403);
  if(!fresh.activo) {
   const [actors,applications]=await Promise.all([Promise.all(['generador','transportista','operador'].map(k=>db[k].count({where:{usuarioId:user.id}}))),db.solicitudInscripcion.count({where:{usuarioId:user.id}})]);
   if(fresh.motivoInactividad!=='PENDIENTE_APROBACION'||fresh.cuit||actors.some((n:number)=>n>0)||applications)throw new AppError('La cuenta tiene una revisión propia pendiente. Debe resolverla DGFA.',403);
   await db.usuario.update({where:{id:user.id},data:{activo:true,motivoInactividad:null}});
  }
  await authorizePerson(db,{id:current.creadaPor},current.empresaId,current,user.id);
  await db.invitacionEmpresa.update({where:{id:current.id},data:{aceptadaPor:user.id,aceptadaAt:new Date()}});
  await enterpriseEvent(db,{id:user.id},current.empresaId,'INVITACION_ACEPTADA',{invitacionId:current.id});
 });return send(res,{aceptada:true});
});
export const revokeInvitation=companyAction(async(req,res)=>{
 await transaction(async db=>{
  await requireCompanyManager(db,req.user,req.params.id);
  const i=await db.invitacionEmpresa.findFirst({where:{id:req.params.inviteId,empresaId:req.params.id}});
  if(!i||i.aceptadaAt)throw new AppError('La invitación ya no está pendiente',409);
  await db.invitacionEmpresa.update({where:{id:i.id},data:{revocadaAt:new Date()}});
  await enterpriseEvent(db,req.user,req.params.id,'INVITACION_REVOCADA',{invitacionId:i.id});
 });return send(res,{revocada:true});
});
