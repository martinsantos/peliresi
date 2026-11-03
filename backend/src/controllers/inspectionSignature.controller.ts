import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { canAccessInspection, inspectionInclude } from './inspeccion.controller';
import { inspectionSignatureHash, inspectionSignatureSnapshot, inspectionCurrentSignatures, signatureFieldErrors } from '../domain/inspectionSignature';
import { prepareManifiestoSignature } from '../domain/manifiestoSignature';
import { streamInspectionActPdf } from '../services/inspectionFieldActPdf.service';
import { resolveInspectionEvidence } from '../services/inspectionEvidence.service';
import { exchangePartyForUser } from '../services/inspectionExchange.service';

const signatureSchema = z.object({
  version: z.number().int().positive(), contenidoSha256: z.string().regex(/^[a-f0-9]{64}$/),
  clienteId: z.string().uuid(), nombre: z.string().trim().min(2).max(200), documento: z.string().trim().min(3).max(40),
  caracter: z.string().trim().min(2).max(120), tipo: z.enum(['INSPECCIONADO', 'INSPECTOR']),
  imagen: z.string().max(175000), lecturaConfirmada: z.literal(true),
}).strict();
async function readInspection(req: AuthRequest) {
  const i = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, include: inspectionInclude });
  if (!i) throw new AppError('Inspección no encontrada', 404);
  if (!canAccessInspection(req.user, i)) throw new AppError('No autorizado para preparar o capturar esta acta', 403);
  return i;
}
export async function previewInspectionSignature(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const i = await readInspection(req);
    res.json({ success: true, data: { version: i.version, contenidoSha256: inspectionSignatureHash(i), acta: inspectionSignatureSnapshot(i), firmas: inspectionCurrentSignatures(i), pendientes: signatureFieldErrors(i) } });
  } catch (e) { next(e); }
}
export async function signInspectionAct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = signatureSchema.parse(req.body); const initial = await readInspection(req);
    const signature = await prepareManifiestoSignature(input.imagen);
    if (!signature) throw new AppError('Dibujá una firma antes de confirmar', 400);
    const result = await prisma.$transaction(async tx => {
      const previous = await tx.eventoInspeccion.findFirst({ where: { inspeccionId: initial.id, tipo: 'ACTA_FIRMADA', metadata: { path: ['clienteId'], equals: input.clienteId } } });
      if (previous) {
        const meta = previous.metadata as any;
        if (previous.usuarioId !== req.user.id || meta.contenidoSha256 !== input.contenidoSha256 || meta.firma.sha256 !== signature.sha256 || meta.firma.nombre !== input.nombre || meta.firma.documento !== input.documento || meta.firma.caracter !== input.caracter || meta.firma.tipo !== input.tipo) throw new AppError('El identificador de firma ya corresponde a otra operación.', 409);
        return { id: previous.id, contenidoSha256: meta.contenidoSha256, version: meta.version };
      }
      const reserved = await tx.inspeccion.updateMany({ where: { id: initial.id, version: input.version, estado: { in: ['BORRADOR', 'PLANIFICADA', 'EN_CAMPO'] } }, data: { version: { increment: 1 }, ...(input.tipo === 'INSPECCIONADO' ? { datosActa: { ...((initial.datosActa || {}) as Record<string, unknown>), firmaIntervinienteEstado: 'FIRMADA', firmaIntervinienteDetalle: `Firma manuscrita registrada de ${input.nombre}; lectura y recepción, sin conformidad con los hallazgos.` } as Prisma.InputJsonValue } : {}) } });
      if (reserved.count !== 1) throw new AppError('El acta cambió. Revisá la versión actual antes de volver a firmar.', 409);
      const current = await tx.inspeccion.findUniqueOrThrow({ where: { id: initial.id }, include: inspectionInclude });
      if (!canAccessInspection(req.user, current)) throw new AppError('La asignación del expediente cambió.', 403);
      if (inspectionSignatureHash(current) !== input.contenidoSha256) throw new AppError('Cambió el contenido presentado para la firma. Volvé a revisarlo.', 409);
      const pending = signatureFieldErrors(current); if (pending.length) throw new AppError(pending.join(' '), 400);
      const snapshot = inspectionSignatureSnapshot(current);
      const firma = { nombre: input.nombre, documento: input.documento, caracter: input.caracter, tipo: input.tipo, imagen: signature.imagen, sha256: signature.sha256, capturadaPor: req.user.id, metodo: 'MANUSCRITA_EN_PANTALLA', alcance: 'Lectura y constancia de recepción; no implica conformidad con los hallazgos.' };
      const event = await tx.eventoInspeccion.create({ data: { inspeccionId: initial.id, usuarioId: req.user.id, tipo: 'ACTA_FIRMADA', titulo: 'Firma manuscrita del acta registrada', visibleActor: true, metadata: { schemaVersion: 1, clienteId: input.clienteId, contenidoSha256: input.contenidoSha256, version: current.version, snapshot, firma } as Prisma.InputJsonValue } });
      return { id: event.id, contenidoSha256: input.contenidoSha256, version: current.version };
    });
    res.status(201).json({ success: true, data: result, message: 'Firma conservada con la versión revisada. No se enviaron correos.' });
  } catch (e) { next(e); }
}
export async function downloadSignedInspectionAct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const i = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, include: inspectionInclude });
    if (!i) throw new AppError('Inspección no encontrada', 404);
    const party = exchangePartyForUser(req.user, i);
    if (!canAccessInspection(req.user, i) && party !== 'INSPECCIONADO') throw new AppError('No autorizado para esta copia', 403);
    const event = i.eventos.find(e => e.id === req.params.firmaId && e.tipo === 'ACTA_FIRMADA' && e.visibleActor);
    const meta = event?.metadata as any;
    if (!event || !meta?.snapshot || !meta?.firma) throw new AppError('Copia firmada no encontrada', 404);
    if (inspectionSignatureHash(meta.snapshot) !== meta.contenidoSha256) throw new AppError('No pudo verificarse la integridad de esta copia', 409);
    const snapshot = { ...meta.snapshot, version: meta.version, estado: 'EN_CAMPO', eventos: [], intercambios: [], informeTecnico: {}, firmasCapturadas: [{ id: event.id, ...meta.firma, registradaAt: event.createdAt, contenidoSha256: meta.contenidoSha256 }] };
    await streamInspectionActPdf(res, snapshot, resolveInspectionEvidence);
  } catch (e) { next(e); }
}
