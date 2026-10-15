import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import prisma from '../lib/prisma';
import { advanceExceptional, exceptionalCreateSchema, exceptionalEventSchema, exceptionalPending,
  ExceptionalEvent, ExceptionalStage } from '../domain/manifiestoExcepcional';

// Fail closed. No runtime enablement on existing deployments.
export function exceptionalEnabled(_req: AuthRequest, _res: Response, next: NextFunction) {
  if (process.env.MANIFEST_EXCEPTIONAL_ENABLED !== 'true') return next(new AppError('Circuito no habilitado', 404));
  next();
}
function reviewer(req: AuthRequest) {
  return req.user.rol === 'ADMIN' && !req.user.impersonatedBy &&
    (process.env.MANIFEST_EXCEPTIONAL_REVIEWERS || '').split(',').includes(req.user.id);
}
function scope(req: AuthRequest) {
  if (reviewer(req)) return {};
  if (req.user.rol === 'OPERADOR' && req.user.operador?.id) return { operadorId: req.user.operador.id };
  throw new AppError('Acceso reservado al operador y revisor designado', 403);
}
function present(record: { id: string; creadoPorId: string; eventos: Prisma.JsonValue; [key: string]: unknown }, req: AuthRequest) {
  return { ...record, referencia: 'BI-' + record.id, numeroOficial: null,
    revisiones: exceptionalPending(record.id, record.eventos as unknown as ExceptionalEvent[]),
    puedeResolver: reviewer(req) && record.creadoPorId !== req.user.id,
    puedeRegistrar: req.user.rol === 'OPERADOR' && req.user.operador?.id === record.operadorId };
}
export async function listExceptional(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const where = scope(req);
    const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
    const [records, total] = await Promise.all([
      prisma.registroManifiestoExcepcional.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20, skip: (Math.floor(page) - 1) * 20 }),
      prisma.registroManifiestoExcepcional.count({ where }),
    ]);
    res.json({ success: true, data: { registros: records.map(r => present(r, req)), total } });
  } catch (error) { next(error); }
}
export async function getExceptional(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const record = await prisma.registroManifiestoExcepcional.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!record) throw new AppError('Registro no encontrado', 404);
    res.json({ success: true, data: { registro: present(record, req) } });
  } catch (error) { next(error); }
}
export async function createExceptional(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    scope(req);
    if (req.user.rol !== 'OPERADOR' || !req.user.operador?.id) throw new AppError('El operador registra su propia operación', 403);
    const input = exceptionalCreateSchema.safeParse(req.body);
    if (!input.success) throw new AppError(input.error.issues[0].message, 400);
    const datos = input.data as unknown as Prisma.InputJsonValue;
    // Upsert with an empty update gives retry-safe creation without changing facts.
    const record = await prisma.registroManifiestoExcepcional.upsert({
      where: { id: input.data.id }, update: {},
      create: { id: input.data.id, operadorId: req.user.operador.id, creadoPorId: req.user.id, datos, eventos: [] },
    });
    if (record.creadoPorId !== req.user.id || JSON.stringify(record.datos) !== JSON.stringify(JSON.parse(JSON.stringify(datos)))) {
      // JSONB key order is not stable; structural comparison below handles it.
      if (record.creadoPorId !== req.user.id || !same(record.datos, datos)) throw new AppError('La referencia ya se usó para otro registro', 409);
    }
    res.status(201).json({ success: true, data: { registro: present(record, req) } });
  } catch (error) { next(error); }
}
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  return ak.length === bk.length && ak.every(k => Object.prototype.hasOwnProperty.call(b, k) &&
    same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
export async function eventExceptional(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const where = { id: req.params.id, ...scope(req) };
    const parsed = exceptionalEventSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const command = parsed.data;
    const record = await prisma.$transaction(async tx => {
      const current = await tx.registroManifiestoExcepcional.findFirst({ where });
      if (!current) throw new AppError('Registro no encontrado', 404);
      const events = current.eventos as unknown as ExceptionalEvent[];
      const repeated = events.find(e => e.id === command.id);
      if (repeated) {
        const { autorId, fecha: _date, ...previous } = repeated;
        if (autorId !== req.user.id || !same(previous, command)) throw new AppError('La acción ya tiene otro contenido', 409);
        return current;
      }
      if (command.version !== current.version) throw new AppError('Otro usuario actualizó el registro; recargá antes de continuar', 409);
      if (command.tipo !== 'RESOLVER' && (req.user.rol !== 'OPERADOR' || req.user.operador?.id !== current.operadorId)) {
        throw new AppError('Sólo el operador registra hechos y solicita revisión', 403);
      }
      const etapa = advanceExceptional(current.id, current.etapa as ExceptionalStage, events, command,
        reviewer(req) && current.creadoPorId !== req.user.id);
      const updated = await tx.registroManifiestoExcepcional.updateMany({
        where: { id: current.id, version: current.version },
        data: { etapa, version: { increment: 1 }, eventos: [...events,
          { ...command, autorId: req.user.id, fecha: new Date().toISOString() }] as unknown as Prisma.InputJsonValue },
      });
      if (updated.count !== 1) throw new AppError('El registro cambió; recargá antes de continuar', 409);
      return tx.registroManifiestoExcepcional.findUniqueOrThrow({ where: { id: current.id } });
    });
    res.json({ success: true, data: { registro: present(record, req) } });
  } catch (error) { next(error); }
}
