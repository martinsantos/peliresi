import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { assertCanAccessManifiesto } from '../utils/roleFilter';
import { currentsDecisionMessage, generatorAuthorizedCurrents, openExceptions } from '../domain/generatorCurrents';
import { isInspectionStaff } from '../domain/inspectionOperations';
import { canGrantGeneratorException, evaluateGeneratorCurrents, generatorExceptionsEnabled, grantGeneratorException, manifestDeclaredCurrents } from '../services/generatorCurrentException.service';

const APPROVAL_STAGES = ['BORRADOR', 'PENDIENTE_APROBACION'];
const grantSchema = z.object({ motivo: z.string().trim().min(10, 'Explicá el motivo de la excepción').max(1000) }).strict();

/** Manifest banner: does it declare a Y outside the generator's ficha, and who must act. */
export async function manifestCurrentException(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authority = canGrantGeneratorException(req.user);
    if (!authority) await assertCanAccessManifiesto(prisma, req.user, req.params.id);
    if (!generatorExceptionsEnabled()) { res.json({ success: true, data: { habilitado: false } }); return; }
    const data = await prisma.$transaction(async tx => {
      const { manifest, corrientes } = await manifestDeclaredCurrents(tx, req.params.id);
      const { decision, state } = await evaluateGeneratorCurrents(tx, { generadorId: manifest.generadorId, manifiestoId: manifest.id, corrientes });
      const own = await tx.excepcionCorrienteGenerador.findFirst({ where: { manifiestoId: manifest.id }, orderBy: { createdAt: 'asc' } });
      return { habilitado: true, estado: decision.estado, corrientes: 'corrientes' in decision ? decision.corrientes : [],
        mensaje: currentsDecisionMessage(decision, 'APROBACION'), fichaGenerador: state.authorized,
        excepcion: own ? { id: own.id, corrientes: own.corrientes, otorgadaAt: own.createdAt, cerradaAt: own.cerradaAt, motivo: own.motivo } : null,
        puedeOtorgar: authority && decision.estado === 'REQUIERE_EXCEPCION' && APPROVAL_STAGES.includes(manifest.estado) };
    });
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ success: true, data });
  } catch (error) { next(error); }
}

/** The authority grants the generator's single exception for a manifest declared with a Y outside its ficha. */
export async function grantManifestCurrentException(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!generatorExceptionsEnabled()) throw new AppError('Función no habilitada', 404);
    if (!canGrantGeneratorException(req.user)) throw new AppError('Sólo la autoridad de aplicación designada, desde su propia sesión, otorga esta excepción', 403);
    const { motivo } = grantSchema.parse(req.body);
    const exception = await prisma.$transaction(async tx => {
      const { manifest, corrientes } = await manifestDeclaredCurrents(tx, req.params.id);
      const { decision } = await evaluateGeneratorCurrents(tx, { generadorId: manifest.generadorId, manifiestoId: manifest.id, corrientes, lock: true });
      if (decision.estado === 'CUBIERTAS_POR_EXCEPCION') return tx.excepcionCorrienteGenerador.findUniqueOrThrow({ where: { id: decision.excepcionId } });
      if (decision.estado === 'BLOQUEADA') throw new AppError(currentsDecisionMessage(decision, 'APROBACION') as string, 409);
      if (decision.estado !== 'REQUIERE_EXCEPCION') throw new AppError('Este manifiesto no declara corrientes fuera de la ficha del generador', 409);
      if (!APPROVAL_STAGES.includes(manifest.estado)) throw new AppError('La excepción se otorga antes de las aprobaciones del manifiesto', 409);
      return grantGeneratorException(tx, { generadorId: manifest.generadorId, origen: 'MANIFIESTO', origenId: manifest.id, manifiestoId: manifest.id, numero: manifest.numero,
        corrientes: decision.corrientes, motivo, userId: req.user.id, impersonadoPorId: null, url: '/manifiestos/' + manifest.id,
        detalle: { declarado: decision.corrientes, estadoManifiesto: manifest.estado } });
    });
    res.status(201).json({ success: true, data: { excepcion: exception }, message: 'Excepción otorgada. Las partes ya pueden aprobar el manifiesto.' });
  } catch (error) { next(error); }
}

/** Generator history: authority, inspection staff, or the generator's own account. */
export async function generatorCurrentExceptions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const own = req.user.rol === 'GENERADOR' && req.user.generador?.id === req.params.id;
    if (!own && !isInspectionStaff(req.user) && req.user.rol !== 'ADMIN') throw new AppError('Generador no encontrado', 404);
    const generador = await prisma.generador.findUnique({ where: { id: req.params.id }, select: { id: true, corrientesControl: true } });
    if (!generador) throw new AppError('Generador no encontrado', 404);
    const ficha = generatorAuthorizedCurrents(generador.corrientesControl);
    const rows = await prisma.excepcionCorrienteGenerador.findMany({ where: { generadorId: generador.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    const open = new Set(openExceptions(rows, ficha).map(r => r.id));
    const manifests = await prisma.manifiesto.findMany({ where: { id: { in: [...new Set(rows.map(r => r.manifiestoId))] } }, select: { id: true, numero: true } });
    const numbers = new Map(manifests.map(m => [m.id, m.numero]));
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ success: true, data: { habilitado: generatorExceptionsEnabled(), fichaCorrientes: ficha, disponible: open.size === 0,
      excepciones: rows.map(r => ({ id: r.id, origen: r.origen, origenId: r.origenId, manifiestoId: r.manifiestoId, numero: numbers.get(r.manifiestoId) || null,
        corrientes: r.corrientes, motivo: r.motivo, otorgadaAt: r.createdAt, estado: open.has(r.id) ? 'ABIERTA' : 'CERRADA',
        cerradaAt: r.cerradaAt, cierre: r.cierre })) } });
  } catch (error) { next(error); }
}
