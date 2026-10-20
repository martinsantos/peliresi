import { createHash, randomUUID } from 'node:crypto';
import { scheduleCommittedManifestPush } from '../services/committed-manifest-push.service';
import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import prisma from '../lib/prisma';
import { isTrainingSession, TRAINING_REALM } from '../lib/trainingScope';
import { TRAINING_LOGINS, validateDirectTrainingClaim } from '../lib/trainingDirectLogin';
import { AppError } from '../middlewares/errorHandler';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { assertCanAccessManifiesto } from '../utils/roleFilter';
import { prepareTransportAssignment, readTransportAssignment } from '../domain/manifiestoTransportAssignment';
import { declaredTransportLabel, gpsPointSchema, handoffSchema, isOriginalCarrier, TRANSPORT_GPS_PURPOSE, transportHandoffEnabled } from '../domain/transportHandoff';
import { computeRollingHash } from '../services/blockchain.service';
import type { TramoTransporte, Prisma } from '@prisma/client';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export function handoffEnabled(_req: AuthRequest, _res: Response, next: NextFunction) {
  return transportHandoffEnabled() ? next() : next(new AppError('Función no habilitada', 404));
}
const publicLeg = ({ accesoVersion: _version, accesoHasta, huellaSolicitud: _hash, ...leg }: TramoTransporte) => ({ ...leg, accesoHasta, accesoActivo: !!_version && !!accesoHasta && accesoHasta > new Date() && !leg.fin });
const scopeClaim = () => isTrainingSession() ? { realm: TRAINING_REALM } : {};
const accessAvailable = (leg:TramoTransporte) => !leg.fin && !!leg.accesoVersion && !!leg.accesoHasta && leg.accesoHasta > new Date();
function issueAccess(leg: TramoTransporte) {
  if (!leg.accesoVersion || !leg.accesoHasta || leg.fin) return null;
  const seconds = Math.floor((leg.accesoHasta.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return null;
  return jwt.sign({ purpose: TRANSPORT_GPS_PURPOSE, jti: leg.accesoVersion, ...scopeClaim() }, config.JWT_SECRET,
    { algorithm:'HS256', audience:TRANSPORT_GPS_PURPOSE, subject:leg.id, expiresIn:seconds });
}
function assertClassroomIssuerOpen(authorId:string) {
  if(isTrainingSession()&&TRAINING_LOGINS.some(account=>account.id===authorId)) validateDirectTrainingClaim({id:authorId,realm:TRAINING_REALM,trainingDirect:true});
}
async function lockedManifest(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM manifiestos WHERE id = ${id} FOR UPDATE`;
  return tx.manifiesto.findUnique({ where:{id}, include:{transportista:true} });
}
async function carrierManifest(req: AuthRequest, tx: Tx) {
  assertClassroomIssuerOpen(req.user.id);
  const manifest = await lockedManifest(tx, req.params.id);
  if (!manifest || !isOriginalCarrier(req.user, manifest)) throw new AppError('Sólo la transportista de origen define el traspaso', 403);
  if (manifest.estado !== 'EN_TRANSITO' || manifest.modalidad === 'IN_SITU') throw new AppError('El traspaso requiere un manifiesto en tránsito', 409);
  return manifest;
}
export async function listTransportLegs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await assertCanAccessManifiesto(prisma,req.user,req.params.id);
    const manifest = await prisma.manifiesto.findUniqueOrThrow({where:{id:req.params.id},select:{estado:true,transportistaId:true}});
    const tramos = await prisma.tramoTransporte.findMany({where:{manifiestoId:req.params.id},orderBy:{orden:'asc'}});
    res.setHeader('Cache-Control','private, no-store');
    res.json({success:true,data:{tramos:tramos.map(publicLeg),puedeRegistrar:manifest.estado==='EN_TRANSITO'&&isOriginalCarrier(req.user,manifest)}});
  } catch(error) { next(error); }
}
export async function assignedTransportHandoffs(req:AuthRequest,res:Response,next:NextFunction) {
  try {
    const carrier=req.user.rol==='TRANSPORTISTA'?req.user.transportista?.id:null;
    if(!carrier)throw new AppError('Transportista no asociada a la cuenta',403);
    const legs=await prisma.tramoTransporte.findMany({where:{transportistaId:carrier,tipo:'REGISTRADO'},
      orderBy:[{fin:{sort:'desc',nulls:'first'}},{inicio:'desc'}],take:100,include:{manifiesto:{select:{numero:true,estado:true,operador:{select:{razonSocial:true}}}}}});
    res.setHeader('Cache-Control','private, no-store');
    res.json({success:true,data:legs.map(leg=>({tramoId:leg.id,numero:leg.manifiesto.numero,destino:leg.manifiesto.operador.razonSocial,inicio:leg.inicio,fin:leg.fin,accesoDisponible:leg.manifiesto.estado==='EN_TRANSITO'&&accessAvailable(leg)}))});
  }catch(error){next(error);}
}
export async function assignedTransportAccess(req:AuthRequest,res:Response,next:NextFunction) {
  try {
    const carrier=req.user.rol==='TRANSPORTISTA'?req.user.transportista?.id:null;
    if(!carrier)throw new AppError('Transportista no asociada a la cuenta',403);
    const leg=await prisma.tramoTransporte.findFirst({where:{id:req.params.tramoId,transportistaId:carrier,fin:null,tipo:'REGISTRADO',manifiesto:{estado:'EN_TRANSITO'}}});
    if(!leg)throw new AppError('Relevo no encontrado',404);
    const access=issueAccess(leg);if(!access)throw new AppError('Pedí un nuevo enlace a la transportista de origen',403);
    res.setHeader('Cache-Control','private, no-store');res.json({success:true,data:{acceso:access}});
  }catch(error){next(error);}
}
export async function createTransportHandoff(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await assertCanAccessManifiesto(prisma,req.user,req.params.id);
    const parsed=handoffSchema.safeParse(req.body);
    if(!parsed.success) throw new AppError(parsed.error.issues[0].message,400);
    const command=parsed.data;
    const requestHash=createHash('sha256').update(JSON.stringify(command)).digest('hex');
    let pushIds:string[]=[];
    const leg=await prisma.$transaction(async tx=>{
      const manifest=await carrierManifest(req,tx);
      const existing=await tx.tramoTransporte.findUnique({where:{id:command.id}});
      if(existing) {
        if(existing.manifiestoId!==manifest.id||existing.creadoPorId!==req.user.id||existing.impersonadoPorId!==(req.user.impersonatedBy?.id??null)||existing.huellaSolicitud!==requestHash) throw new AppError('La referencia del relevo ya tiene otro contenido',409);
        return existing;
      }
      const current=await tx.tramoTransporte.findFirst({where:{manifiestoId:manifest.id,fin:null}});
      if((current?.id??null)!==command.anteriorId) throw new AppError('El transporte cambió. Actualizá los tramos antes de registrar otro relevo.',409);
      let datos:Prisma.InputJsonObject={...command.datos};
      if(command.tipo==='REGISTRADO') {
        const carrier=await tx.transportista.findFirst({where:{id:command.transportistaId,activo:true}});
        if(!carrier) throw new AppError('Transportista registrada no disponible',400);
        const selection=await prepareTransportAssignment(tx,{modalidad:'FIJO',transportistaId:carrier.id,vehiculoId:command.vehiculoId,choferId:command.choferId});
        datos={...datos,empresa:carrier.razonSocial,cuit:carrier.cuit,...(selection?{registro:selection}:{}),
          ...(selection?.vehiculo?{patente:selection.vehiculo.patente}:{}),
          ...(selection?.chofer?{chofer:`${selection.chofer.nombre} ${selection.chofer.apellido}`,documento:selection.chofer.dni}:{})};
      }
      const now=new Date();
      const last=await tx.tramoTransporte.findFirst({where:{manifiestoId:manifest.id},orderBy:{orden:'desc'}});
      if(!current&&!last) {
        const assigned=readTransportAssignment(manifest.asignacionTransporte,manifest.transportistaId);
        await tx.tramoTransporte.create({data:{id:randomUUID(),manifiestoId:manifest.id,orden:0,tipo:'ORIGINAL',transportistaId:manifest.transportistaId,
          datos:{empresa:manifest.transportista?.razonSocial||'Transporte original',...(assigned?.vehiculo?{patente:assigned.vehiculo.patente}:{}),
            ...(assigned?.chofer?{chofer:`${assigned.chofer.nombre} ${assigned.chofer.apellido}`,documento:assigned.chofer.dni}:{})},
          creadoPorId:req.user.id,impersonadoPorId:req.user.impersonatedBy?.id??null,motivo:'Asignación original del manifiesto',huellaSolicitud:'original',inicio:manifest.fechaRetiro||now,fin:now}});
      }
      if(current) await tx.tramoTransporte.update({where:{id:current.id},data:{fin:now,accesoVersion:null,accesoHasta:null}});
      const created=await tx.tramoTransporte.create({data:{id:command.id,manifiestoId:manifest.id,orden:(last?.orden??0)+1,tipo:command.tipo,
        transportistaId:command.tipo==='REGISTRADO'?command.transportistaId:null,datos,creadoPorId:req.user.id,impersonadoPorId:req.user.impersonatedBy?.id??null,motivo:command.motivo,
        huellaSolicitud:requestHash,inicio:now,latitud:command.latitud,longitud:command.longitud,
        accesoVersion:randomUUID(),accesoHasta:new Date(now.getTime()+24*60*60*1000)}});
      const event=await tx.eventoManifiesto.create({data:{manifiestoId:manifest.id,tipo:'RELEVO_TRANSPORTE',usuarioId:req.user.id,
        descripcion:`Traspaso declarado por la transportista de origen a ${declaredTransportLabel(datos)}${command.tipo==='EXTERNO'?' (eventual con datos declarados)':''}. Motivo: ${command.motivo}`,
        latitud:command.latitud,longitud:command.longitud}});
      const integrityHash=computeRollingHash({previousHash:manifest.rollingHash,genesisBlockchainTimestamp:manifest.blockchainTimestamp?.toISOString()??null,
        estado:manifest.estado,fecha:now.toISOString(),eventCount:await tx.eventoManifiesto.count({where:{manifiestoId:manifest.id}}),observaciones:`relevo:${created.id}:${requestHash}`});
      await tx.manifiesto.update({where:{id:manifest.id},data:{rollingHash:integrityHash}});
      await tx.eventoManifiesto.update({where:{id:event.id},data:{integrityHash}});
      const actors=await Promise.all([
        tx.generador.findUnique({where:{id:manifest.generadorId},select:{usuarioId:true}}),
        tx.operador.findUnique({where:{id:manifest.operadorId},select:{usuarioId:true}}),
        command.transportistaId?tx.transportista.findUnique({where:{id:command.transportistaId},select:{usuarioId:true}}):null,
        current?.transportistaId?tx.transportista.findUnique({where:{id:current.transportistaId},select:{usuarioId:true}}):null,
      ]);
      const admins=await tx.usuario.findMany({where:{rol:'ADMIN',activo:true},select:{id:true}});
      const recipients=[...new Set([req.user.id,...actors.map(a=>a?.usuarioId),...admins.map(a=>a.id)].filter((id):id is string=>!!id))];
      const notices=recipients.map(usuarioId=>({
        id:createHash('sha256').update(`relevo:${created.id}:${usuarioId}`).digest('hex'),usuarioId,tipo:'INFO_GENERAL' as const,
        titulo:'Cambio de transporte en tránsito',mensaje:`${manifest.numero}: ${declaredTransportLabel(datos)}. La transportista de origen registró el traspaso.`,
        manifiestoId:manifest.id,datos:JSON.stringify({tipo:'relevo_transporte',tramoId:created.id,url:[actors[2]?.usuarioId,actors[3]?.usuarioId].includes(usuarioId)&&usuarioId!==req.user.id?'/transporte/perfil':`/manifiestos/${manifest.id}`}),
      }));
      const inserted=await tx.notificacion.createMany({skipDuplicates:true,data:notices});
      if(inserted.count===notices.length)pushIds=notices.map(notice=>notice.id);
      return created;
    });
    scheduleCommittedManifestPush(pushIds);
    res.setHeader('Cache-Control','private, no-store');
    res.status(201).json({success:true,data:{tramo:publicLeg(leg),acceso:issueAccess(leg)}});
  } catch(error) { next(error); }
}
export async function rotateTransportAccess(req: AuthRequest,res:Response,next:NextFunction) {
  try {
    await assertCanAccessManifiesto(prisma,req.user,req.params.id);
    if(typeof req.body?.revocar!=='boolean') throw new AppError('Indicá si querés revocar el acceso',400);
    const leg=await prisma.$transaction(async tx=>{
      const manifest=await carrierManifest(req,tx);
      const current=await tx.tramoTransporte.findFirst({where:{id:req.params.tramoId,manifiestoId:manifest.id,fin:null,tipo:{not:'ORIGINAL'}}});
      if(!current) throw new AppError('Tramo activo no encontrado',404);
      const updated=await tx.tramoTransporte.update({where:{id:current.id},data:{accesoVersion:req.body.revocar?null:randomUUID(),accesoHasta:req.body.revocar?null:new Date(Date.now()+86400000)}});
      await tx.eventoManifiesto.create({data:{manifiestoId:manifest.id,tipo:'ACCESO_RELEVO',usuarioId:req.user.id,descripcion:req.body.revocar?'La transportista de origen revocó el acceso GPS del relevo':'La transportista de origen renovó el acceso GPS del relevo; el anterior dejó de ser válido'}});
      return updated;
    });
    res.setHeader('Cache-Control','private, no-store');
    res.json({success:true,data:{tramo:publicLeg(leg),acceso:issueAccess(leg)}});
  }catch(error){next(error);}
}

function trackingClaim(req:AuthRequest) {
  try {
    const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'';
    const claim=jwt.verify(token,config.JWT_SECRET,{algorithms:['HS256'],audience:TRANSPORT_GPS_PURPOSE});
    if(typeof claim==='string'||claim.purpose!==TRANSPORT_GPS_PURPOSE||claim.sub!==req.params.tramoId||typeof claim.jti!=='string'
      ||(isTrainingSession()?claim.realm!==TRAINING_REALM:claim.realm!==undefined)) throw Error('Invalid scope');
    return claim;
  }catch{throw new AppError('El enlace de seguimiento no es válido o venció. Pedí uno nuevo a la transportista de origen.',401);}
}
async function liveLeg(tx:Tx,claim:jwt.JwtPayload) {
  const leg=await tx.tramoTransporte.findUnique({where:{id:claim.sub!},include:{manifiesto:{select:{id:true,numero:true,estado:true,transportistaId:true,operador:{select:{razonSocial:true,domicilio:true}}}}}});
  if(!leg||leg.fin||leg.accesoVersion!==claim.jti||!leg.accesoHasta||leg.accesoHasta<=new Date()||leg.manifiesto.estado!=='EN_TRANSITO') throw new AppError('Este seguimiento ya no está activo',403);
  assertClassroomIssuerOpen(leg.creadoPorId);
  const author=await tx.usuario.findUnique({where:{id:leg.creadoPorId},select:{activo:true,transportista:{select:{id:true}}}});
  if(!author?.activo||author.transportista?.id!==leg.manifiesto.transportistaId) throw new AppError('El acceso fue revocado por la transportista de origen',403);
  if(leg.impersonadoPorId){
    const instructor=await tx.usuario.findUnique({where:{id:leg.impersonadoPorId},select:{rol:true,activo:true}});
    if(!instructor?.activo||instructor.rol!=='ADMIN')throw new AppError('El acceso delegado ya no está activo',403);
  }
  return leg;
}
export async function limitedTransportState(req:AuthRequest,res:Response,next:NextFunction) {
  try {
    const claim=trackingClaim(req);
    const leg=await prisma.$transaction(tx=>liveLeg(tx,claim));
    res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');
    const latest=await prisma.trackingGPS.findFirst({where:{tramoId:leg.id},orderBy:{timestamp:'desc'},select:{timestamp:true}});
    res.json({success:true,data:{tramoId:leg.id,numero:leg.manifiesto.numero,orden:leg.orden,tipo:leg.tipo,empresa:declaredTransportLabel(leg.datos),
      destino:leg.manifiesto.operador.razonSocial,domicilioDestino:leg.manifiesto.operador.domicilio,inicio:leg.inicio,ultimaPosicion:latest?.timestamp??null,vence:leg.accesoHasta,training:isTrainingSession()}});
  }catch(error){next(error);}
}
export async function limitedTransportGps(req:AuthRequest,res:Response,next:NextFunction) {
  try {
    const claim=trackingClaim(req);const parsed=gpsPointSchema.safeParse(req.body);
    if(!parsed.success) throw new AppError(parsed.error.issues[0].message,400);
    const tracking=await prisma.$transaction(async tx=>{
      // Serialize GPS with delivery and handoff on the SAME parent row in all workers.
      const candidate=await tx.tramoTransporte.findUnique({where:{id:claim.sub!},select:{manifiestoId:true}});
      if(!candidate) throw new AppError('Tramo no encontrado',404);
      await tx.$queryRaw`SELECT id FROM manifiestos WHERE id = ${candidate.manifiestoId} FOR SHARE`;
      const leg=await liveLeg(tx,claim);
      return tx.trackingGPS.create({data:{...parsed.data,manifiestoId:leg.manifiestoId,tramoId:leg.id,emisor:`acceso-relevo:${claim.jti}`},select:{id:true,timestamp:true,tramoId:true}});
    });
    res.setHeader('Cache-Control','private, no-store');res.json({success:true,data:{tracking}});
  }catch(error){next(error);}
}
