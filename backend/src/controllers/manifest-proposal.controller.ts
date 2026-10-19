import { notifyManifestParties } from '../services/manifestProposal.service';
import { applyRoleFilter } from '../utils/roleFilter';
import { Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import prisma from '../lib/prisma';
import { isTrainingSession } from '../lib/trainingScope';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { assertCanAccessManifiesto } from '../utils/roleFilter';
import { MANIFEST_PROPOSAL, APPROVAL_EVENTS, parseProposal, proposalRole, ProposalRole } from '../domain/manifestProposal';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
async function load(tx: Tx, id: string) {
  const marker = await tx.eventoManifiesto.findFirst({ where: { manifiestoId: id, tipo: MANIFEST_PROPOSAL } });
  if (!marker) return null;
  const proposal = parseProposal(marker.descripcion);
  const manifest = await tx.manifiesto.findUniqueOrThrow({ where: { id } });
  if (manifest.generadorId !== proposal.generadorId || manifest.transportistaId !== proposal.transportistaId || manifest.operadorId !== proposal.operadorId || manifest.creadoPorId !== proposal.creadoPorId) throw new AppError('Las partes no coinciden con la propuesta original', 409);
  const events = await tx.eventoManifiesto.findMany({ where: { manifiestoId: id, tipo: { in: [...Object.values(APPROVAL_EVENTS), 'RECHAZO_PARTE', 'INICIO_COORDINACION_CAP'] } }, orderBy: { createdAt: 'asc' } });
  return { proposal, manifest, events };
}
export async function getManifestProposal(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!isTrainingSession()) throw new AppError('Función no habilitada', 404);
    await assertCanAccessManifiesto(prisma, req.user, req.params.id);
    const value = await prisma.$transaction(tx => load(tx, req.params.id));
    const role = value ? proposalRole(req.user, value.proposal) : null;
    res.json({ success: true, data: value ? {
      version: 1, autorRol: value.proposal.autorRol, estado: value.manifest.estado, rechazo: value.events.find(e => e.tipo === 'RECHAZO_PARTE')?.descripcion,
      partes: (Object.keys(APPROVAL_EVENTS) as ProposalRole[]).map(rol => {
        const event = value.events.find(e => e.tipo === APPROVAL_EVENTS[rol]);
        return { rol, aprobada: !!event, usuarioId: event?.usuarioId, fecha: event?.createdAt };
      }),
      inicio: value.events.find(e => e.tipo === 'INICIO_COORDINACION_CAP')?.createdAt || null,
      puedeIniciar: !!role && value.manifest.estado === 'APROBADO' && !value.events.some(e => e.tipo === 'INICIO_COORDINACION_CAP'),
      puedeAprobar: value.manifest.estado === 'PENDIENTE_APROBACION' && role && !value.events.some(e => e.tipo === APPROVAL_EVENTS[role]) ? role : null,
    } : null });
  } catch (error) { next(error); }
}
/** One DB lock per immutable proposal protects approvals across PM2 workers. */
export async function approveManifestProposal(req: AuthRequest, firma?: { imagen: string; sha256: string } | null) {
  if (!isTrainingSession()) throw new AppError('Función no habilitada', 404);
  const id = req.params.id;
  await assertCanAccessManifiesto(prisma, req.user, id);
  const qrCode = await QRCode.toDataURL(JSON.stringify({ id }));
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`manifest-proposal:${id}`}))::text AS "lock"`;
    const value = await load(tx, id);
    if (!value) throw new AppError('No es una propuesta con aprobación de las partes', 404);
    const rol = proposalRole(req.user, value.proposal);
    if (!rol) throw new AppError('Sólo cada parte vinculada puede aprobar su participación', 403);
    const reject = req.body?.decision === 'RECHAZADA';
    const reason = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
    if (reject && (!reason || reason.length > 500)) throw new AppError('Indicá un motivo de rechazo de hasta 500 caracteres', 400);
    if (rol === 'GENERADOR' && !firma && !reject) throw new AppError('El generador debe firmar su aprobación', 400);
    // Retry does not append a second approval or replace the first signature.
    if (!reject && value.events.some(e => e.tipo === APPROVAL_EVENTS[rol])) return value.manifest;
    if (reject && value.events.some(e => e.tipo === 'RECHAZO_PARTE' && e.usuarioId === req.user.id)) return value.manifest;
    if (value.manifest.estado !== 'PENDIENTE_APROBACION') throw new AppError('La propuesta ya no admite aprobaciones', 409);
    const event = await tx.eventoManifiesto.create({ data: {
      manifiestoId: id, tipo: reject ? 'RECHAZO_PARTE' : APPROVAL_EVENTS[rol], usuarioId: req.user.id,
      descripcion: JSON.stringify({ version: 1, rol, actorId: value.proposal[`${rol.toLowerCase()}Id` as 'generadorId' | 'transportistaId' | 'operadorId'], decision: reject ? 'RECHAZADA' : 'APROBADA', ...(reject ? { motivo: reason } : {}) }),
      ...(firma ? { firmaImagen: firma.imagen, firmaSha256: firma.sha256 } : {}),
    } });
    if (reject) {
      const rejected = await tx.manifiesto.update({where:{id,estado:'PENDIENTE_APROBACION'},data:{estado:'RECHAZADO'}});
      await notifyManifestParties(tx,rejected,'rechazada',req.user.id);
      return rejected;
    }
    const complete = Object.values(APPROVAL_EVENTS).every(type => type === event.tipo || value.events.some(e => e.tipo === type));
    const updated = await tx.manifiesto.update({ where: { id, estado: 'PENDIENTE_APROBACION' }, data: {
      ...(rol === 'GENERADOR' ? { fechaFirma: event.createdAt } : {}),
      ...(complete ? { estado: 'APROBADO', qrCode } : {}),
    } });
    await notifyManifestParties(tx,updated,complete?'aprobada':`aprobacion-${rol}`,req.user.id);
    return updated;
  });
}
export async function approveManifestParty(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!isTrainingSession()) throw new AppError('Función no habilitada',404);
    if (req.body?.decision && !['APROBADA','RECHAZADA'].includes(req.body.decision)) throw new AppError('Decisión inválida',400);
    if (req.user.rol === 'GENERADOR' && req.body?.decision !== 'RECHAZADA') throw new AppError('Usá Firmar Manifiesto para aprobar como generador', 400);
    res.json({ success: true, data: { manifiesto: await approveManifestProposal(req) } });
  } catch (error) { next(error); }
}
/** Also guards direct HTTP pickup and any later administrative state reversal. */
export async function assertManifestProposalApproved(tx: Tx, id: string) {
  if (!isTrainingSession()) return;
  const value = await load(tx, id);
  if (value && (value.events.some(e => e.tipo === 'RECHAZO_PARTE') || !Object.values(APPROVAL_EVENTS).every(type => value.events.some(e => e.tipo === type)))) throw new AppError('Falta la aprobación del generador, transporte u operador; no se puede retirar', 409);
  if(value && !value.events.some(e=>e.tipo==='INICIO_COORDINACION_CAP')) throw new AppError('Las partes aprobaron: falta iniciar la coordinación antes del retiro',409);
}

export async function getProposalAgenda(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!isTrainingSession()) throw new AppError('Función no habilitada',404);
    const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Mendoza'}).format(new Date());
    const where: any={estado:'APROBADO',fechaEstimadaRetiro:{gte:new Date(day+'T00:00:00-03:00')},eventos:{some:{tipo:MANIFEST_PROPOSAL}}};
    applyRoleFilter(where,req.user);
    const [items,total]=await prisma.$transaction([
      prisma.manifiesto.findMany({where,select:{id:true,numero:true,fechaEstimadaRetiro:true,generador:{select:{razonSocial:true}},operador:{select:{razonSocial:true}}},orderBy:[{fechaEstimadaRetiro:'asc'},{id:'asc'}],take:50}),
      prisma.manifiesto.count({where}),
    ]);
    res.json({success:true,data:{items,total}});
  }catch(e){next(e);}
}

/** Coordination is a separate, idempotent event; it never asserts physical pickup. */
export async function startManifestCoordination(req: AuthRequest,res: Response,next: NextFunction){
 try {
  if(!isTrainingSession())throw new AppError('Función no habilitada',404);
  await assertCanAccessManifiesto(prisma,req.user,req.params.id);
  const result=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`manifest-proposal:${req.params.id}`}))::text AS "lock"`;
   const value=await load(tx,req.params.id);
   if(!value)throw new AppError('No es una propuesta de las partes',404);
   const rol=proposalRole(req.user,value.proposal);
   if(!rol)throw new AppError('Sólo una de las tres partes vinculadas puede iniciar',403);
   const existing=value.events.find(e=>e.tipo==='INICIO_COORDINACION_CAP');if(existing)return existing;
   if(value.manifest.estado!=='APROBADO'||value.events.some(e=>e.tipo==='RECHAZO_PARTE')||!Object.values(APPROVAL_EVENTS).every(t=>value.events.some(e=>e.tipo===t)))throw new AppError('Se necesitan las tres aprobaciones para iniciar',409);
   const event=await tx.eventoManifiesto.create({data:{manifiestoId:req.params.id,usuarioId:req.user.id,tipo:'INICIO_COORDINACION_CAP',descripcion:`Coordinación iniciada por ${rol}. Generador prepara la carga, operador coordina la recepción y transporte confirma el retiro cuando ocurra.`}});
   await notifyManifestParties(tx,value.manifest,'iniciada',req.user.id);
   return event;
  });
  res.json({success:true,data:{inicio:result.createdAt}});
 }catch(e){next(e);}
}

/** Current work, distinct from unread history. No operational realm access. */
export async function getTrainingTasks(req:AuthRequest,res:Response,next:NextFunction){
 try{
  if(!isTrainingSession())throw new AppError('Función no habilitada',404);
  const where:any={estado:{in:['PENDIENTE_APROBACION','APROBADO','EN_TRANSITO','ENTREGADO','RECIBIDO','EN_TRATAMIENTO','TRATADO']}};applyRoleFilter(where,req.user);
  const rows=await prisma.manifiesto.findMany({where,orderBy:{createdAt:'desc'},take:100,include:{eventos:{where:{tipo:{in:[MANIFEST_PROPOSAL,...Object.values(APPROVAL_EVENTS),'INICIO_COORDINACION_CAP','CERTIFICADO_CAP_V1']}}},residuos:{select:{cantidadRecibida:true}}}});
  const labels:Record<string,string>={GENERADOR:'generador',TRANSPORTISTA:'transporte',OPERADOR:'operador'};
  const items=rows.flatMap(m=>{
   const marker=m.eventos.find(e=>e.tipo===MANIFEST_PROPOSAL),proposal=marker?parseProposal(marker.descripcion):null;
   const role=proposal?(proposalRole(req.user,proposal)||(req.user.rol==='ADMIN'?'ADMIN':null)):req.user.rol;
   let action='',detail='';
   if(m.estado==='PENDIENTE_APROBACION'&&proposal){
    const missing=(Object.keys(APPROVAL_EVENTS) as ProposalRole[]).filter(r=>!m.eventos.some(e=>e.tipo===APPROVAL_EVENTS[r]));
    action=role&&missing.includes(role as ProposalRole)?'Revisá y aprobá tu participación':'Esperando a las otras partes';detail='Falta aprobar: '+missing.map(r=>labels[r]).join(', ')+'.';
   }else if(m.estado==='APROBADO'&&proposal){
    const started=m.eventos.some(e=>e.tipo==='INICIO_COORDINACION_CAP');
    action=!started?'Las tres partes aprobaron: iniciar coordinación':role==='TRANSPORTISTA'?'Confirmá el retiro cuando recibas la carga':'Coordinación iniciada: preparando el retiro';
    detail=!started?'Generador, transporte u operador pueden dar inicio.':'Generador prepara la carga; operador prepara la recepción. El viaje empieza con el retiro.';
   }else if(m.estado==='EN_TRANSITO'){action=role==='TRANSPORTISTA'?'Continuá el viaje y compartí GPS':'El transporte está en viaje';detail='La entrega se confirma al llegar al destino.';}
   else if(['OPERADOR','ADMIN'].includes(role||'')&&m.estado==='ENTREGADO'){action='Confirmá la recepción de esta carga';detail='Después registrá el peso realmente recibido.';}
   else if(['OPERADOR','ADMIN'].includes(role||'')&&m.estado==='RECIBIDO'){action=m.residuos.some(r=>!r.cantidadRecibida)?'Registrá el pesaje recibido':'Registrá el tratamiento';detail='El pesaje y el tratamiento permiten emitir la certificación parcial.';}
   else if(['OPERADOR','ADMIN'].includes(role||'')&&m.estado==='EN_TRATAMIENTO'){action='Emití un parcial o cerrá el tratamiento';detail='El cierre habilita la certificación final total, después de resolver adendas.';}
   else if(m.estado==='TRATADO'&&!m.eventos.some(e=>e.tipo==='CERTIFICADO_CAP_V1'&&JSON.parse(e.descripcion).tipo==='FINAL')){action=role==='OPERADOR'?'Revisá adendas y emití la certificación final total':'Tratamiento cerrado: esperando la certificación final';detail='El operador decide cuándo firmarla y liberarla.';}
   const partes=proposal?(Object.keys(APPROVAL_EVENTS) as ProposalRole[]).map(rol=>({rol,aprobada:m.eventos.some(e=>e.tipo===APPROVAL_EVENTS[rol])})):null;
   const inicio=m.eventos.find(e=>e.tipo==='INICIO_COORDINACION_CAP')?.createdAt||null;
   const requiereMiAprobacion=!!role&&m.estado==='PENDIENTE_APROBACION'&&!!partes?.some(p=>p.rol===role&&!p.aprobada);
   return action?[{id:m.id,numero:m.numero,estado:m.estado,action,detail,fechaEstimadaRetiro:m.fechaEstimadaRetiro,partes,inicio,requiereMiAprobacion,pesajePendiente:m.residuos.some(r=>!r.cantidadRecibida)}]:[];
  });
  res.json({success:true,data:{items,total:items.length,limited:rows.length===100}});
 }catch(e){next(e);}
}
