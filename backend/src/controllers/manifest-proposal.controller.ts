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
  const events = await tx.eventoManifiesto.findMany({ where: { manifiestoId: id, tipo: { in: [...Object.values(APPROVAL_EVENTS), 'RECHAZO_PARTE'] } }, orderBy: { createdAt: 'asc' } });
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
    if (complete) await notifyManifestParties(tx,updated,'aprobada',req.user.id);
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
