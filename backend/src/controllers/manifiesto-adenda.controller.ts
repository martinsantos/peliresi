import { manifestFeatureEnabled, manifestPracticeIdentity } from '../lib/manifestTraining';
import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import prisma from '../lib/prisma';
import { canAccessManifiesto } from '../utils/roleFilter';
import { exceptionalCanReview } from './manifiesto-excepcional.controller';
import { canReviewAsCounterpart, ReviewParties } from '../domain/partyReview';
import { addendumCreateSchema, addendumReviewSchema, addendumStageAllowed, canRecordAddendum, AddendumReview } from '../domain/manifiestoAdenda';
import { addendumDocument, documentaryStatus, DocumentaryCounts } from '../domain/manifiestoAdendaDocument';
import { renderAddendumPdf } from '../services/manifiestoAdendaPdf.service';
import { noticeNewCurrents } from '../services/postFactoNotice.service';

export function addendaEnabled(_req: AuthRequest, _res: Response, next: NextFunction) {
  if (!manifestFeatureEnabled('MANIFEST_ADDENDA_ENABLED')) return next(new AppError('Adendas no habilitadas', 404));
  next();
}
async function accessibleManifest(req: AuthRequest) {
  const manifest = await prisma.manifiesto.findUnique({ where: { id: req.params.id },
    include: { residuos: { orderBy: { id: 'asc' }, include: { tipoResiduo: { select: { codigo: true } } } } } });
  if (!manifest || !canAccessManifiesto(req.user, manifest)) throw new AppError('Manifiesto no encontrado', 404);
  return manifest;
}
function canReview(req: AuthRequest, record: { creadoPorId: string; impersonadoPorId: string | null; declaracion: Prisma.JsonValue }) {
  return exceptionalCanReview(req, record) || (manifestFeatureEnabled('MANIFEST_PARTY_REVIEW_ENABLED')
    && canReviewAsCounterpart(manifestPracticeIdentity(req.user), record, record.declaracion as ReviewParties));
}
function present(record: { creadoPorId: string; impersonadoPorId: string | null; declaracion: Prisma.JsonValue; revisiones: Prisma.JsonValue; [key: string]: unknown }, req: AuthRequest) {
  const reviews = record.revisiones as unknown as AddendumReview[];
  return { ...record, estadoRevision: reviews[reviews.length - 1]?.decision || 'PENDIENTE', puedeResolver: canReview(req, record) };
}
export async function listAddenda(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const manifest = await accessibleManifest(req);
    const page = Math.max(1, Math.min(100000, Math.floor(Number(req.query.page) || 1)));
    const where = { manifiestoId: manifest.id };
    const [items, counts] = await Promise.all([
      prisma.adendaManifiesto.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20, skip: (page - 1) * 20 }),
      // Counts span all pages. Authorization was checked against the parent above.
      prisma.$queryRaw<DocumentaryCounts[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE jsonb_array_length(revisiones) = 0)::int AS pendientes,
          COUNT(*) FILTER (WHERE revisiones->-1->>'decision' = 'OBSERVADA')::int AS observadas,
          COUNT(*) FILTER (WHERE revisiones->-1->>'decision' = 'RECHAZADA')::int AS rechazadas
        FROM adendas_manifiesto WHERE "manifiestoId" = ${manifest.id}`),
    ]);
    const summary = counts[0];
    res.json({ success: true, data: { adendas: items.map(r => present(r, req)), total: summary.total,
      documental: { ...summary, estado: documentaryStatus(summary), cierreAcreditado: false },
      manifiesto: { id: manifest.id, numero: manifest.numero, estado: manifest.estado },
      puedeRegistrar: canRecordAddendum(req.user, manifest) && addendumStageAllowed(manifest.estado) } });
  } catch (error) { next(error); }
}
export async function downloadAddendum(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const manifest = await accessibleManifest(req);
    const row = await prisma.adendaManifiesto.findFirst({ where: { id: req.params.adendaId, manifiestoId: manifest.id } });
    if (!row) throw new AppError('Adenda no encontrada', 404);
    const requested = req.query.version;
    if (requested !== undefined && (typeof requested !== 'string' || !/^(0|[1-9][0-9]*)$/.test(requested))) {
      throw new AppError('Versión de anexo inválida', 400);
    }
    const version = requested === undefined ? row.version : Number(requested);
    if (!Number.isSafeInteger(version) || version > row.version) throw new AppError('Versión de anexo inexistente', 400);
    const content = addendumDocument(row, version);
    const pdf = await renderAddendumPdf(content);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="anexo-adenda-' + row.id + '-v' + version + '.pdf"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-SITREP-Content-SHA256', content.huella);
    res.send(pdf);
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
    } }).catch(async (error: unknown) => {
      // Prisma can race its client-side upsert on simultaneous first requests.
      // Only recover a primary-key conflict, then verify the original request below.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      return prisma.adendaManifiesto.findUniqueOrThrow({ where: { id: command.id } });
    });
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
      if (!canReview(req, current)) throw new AppError('Se requiere contraparte vinculada o revisor designado, sin autoaprobación ni impersonación', 403);
      const reviews = current.revisiones as unknown as AddendumReview[];
      const repeated = reviews.find(r => r.id === command.id);
      if (repeated) {
        if (repeated.autorId !== req.user.id || repeated.impersonadoPorId !== req.user.impersonatedBy?.id || repeated.version !== command.version || repeated.nota !== command.nota || repeated.decision !== command.decision) {
          throw new AppError('La resolución ya tiene otro contenido', 409);
        }
        return current;
      }
      if (current.version !== command.version) throw new AppError('La revisión cambió; recargá antes de resolver', 409);
      const updated = await tx.adendaManifiesto.updateMany({ where: { id: current.id, version: command.version }, data: {
        version: { increment: 1 }, revisiones: [...reviews, { ...command, autorId: req.user.id, ...(req.user.impersonatedBy ? { impersonadoPorId: req.user.impersonatedBy.id } : {}), fecha: new Date().toISOString() }] as unknown as Prisma.InputJsonValue,
      } });
      if (updated.count !== 1) throw new AppError('Otro revisor resolvió esta versión; recargá', 409);
      if (command.decision === 'APROBADA') {
        await noticeNewCurrents(tx, (current.declaracion as { residuos?: unknown }).residuos, current.residuos,
          '/manifiestos/' + current.manifiestoId + '/adendas', command.id, req.user.id);
      }
      return tx.adendaManifiesto.findUniqueOrThrow({ where: { id: current.id } });
    });
    res.json({ success: true, data: { adenda: present(record, req) } });
  } catch (error) { next(error); }
}
