import { updateRollingHash } from '../services/manifestIntegrity.service';
import { hashManifiesto, registrarSello } from '../services/blockchain.service';
import { notifyManifestParties } from '../services/manifestProposal.service';
import { scheduleCommittedManifestPush } from '../services/committed-manifest-push.service';
import { applyRoleFilter } from '../utils/roleFilter';
import { Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import prisma from '../lib/prisma';
import { isTrainingSession } from '../lib/trainingScope';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { assertCanAccessManifiesto } from '../utils/roleFilter';
import { MANIFEST_PROPOSAL, APPROVAL_EVENTS, manifestProposalsEnabled, COORDINATION_EVENTS, parseProposal, proposalRole, proposalRoles, ProposalRole } from '../domain/manifestProposal';
import { agendaQuery } from '../domain/manifestAgenda';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
async function load(tx: Tx, id: string) {
  const marker = await tx.eventoManifiesto.findFirst({ where: { manifiestoId: id, tipo: MANIFEST_PROPOSAL } });
  if (!marker) return null;
  const proposal = parseProposal(marker.descripcion);
  const manifest = await tx.manifiesto.findUniqueOrThrow({ where: { id } });
  if ((manifest.modalidad || 'FIJO') !== (proposal.modalidad || 'FIJO')) throw new AppError('La modalidad no coincide con la propuesta original', 409);
  if (manifest.generadorId !== proposal.generadorId || manifest.transportistaId !== proposal.transportistaId || manifest.operadorId !== proposal.operadorId || manifest.creadoPorId !== proposal.creadoPorId) throw new AppError('Las partes no coinciden con la propuesta original', 409);
  const events = await tx.eventoManifiesto.findMany({ where: { manifiestoId: id, tipo: { in: [...Object.values(APPROVAL_EVENTS), 'RECHAZO_PARTE', ...COORDINATION_EVENTS] } }, orderBy: { createdAt: 'asc' } });
  return { proposal, manifest, events };
}
export async function getManifestProposal(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!manifestProposalsEnabled()) throw new AppError('Función no habilitada', 404);
    await assertCanAccessManifiesto(prisma, req.user, req.params.id);
    const value = await prisma.$transaction(tx => load(tx, req.params.id));
    const role = value ? proposalRole(req.user, value.proposal) : null;
    const unanimous = !!value && !value.events.some(e => e.tipo === 'RECHAZO_PARTE')
      && proposalRoles(value.proposal).every(rol => value.events.some(e => e.tipo === APPROVAL_EVENTS[rol]));
    res.json({ success: true, data: value ? {
      version: 1, modalidad: value.proposal.modalidad || 'FIJO', autorRol: value.proposal.autorRol, estado: value.manifest.estado, rechazo: value.events.find(e => e.tipo === 'RECHAZO_PARTE')?.descripcion,
      partes: proposalRoles(value.proposal).map(rol => {
        const event = value.events.find(e => e.tipo === APPROVAL_EVENTS[rol]);
        return { rol, aprobada: !!event, usuarioId: event?.usuarioId, fecha: event?.createdAt };
      }),
      inicio: value.events.find(e => COORDINATION_EVENTS.includes(e.tipo))?.createdAt || null,
      puedeIniciar: !!role && unanimous && value.manifest.estado === 'APROBADO' && !value.events.some(e => COORDINATION_EVENTS.includes(e.tipo)),
      puedeAprobar: value.manifest.estado === 'PENDIENTE_APROBACION' && role && !value.events.some(e => e.tipo === APPROVAL_EVENTS[role]) ? role : null,
    } : null });
  } catch (error) { next(error); }
}
/** One DB lock per immutable proposal protects approvals across PM2 workers. */
export async function approveManifestProposal(req: AuthRequest, firma?: { imagen: string; sha256: string } | null) {
  if (!manifestProposalsEnabled()) throw new AppError('Función no habilitada', 404);
  const id = req.params.id;
  await assertCanAccessManifiesto(prisma, req.user, id);
  const preview = await prisma.manifiesto.findUniqueOrThrow({ where: { id }, select: { numero: true } });
  const qrCode = await QRCode.toDataURL(JSON.stringify({ id, numero: preview.numero, timestamp: new Date().toISOString() }));
  let pushIds:string[]=[];
  let genesisHash: string | undefined;
  const result=await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`manifest-proposal:${id}`}))::text AS "lock"`;
    await tx.$queryRaw`SELECT id FROM manifiestos WHERE id = ${id} FOR UPDATE`;
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
      if (!isTrainingSession()) await updateRollingHash(tx,id,rejected.estado,event.createdAt,event.descripcion,event.id);
      pushIds=await notifyManifestParties(tx,rejected,'rechazada',req.user.id,req.user.rol);
      return rejected;
    }
    const complete = proposalRoles(value.proposal).every(role => APPROVAL_EVENTS[role] === event.tipo || value.events.some(e => e.tipo === APPROVAL_EVENTS[role]));
    const updated = await tx.manifiesto.update({ where: { id, estado: 'PENDIENTE_APROBACION' }, data: {
      ...(rol === 'GENERADOR' ? { fechaFirma: event.createdAt } : {}),
      ...(complete ? { estado: 'APROBADO', qrCode } : {}),
    } });
    if (!isTrainingSession()) {
      await updateRollingHash(tx,id,updated.estado,event.createdAt,event.descripcion,event.id);
      if (complete) {
        const sealed = await tx.manifiesto.findUniqueOrThrow({ where: { id }, include: { generador:true, transportista:true, operador:true, residuos:true } });
        genesisHash = hashManifiesto(sealed);
      }
    }
    pushIds=await notifyManifestParties(tx,updated,complete?'aprobada':`aprobacion-${rol}`,req.user.id,req.user.rol);
    return updated;
  });
  scheduleCommittedManifestPush(pushIds);
  if (genesisHash) { const hash=genesisHash; setImmediate(()=>{void registrarSello(id,'GENESIS',hash).catch(()=>{});}); }
  return result;
}
export async function approveManifestParty(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!manifestProposalsEnabled()) throw new AppError('Función no habilitada',404);
    if (req.body?.decision && !['APROBADA','RECHAZADA'].includes(req.body.decision)) throw new AppError('Decisión inválida',400);
    if (req.user.rol === 'GENERADOR' && req.body?.decision !== 'RECHAZADA') throw new AppError('Usá Firmar Manifiesto para aprobar como generador', 400);
    res.json({ success: true, data: { manifiesto: await approveManifestProposal(req) } });
  } catch (error) { next(error); }
}
/** Also guards direct HTTP pickup and any later administrative state reversal. */
export async function assertManifestProposalApproved(tx: Tx, id: string) {
  const value = await load(tx, id);
  if (value && (value.events.some(e => e.tipo === 'RECHAZO_PARTE') || !proposalRoles(value.proposal).every(role => value.events.some(e => e.tipo === APPROVAL_EVENTS[role])))) throw new AppError('Falta la aprobación de una de las partes vinculadas; no se puede comenzar', 409);
  if(value && !value.events.some(e=>COORDINATION_EVENTS.includes(e.tipo))) throw new AppError('Las partes aprobaron: falta iniciar la coordinación antes de continuar',409);
}

export async function getProposalAgenda(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!manifestProposalsEnabled()) throw new AppError('Función no habilitada',404);
    const page=Number(req.query.page??1),search=req.query.search??'';
    if(!Number.isInteger(page)||page<1||page>100000||typeof search!=='string'||search.length>80)throw new AppError('Filtros de agenda inválidos',400);
    const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Mendoza'}).format(new Date());
    const where: any={estado:'APROBADO',fechaEstimadaRetiro:{gte:new Date(day+'T00:00:00-03:00')},eventos:{some:{tipo:MANIFEST_PROPOSAL}}};
    if(search.trim())where.numero={contains:search.trim(),mode:'insensitive'};
    applyRoleFilter(where,req.user);
    const [items,total]=await prisma.$transaction([
      prisma.manifiesto.findMany({where,select:{id:true,numero:true,fechaEstimadaRetiro:true,generador:{select:{razonSocial:true}},operador:{select:{razonSocial:true}}},orderBy:[{fechaEstimadaRetiro:'asc'},{id:'asc'}],take:50,skip:(page-1)*50}),
      prisma.manifiesto.count({where}),
    ]);
    res.json({success:true,data:{items,total,page,pageSize:50}});
  }catch(e){next(e);}
}

/** Coordination is a separate, idempotent event; it never asserts physical pickup. */
export async function startManifestCoordination(req: AuthRequest,res: Response,next: NextFunction){
 try {
  if(!manifestProposalsEnabled())throw new AppError('Función no habilitada',404);
  await assertCanAccessManifiesto(prisma,req.user,req.params.id);
  let pushIds:string[]=[];
  const result=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`manifest-proposal:${req.params.id}`}))::text AS "lock"`;
   await tx.$queryRaw`SELECT id FROM manifiestos WHERE id = ${req.params.id} FOR UPDATE`;
   const value=await load(tx,req.params.id);
   if(!value)throw new AppError('No es una propuesta de las partes',404);
   const rol=proposalRole(req.user,value.proposal);
   if(!rol)throw new AppError('Sólo una de las partes vinculadas puede iniciar',403);
   const existing=value.events.find(e=>COORDINATION_EVENTS.includes(e.tipo));if(existing)return existing;
   if(value.manifest.estado!=='APROBADO'||value.events.some(e=>e.tipo==='RECHAZO_PARTE')||!proposalRoles(value.proposal).every(role=>value.events.some(e=>e.tipo===APPROVAL_EVENTS[role])))throw new AppError('Se necesitan las aprobaciones de todas las partes vinculadas para iniciar',409);
   const preparation=value.proposal.modalidad==='IN_SITU'?'Generador y operador coordinan la recepción en origen, sin retiro ni viaje.':'Generador prepara la carga, operador coordina la recepción y transporte confirma el retiro cuando ocurra.';
   const event=await tx.eventoManifiesto.create({data:{manifiestoId:req.params.id,usuarioId:req.user.id,tipo:isTrainingSession()?'INICIO_COORDINACION_CAP':'INICIO_COORDINACION',descripcion:`Coordinación iniciada por ${rol}. ${preparation}`}});
   if (!isTrainingSession()) await updateRollingHash(tx,req.params.id,value.manifest.estado,event.createdAt,event.descripcion,event.id);
   pushIds=await notifyManifestParties(tx,value.manifest,'iniciada',req.user.id,req.user.rol);
   return event;
  });
  scheduleCommittedManifestPush(pushIds);
  res.json({success:true,data:{inicio:result.createdAt}});
 }catch(e){next(e);}
}

/** Current work, distinct from unread history. Queries retain the authenticated actor scope. */
export async function getTrainingTasks(req:AuthRequest,res:Response,next:NextFunction){
 try{
  if(!manifestProposalsEnabled())throw new AppError('Función no habilitada',404);
  const agenda = agendaQuery(req.query || {}, req.user.rol, process.env.MANIFEST_CERTIFICATES_ENABLED === 'true', isTrainingSession());
  applyRoleFilter(agenda.base, req.user);
  const { rows, counts, total, page } = await prisma.$transaction(async tx => {
    const counts: Record<string, number> = {};
    for (const [key, category] of Object.entries(agenda.categories)) counts[key] = await tx.manifiesto.count({ where: { AND: [agenda.base, category] } });
    const total = counts[agenda.filter], page = Math.min(agenda.page, Math.max(1, Math.ceil(total / agenda.limit)));
    const rows = await tx.manifiesto.findMany({ where: { AND: [agenda.base, agenda.categories[agenda.filter]] }, orderBy: agenda.orderBy,
      skip: (page - 1) * agenda.limit, take: agenda.limit,
      include: { generador: { select: { razonSocial: true } }, transportista: { select: { razonSocial: true } }, operador: { select: { razonSocial: true } }, eventos: { where: { tipo: { in: [MANIFEST_PROPOSAL, ...Object.values(APPROVAL_EVENTS), ...COORDINATION_EVENTS, 'CERTIFICADO_CAP_V1'] } } }, residuos: { select: { cantidadRecibida: true } } },
    });
    return { rows, counts, total, page };
  }, { isolationLevel: 'RepeatableRead' });
  const labels:Record<string,string>={GENERADOR:'generador',TRANSPORTISTA:'transporte',OPERADOR:'operador'};
  const items=rows.flatMap(m=>{
   const marker=m.eventos.find(e=>e.tipo===MANIFEST_PROPOSAL),proposal=marker?parseProposal(marker.descripcion):null;
   const role=proposal?(proposalRole(req.user,proposal)||(req.user.rol==='ADMIN'?'ADMIN':null)):req.user.rol;
   let action='',detail='';
   if(m.estado==='BORRADOR'){
    action='Firma del generador pendiente';
    detail=m.modalidad==='IN_SITU'?'Tratamiento en origen, sin transporte. El generador debe revisar y firmar antes de la recepción del operador.':'Borrador del circuito anterior. Todavía no fue enviado a las tres partes para su aprobación.';
   }else if(m.estado==='PENDIENTE_APROBACION'&&proposal){
    const missing=proposalRoles(proposal).filter(r=>!m.eventos.some(e=>e.tipo===APPROVAL_EVENTS[r]));
    action=role&&missing.includes(role as ProposalRole)?'Revisá y aprobá tu participación':'Esperando a las otras partes';detail='Falta aprobar: '+missing.map(r=>labels[r]).join(', ')+'.';
   }else if(m.estado==='APROBADO'&&proposal){
    const started=m.eventos.some(e=>COORDINATION_EVENTS.includes(e.tipo));
    action=!started?'Todas las partes aprobaron: iniciar coordinación':m.modalidad==='IN_SITU'?'Coordinación iniciada: recepción en origen pendiente':role==='TRANSPORTISTA'?'Confirmá el retiro cuando recibas la carga':'Coordinación iniciada: preparando el retiro';
    detail=m.modalidad==='IN_SITU'?(started?'El operador debe confirmar la recepción en origen, sin transporte ni GPS.':'Generador u operador pueden dar inicio.'):!started?'Generador, transporte u operador pueden dar inicio.':'Generador prepara la carga; operador prepara la recepción. El viaje empieza con el retiro.';
   }else if(m.estado==='APROBADO'){action=m.modalidad==='IN_SITU'?'Recepción in situ pendiente':'Retiro pendiente';detail='Conserva el recorrido anterior, sin nuevas aprobaciones de partes.';}else if(m.estado==='EN_TRANSITO'){action=role==='TRANSPORTISTA'?'Continuá el viaje y compartí GPS':'El transporte está en viaje';detail='La entrega se confirma al llegar al destino.';}
   else if(['OPERADOR','ADMIN'].includes(role||'')&&m.estado==='ENTREGADO'){action='Confirmá la recepción de esta carga';detail='Después registrá el peso realmente recibido.';}
   else if(['OPERADOR','ADMIN'].includes(role||'')&&m.estado==='RECIBIDO'){action=m.residuos.some(r=>!r.cantidadRecibida)?'Registrá el pesaje recibido':'Registrá el tratamiento';detail='El pesaje y el tratamiento permiten emitir la certificación parcial.';}
   else if(['OPERADOR','ADMIN'].includes(role||'')&&m.estado==='EN_TRATAMIENTO'){action=isTrainingSession()?'Emití un parcial o cerrá el tratamiento':'Cerrá el tratamiento cuando corresponda';detail='El cierre habilita la certificación final total, después de resolver adendas.';}
   else if(m.estado==='TRATADO'){action=role==='OPERADOR'?'Revisá y emití la certificación final total':'Esperando la certificación final del operador';detail='El operador decide cuándo firmarla y liberarla. El cierre no la emite automáticamente.';}
   if (!action) { action = 'Esperando al operador'; detail = 'El operador continúa la recepción y el tratamiento.'; }
   const partes=proposal?proposalRoles(proposal).map(rol=>({rol,aprobada:m.eventos.some(e=>e.tipo===APPROVAL_EVENTS[rol])})):null;
   if(m.estado==='APROBADO'&&partes?.some(p=>!p.aprobada)){
    action='Revisar aprobaciones';
    detail='Falta aprobar: '+partes.filter(p=>!p.aprobada).map(p=>labels[p.rol]).join(', ')+'. No se puede iniciar.';
   }
   const inicio=m.eventos.find(e=>COORDINATION_EVENTS.includes(e.tipo))?.createdAt||null;
   const requiereMiAprobacion=!!role&&m.estado==='PENDIENTE_APROBACION'&&!!partes?.some(p=>p.rol===role&&!p.aprobada);
   return [{id:m.id,numero:m.numero,estado:m.estado,modalidad:m.modalidad,action,detail,actores:{generador:m.generador?.razonSocial||'',transportista:m.transportista?.razonSocial||null,operador:m.operador?.razonSocial||''},fechaEstimadaRetiro:m.fechaEstimadaRetiro,partes,inicio,requiereMiAprobacion,pesajePendiente:m.residuos.some(r=>!r.cantidadRecibida),certificatePending:m.estado==='TRATADO'}];
  });
  res.json({success:true,data:{items,total,page,limit:agenda.limit,counts,limited:false}});
 }catch(e){next(e);}
}
