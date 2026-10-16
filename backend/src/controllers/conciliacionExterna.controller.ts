import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { externalTrackingScope } from './seguimientoExterno.controller';
import { reconciliationCommand, verifiedCuit } from '../domain/conciliacionExterna';

const roleQuery = z.object({ rol: z.enum(['generador', 'transportista']) }).strict();
type Role = 'generador' | 'transportista';
type Tx = Prisma.TransactionClient;
async function context(tx: Tx, req: AuthRequest, rol: Role) {
  const operatorId = externalTrackingScope(req.user);
  const record = await tx.registroManifiestoExcepcional.findFirst({ where: { id: req.params.id,
    ...(operatorId ? { operadorId: operatorId } : {}) } });
  if (!record) throw new AppError('Registro no encontrado', 404);
  const declared = (record.datos as Record<string, { identificacion: string; nombre: string; padronId?: string }>)[rol];
  if (!declared || declared.padronId) throw new AppError('El participante ya fue declarado con ficha de padrón', 400);
  const cuit = verifiedCuit(declared.identificacion);
  // Only the existing designated authority can confirm identity; no automatic
  // merge, counterpart permission, official number or notification is granted.
  const canReview = operatorId === null && record.creadoPorId !== req.user.id && record.impersonadoPorId !== req.user.id;
  const latest = await tx.conciliacionParticipanteExterno.findFirst({ where: { registroId: record.id, rol }, orderBy: { revision: 'desc' } });
  return { record, declared, cuit, canReview, latest };
}
async function candidates(tx: Tx, rol: Role, cuit: string | null) {
  if (!cuit) return [];
  const formatted = cuit.slice(0, 2) + '-' + cuit.slice(2, 10) + '-' + cuit.slice(10);
  const args = { where: { cuit: { in: [cuit, formatted] } },
    select: { id: true, razonSocial: true, cuit: true, domicilio: true }, take: 3 };
  return rol === 'generador' ? tx.generador.findMany(args) : tx.transportista.findMany(args);
}
export async function getExternalReconciliation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const parsed = roleQuery.safeParse(req.query);
    if (!parsed.success) throw new AppError('Tipo de participante inválido', 400);
    const rol = parsed.data.rol;
    const result = await prisma.$transaction(async tx => {
      const ctx = await context(tx, req, rol);
      const matches = await candidates(tx, rol, ctx.cuit);
      const history = await tx.conciliacionParticipanteExterno.findMany({ where: { registroId: ctx.record.id, rol }, orderBy: { revision: 'desc' }, take: 50 });
      return { declarado: ctx.declared, revision: ctx.latest?.revision || 0,
        vinculo: ctx.latest?.accion === 'VINCULAR' ? ctx.latest : null, historial: history,
        candidato: matches.length === 1 ? matches[0] : null, puedeRevisar: ctx.canReview,
        pendiente: !ctx.cuit ? 'CUIT incompleto o dudoso. Se conserva pendiente, sin frenar el viaje.'
          : matches.length !== 1 ? 'No hay una ficha única con ese CUIT. Requiere revisar el padrón.' : null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
}
export async function reconcileExternal(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const parsed = reconciliationCommand.safeParse(req.body);
    if (!parsed.success) throw new AppError('Indicá la ficha, revisión y motivo de esta acción', 400);
    const command = parsed.data;
    const result = await prisma.$transaction(async tx => {
      const ctx = await context(tx, req, command.rol);
      if (!ctx.canReview) throw new AppError('Sólo el revisor designado distinto del autor confirma la conciliación', 403);
      const repeated = await tx.conciliacionParticipanteExterno.findUnique({ where: { id: command.id } });
      if (repeated) {
        if (repeated.registroId !== ctx.record.id || repeated.rol !== command.rol || repeated.autorId !== req.user.id ||
          repeated.revision !== command.revision + 1 || repeated.accion !== command.accion ||
          repeated.actorId !== (command.actorId || null) || repeated.motivo !== command.motivo)
          throw new AppError('La acción ya fue usada con otro contenido', 409);
        return repeated;
      }
      if (command.revision !== (ctx.latest?.revision || 0)) throw new AppError('La conciliación cambió. Recargá antes de confirmar.', 409);
      let ficha: Prisma.InputJsonValue | undefined;
      if (command.accion === 'VINCULAR') {
        if (ctx.latest?.accion === 'VINCULAR') throw new AppError('Desvinculá con motivo antes de rectificar', 409);
        const matches = await candidates(tx, command.rol, ctx.cuit);
        if (matches.length !== 1 || matches[0].id !== command.actorId) throw new AppError('CUIT o ficha dudosos: queda pendiente de conciliación', 409);
        ficha = matches[0];
      } else if (ctx.latest?.accion !== 'VINCULAR') throw new AppError('No hay un vínculo vigente para rectificar', 409);
      return tx.conciliacionParticipanteExterno.create({ data: { id: command.id, registroId: ctx.record.id,
        rol: command.rol, revision: command.revision + 1, accion: command.accion, actorId: command.actorId,
        ficha, motivo: command.motivo, autorId: req.user.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code))
      return next(new AppError('Otra revisión se confirmó. Recargá antes de continuar.', 409));
    next(error);
  }
}
