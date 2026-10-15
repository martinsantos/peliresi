import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import prisma from '../lib/prisma';
import { canAccessManifiesto } from '../utils/roleFilter';
import { exceptionalCanReview } from './manifiesto-excepcional.controller';
import { addendumCreateSchema, addendumReviewSchema, addendumStageAllowed, canRecordAddendum, AddendumReview } from '../domain/manifiestoAdenda';

export function addendaEnabled(_req: AuthRequest, _res: Response, next: NextFunction) {
  if (process.env.MANIFEST_ADDENDA_ENABLED !== 'true') return next(new AppError('Adendas no habilitadas', 404));
  next();
}
async function accessibleManifest(req: AuthRequest) {
  const manifest = await prisma.manifiesto.findUnique({ where: { id: req.params.id },
    include: { residuos: { orderBy: { id: 'asc' }, include: { tipoResiduo: { select: { codigo: true } } } } } });
  if (!manifest || !canAccessManifiesto(req.user, manifest)) throw new AppError('Manifiesto no encontrado', 404);
  return manifest;
}
function present(record: { creadoPorId: string; impersonadoPorId: string | null; revisiones: Prisma.JsonValue; [key: string]: unknown }, req: AuthRequest) {
  const reviews = record.revisiones as unknown as AddendumReview[];
  return { ...record, estadoRevision: reviews[reviews.length - 1]?.decision || 'PENDIENTE', puedeResolver: exceptionalCanReview(req, record) };
}
export async function listAddenda(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const manifest = await accessibleManifest(req);
    const page = Math.max(1, Math.min(100000, Math.floor(Number(req.query.page) || 1)));
    const where = { manifiestoId: manifest.id };
    const [items, total] = await Promise.all([
      prisma.adendaManifiesto.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20, skip: (page - 1) * 20 }),
      prisma.adendaManifiesto.count({ where }),
    ]);
    res.json({ success: true, data: { adendas: items.map(r => present(r, req)), total,
      manifiesto: { id: manifest.id, numero: manifest.numero, estado: manifest.estado },
      puedeRegistrar: canRecordAddendum(req.user, manifest) && addendumStageAllowed(manifest.estado) } });
  } catch (error) { next(error); }
}
export async function createAddendum(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const manifest = await accessibleManifest(req);
    if (!canRecordAddendum(req.user, manifest)) throw new AppError('Sólo transporte u operador vinculados registran diferencias', 403);
    const parsed = addendumCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const command = parsed.data;
    const hash = createHash('sha256').update(JSON.stringify(command)).digest('hex');
    const verifyReplay = (row: { manifiestoId: string; creadoPorId: string; impersonadoPorId: string | null; huellaSolicitud: string }) => {
      if (row.manifiestoId !== manifest.id || row.creadoPorId !== req.user.id
        || row.impersonadoPorId !== (req.user.impersonatedBy?.id || null) || row.huellaSolicitud !== hash) {
        throw new AppError('La referencia de adenda ya tiene otro contenido', 409);
      }
    };
    const existing = await prisma.adendaManifiesto.findUnique({ where: { id: command.id } });
    if (existing) {
      verifyReplay(existing); res.status(201).json({ success: true, data: { adenda: present(existing, req) } }); return;
    }
    if (!addendumStageAllowed(manifest.estado)) throw new AppError('Las adendas corresponden a manifiestos aprobados o ejecutados', 409);
    if (command.rectificaId && !await prisma.adendaManifiesto.findFirst({ where: { id: command.rectificaId, manifiestoId: manifest.id } })) {
      throw new AppError('La rectificación debe referirse a una adenda de este manifiesto', 400);
    }
    const record = await prisma.adendaManifiesto.upsert({ where: { id: command.id }, update: {}, create: {
      id: command.id, manifiestoId: manifest.id, creadoPorId: req.user.id,
      impersonadoPorId: req.user.impersonatedBy?.id || null, huellaSolicitud: hash,
      motivo: command.motivo, rectificaId: command.rectificaId || null, residuos: command.residuos,
      // Declared quantities only, never replace them with received weights or add observed totals to them.
      declaracion: { numero: manifest.numero, estadoAlRegistrar: manifest.estado,
        fechaFirma: manifest.fechaFirma?.toISOString() || null,
        generadorId: manifest.generadorId, transportistaId: manifest.transportistaId, operadorId: manifest.operadorId,
        residuos: manifest.residuos.map(r => ({ id: r.id, tipoResiduoId: r.tipoResiduoId,
          corriente: r.tipoResiduo.codigo, cantidad: r.cantidad, unidad: r.unidad, descripcion: r.descripcion })) },
      revisiones: [],
    } });
    verifyReplay(record);
    res.status(201).json({ success: true, data: { adenda: present(record, req) } });
  } catch (error) { next(error); }
}
export async function reviewAddendum(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await accessibleManifest(req);
    const parsed = addendumReviewSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const command = parsed.data;
    const record = await prisma.$transaction(async tx => {
      const current = await tx.adendaManifiesto.findFirst({ where: { id: req.params.adendaId, manifiestoId: req.params.id } });
      if (!current) throw new AppError('Adenda no encontrada', 404);
      if (!exceptionalCanReview(req, current)) throw new AppError('Se requiere revisor designado, sin autoaprobación ni impersonación', 403);
      const reviews = current.revisiones as unknown as AddendumReview[];
      const repeated = reviews.find(r => r.id === command.id);
      if (repeated) {
        if (repeated.autorId !== req.user.id || repeated.version !== command.version || repeated.nota !== command.nota || repeated.decision !== command.decision) {
          throw new AppError('La resolución ya tiene otro contenido', 409);
        }
        return current;
      }
      if (current.version !== command.version) throw new AppError('La revisión cambió; recargá antes de resolver', 409);
      const updated = await tx.adendaManifiesto.updateMany({ where: { id: current.id, version: command.version }, data: {
        version: { increment: 1 }, revisiones: [...reviews, { ...command, autorId: req.user.id, fecha: new Date().toISOString() }] as unknown as Prisma.InputJsonValue,
      } });
      if (updated.count !== 1) throw new AppError('Otro revisor resolvió esta versión; recargá', 409);
      return tx.adendaManifiesto.findUniqueOrThrow({ where: { id: current.id } });
    });
    res.json({ success: true, data: { adenda: present(record, req) } });
  } catch (error) { next(error); }
}
