import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { canReviewAsCounterpart } from '../domain/partyReview';
import { noticeNewCurrents } from '../services/postFactoNotice.service';
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
export function exceptionalCanReview(req: AuthRequest, record: { creadoPorId: string; impersonadoPorId?: unknown; datos?: unknown; operadorId?: unknown }) {
  const data = record.datos as { generador?: { padronId?: string }; transportista?: { padronId?: string } } | undefined;
  const counterpart = process.env.MANIFEST_PARTY_REVIEW_ENABLED === 'true' && data && canReviewAsCounterpart(req.user, record, {
    generadorId: data.generador?.padronId, transportistaId: data.transportista?.padronId,
    operadorId: typeof record.operadorId === 'string' ? record.operadorId : undefined,
  });
  return Boolean(counterpart || (reviewer(req) && record.creadoPorId !== req.user.id && record.impersonadoPorId !== req.user.id));
}
function scope(req: AuthRequest): Prisma.RegistroManifiestoExcepcionalWhereInput {
  if (reviewer(req)) return {};
  if (req.user.rol === 'OPERADOR' && req.user.operador?.id) return { operadorId: req.user.operador.id };
  if (req.user.rol === 'GENERADOR' && req.user.generador?.id) return { datos: { path: ['generador', 'padronId'], equals: req.user.generador.id } };
  if (req.user.rol === 'TRANSPORTISTA' && req.user.transportista?.id) return { datos: { path: ['transportista', 'padronId'], equals: req.user.transportista.id } };
  throw new AppError('Acceso reservado al operador y revisor designado', 403);
}
export async function exceptionalParticipants(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user.rol !== 'OPERADOR' || !req.user.operador?.id) throw new AppError('Sólo el operador selecciona participantes', 403);
    const type = req.query.tipo;
    if (type !== 'generador' && type !== 'transportista') throw new AppError('Tipo de participante inválido', 400);
    const search = String(req.query.q || '').trim().slice(0, 100);
    const where = search ? { OR: [{ razonSocial: { contains: search, mode: 'insensitive' as const } }, { cuit: { contains: search } }] } : {};
    const args = { where, select: { id: true, razonSocial: true, cuit: true, domicilio: true }, orderBy: { razonSocial: 'asc' as const }, take: 20 };
    const records = type === 'generador' ? await prisma.generador.findMany(args) : await prisma.transportista.findMany(args);
    res.json({ success: true, data: { participantes: records.map(r => ({
      padronId: r.id, nombre: r.razonSocial, identificacion: r.cuit, domicilio: r.domicilio || 'Sin domicilio en padrón',
    })) } });
  } catch (error) { next(error); }
}
function present(record: { id: string; creadoPorId: string; eventos: Prisma.JsonValue; [key: string]: unknown }, req: AuthRequest) {
  return { ...record, referencia: 'BI-' + record.id, numeroOficial: null,
    revisiones: exceptionalPending(record.id, record.eventos as unknown as ExceptionalEvent[]),
    puedeResolver: exceptionalCanReview(req, record),
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
    const huellaSolicitud = createHash('sha256').update(JSON.stringify(input.data)).digest('hex');
    const existing = await prisma.registroManifiestoExcepcional.findUnique({ where: { id: input.data.id } });
    if (existing) {
      if (existing.creadoPorId !== req.user.id || existing.impersonadoPorId !== (req.user.impersonatedBy?.id || null) || existing.huellaSolicitud !== huellaSolicitud) throw new AppError('La referencia ya se usó para otro registro', 409);
      res.status(201).json({ success: true, data: { registro: present(existing, req) } }); return;
    }
    const snapshot = async (type: 'generador' | 'transportista') => {
      const declared = input.data[type];
      if (!declared.padronId) return declared;
      const args = { where: { id: declared.padronId }, select: { id: true, razonSocial: true, cuit: true, domicilio: true } };
      const actor = type === 'generador' ? await prisma.generador.findUnique(args) : await prisma.transportista.findUnique(args);
      if (!actor) throw new AppError('El participante seleccionado no existe en el padrón', 400);
      return { padronId: actor.id, nombre: actor.razonSocial, identificacion: actor.cuit, domicilio: actor.domicilio || 'Sin domicilio en padrón' };
    };
    const [generador, transportista] = await Promise.all([snapshot('generador'), snapshot('transportista')]);
    const datos = { ...input.data, generador, transportista } as unknown as Prisma.InputJsonValue;
    // Upsert with an empty update gives retry-safe creation without changing facts.
    const record = await prisma.registroManifiestoExcepcional.upsert({
      where: { id: input.data.id }, update: {},
      create: { id: input.data.id, operadorId: req.user.operador.id, creadoPorId: req.user.id,
        impersonadoPorId: req.user.impersonatedBy?.id || null, huellaSolicitud, datos, eventos: [] },
    });
    // Compare the normalized request fingerprint; the original padrón snapshot remains immutable.
    if (record.creadoPorId !== req.user.id || record.impersonadoPorId !== (req.user.impersonatedBy?.id || null) || record.huellaSolicitud !== huellaSolicitud) throw new AppError('La referencia ya se usó para otro registro', 409);
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
        const { autorId, impersonadoPorId, fecha: _date, ...previous } = repeated;
        if (autorId !== req.user.id || impersonadoPorId !== req.user.impersonatedBy?.id || !same(previous, command)) throw new AppError('La acción ya tiene otro contenido', 409);
        return current;
      }
      if (command.version !== current.version) throw new AppError('Otro usuario actualizó el registro; recargá antes de continuar', 409);
      if (command.tipo !== 'RESOLVER' && (req.user.rol !== 'OPERADOR' || req.user.operador?.id !== current.operadorId)) {
        throw new AppError('Sólo el operador registra hechos y solicita revisión', 403);
      }
      const etapa = advanceExceptional(current.id, current.etapa as ExceptionalStage, events, command,
        exceptionalCanReview(req, current));
      const updated = await tx.registroManifiestoExcepcional.updateMany({
        where: { id: current.id, version: current.version },
        data: { etapa, version: { increment: 1 }, eventos: [...events,
          { ...command, autorId: req.user.id, ...(req.user.impersonatedBy ? { impersonadoPorId: req.user.impersonatedBy.id } : {}),
            fecha: new Date().toISOString() }] as unknown as Prisma.InputJsonValue },
      });
      if (updated.count !== 1) throw new AppError('El registro cambió; recargá antes de continuar', 409);
      if (command.tipo === 'RESOLVER' && command.decision === 'APROBADA' && command.objetivo !== current.id) {
        await noticeNewCurrents(tx, (current.datos as { residuos?: unknown }).residuos,
          events.find(e => e.id === command.objetivo && e.tipo === 'DIFERENCIA')?.residuos,
          '/manifiestos/baja-intensidad?registro=' + current.id, command.id);
      }
      return tx.registroManifiestoExcepcional.findUniqueOrThrow({ where: { id: current.id } });
    });
    res.json({ success: true, data: { registro: present(record, req) } });
  } catch (error) { next(error); }
}
