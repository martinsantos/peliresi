import { manifestFeatureEnabled, manifestPracticeIdentity } from '../lib/manifestTraining';
import { designatedReviewAccount } from '../domain/manifestReviewAuthority';
import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { canReviewAsCounterpart } from '../domain/partyReview';
import { noticeNewCurrents } from '../services/postFactoNotice.service';
import { recordEventualIntakes } from '../services/inspectionIntake.service';
import { notifyEventualParties } from '../services/eventualNotice.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import prisma from '../lib/prisma';
import { advanceExceptional, exceptionalApproval, exceptionalApprovers, exceptionalCanApprove, exceptionalCanRegister,
  exceptionalCreateSchema, exceptionalCreator, exceptionalEventSchema, exceptionalPending, planExceptionalSlots,
  EXCEPTIONAL_SLOTS, ExceptionalApprover, ExceptionalEvent, ExceptionalSlot, ExceptionalStage } from '../domain/manifiestoExcepcional';

// Operational sessions stay fail-closed; school sessions use their isolated store.
export function exceptionalEnabled(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!manifestFeatureEnabled('MANIFEST_EXCEPTIONAL_ENABLED')) return next(new AppError('Circuito no habilitado', 404));
  // Eventual records do not identify a site. An actor-wide match cannot prove
  // that a delegated single-site grant covers this particular record.
  if (req.user?.empresaContexto && req.user.empresaContexto.todasSedes !== true) {
    return next(new AppError('Los eventuales no identifican un establecimiento. Para consultarlos necesitás autorización para todos los establecimientos de la empresa.', 403));
  }
  next();
}
/** Sector administrators never gain eventual authority from the addendum policy. */
export function exceptionalDesignatedReviewer(user: AuthRequest['user']) {
  return user?.rol === 'ADMIN' && user.activo !== false && !user.restricted && !user.impersonatedBy && designatedReviewAccount(user.id);
}
function reviewer(req: AuthRequest) { return exceptionalDesignatedReviewer(req.user); }
export function exceptionalCanReview(req: AuthRequest, record: { creadoPorId: string; impersonadoPorId?: unknown; datos?: unknown; operadorId?: unknown }) {
  const data = record.datos as { generador?: { padronId?: string }; transportista?: { padronId?: string } } | undefined;
  const counterpart = manifestFeatureEnabled('MANIFEST_PARTY_REVIEW_ENABLED') && data && canReviewAsCounterpart(manifestPracticeIdentity(req.user), record, {
    generadorId: data.generador?.padronId, transportistaId: data.transportista?.padronId,
    operadorId: typeof record.operadorId === 'string' ? record.operadorId : undefined,
  });
  return Boolean(counterpart || (reviewer(req) && record.creadoPorId !== req.user.id && record.impersonadoPorId !== req.user.id));
}
/** Spec v2 §5: the reviewer reads all; the creator its own; each party where it figures with padrón. */
export function exceptionalReadWhere(user: AuthRequest['user']): Prisma.RegistroManifiestoExcepcionalWhereInput {
  if (exceptionalDesignatedReviewer(user)) return {};
  if (!user.restricted) {
    const own = { creadoPorId: user.id };
    if (user.rol === 'ADMIN') return own;
    if (user.rol === 'OPERADOR' && user.operador?.id) return { OR: [own, { operadorId: user.operador.id }] };
    if (user.rol === 'GENERADOR' && user.generador?.id) return { OR: [own, { datos: { path: ['generador', 'padronId'], equals: user.generador.id } }] };
    if (user.rol === 'TRANSPORTISTA' && user.transportista?.id) return { OR: [own, { datos: { path: ['transportista', 'padronId'], equals: user.transportista.id } }] };
  }
  throw new AppError('Acceso reservado a las partes del eventual y al revisor designado', 403);
}
const scope = (req: AuthRequest) => exceptionalReadWhere(req.user);
export async function exceptionalParticipants(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    exceptionalCreator(manifestPracticeIdentity(req.user));
    const type = req.query.tipo;
    if (type !== 'generador' && type !== 'transportista' && type !== 'operador') throw new AppError('Tipo de participante inválido', 400);
    const search = String(req.query.q || '').trim().slice(0, 100);
    const where = search ? { OR: [{ razonSocial: { contains: search, mode: 'insensitive' as const } }, { cuit: { contains: search } }] } : {};
    const args = { where, select: { id: true, razonSocial: true, cuit: true, domicilio: true }, orderBy: { razonSocial: 'asc' as const }, take: 20 };
    const records = type === 'generador' ? await prisma.generador.findMany(args)
      : type === 'transportista' ? await prisma.transportista.findMany(args) : await prisma.operador.findMany(args);
    res.json({ success: true, data: { participantes: records.map(r => ({
      padronId: r.id, nombre: r.razonSocial, identificacion: r.cuit, domicilio: r.domicilio || '',
    })) } });
  } catch (error) { next(error); }
}
type StoredRecord = { id: string; creadoPorId: string; autorRol?: string | null; operadorId?: string | null; datos: Prisma.JsonValue; eventos: Prisma.JsonValue; [key: string]: unknown };
const approversOf = (record: StoredRecord) => (record.datos as { aprobaciones?: ExceptionalApprover[] } | null)?.aprobaciones;
function canApproveParts(req: AuthRequest, record: StoredRecord) {
  return (approversOf(record) || []).filter(a => exceptionalCanApprove(manifestPracticeIdentity(req.user), a)).map(a => a.parte);
}
function present(record: StoredRecord, req: AuthRequest) {
  const events = record.eventos as unknown as ExceptionalEvent[];
  const aprobacion = exceptionalApproval(approversOf(record), events);
  return { ...record, referencia: 'BI-' + record.id, numeroOficial: null,
    revisiones: exceptionalPending(record.id, events), aprobacion,
    puedeAprobar: canApproveParts(req, record).filter(p => aprobacion.partes.some(a => a.parte === p && a.estado === 'PENDIENTE')),
    puedeResolver: exceptionalCanReview(req, record),
    puedeRegistrar: exceptionalCanRegister(req.user, record) };
}
export async function listExceptional(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const access = scope(req); // Same permission gate as detail, before evaluating any filter.
    const requestedPage = Number(req.query.page ?? 1), search = req.query.search ?? '', stage = req.query.etapa ?? '';
    if ((req.query.page !== undefined && typeof req.query.page !== 'string' && typeof req.query.page !== 'number') || !Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > 100000
      || typeof search !== 'string' || search.length > 100 || typeof stage !== 'string'
      || !['', 'REGISTRADO', 'RETIRADO', 'RECIBIDO', 'TRATADO'].includes(stage)) {
      throw new AppError('Filtros de eventuales inválidos', 400);
    }
    // Parameterized JSON search: Prisma 5 cannot search JSON strings case-insensitively.
    // SQL pagination uses the same actor scope; the final read rechecks access with Prisma.
    const user = req.user;
    let visibility = Prisma.sql`"creadoPorId" = ${user.id}`;
    if (reviewer(req)) visibility = Prisma.sql`TRUE`;
    else if (user.rol === 'OPERADOR' && user.operador?.id) visibility = Prisma.sql`(${visibility} OR "operadorId" = ${user.operador.id})`;
    else if (user.rol === 'GENERADOR' && user.generador?.id) visibility = Prisma.sql`(${visibility} OR datos->'generador'->>'padronId' = ${user.generador.id})`;
    else if (user.rol === 'TRANSPORTISTA' && user.transportista?.id) visibility = Prisma.sql`(${visibility} OR datos->'transportista'->>'padronId' = ${user.transportista.id})`;
    const term = search.trim();
    const pattern = '%' + term.replace(/[\\%_]/g, '\\$&') + '%';
    const condition = Prisma.sql`${visibility}
      ${stage ? Prisma.sql`AND etapa = ${stage}` : Prisma.empty}
      ${term ? Prisma.sql`AND (('BI-' || id) ILIKE ${pattern}
        OR datos->>'patente' ILIKE ${pattern}
        OR datos->'generador'->>'nombre' ILIKE ${pattern}
        OR datos->'generador'->>'identificacion' ILIKE ${pattern}
        OR datos->'transportista'->>'nombre' ILIKE ${pattern}
        OR datos->'transportista'->>'identificacion' ILIKE ${pattern}
        OR datos->'operador'->>'nombre' ILIKE ${pattern}
        OR datos->'operador'->>'identificacion' ILIKE ${pattern})` : Prisma.empty}`;
    const result = await prisma.$transaction(async tx => {
      const [{ total }] = await tx.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS total FROM registros_manifiesto_excepcional WHERE ${condition}`);
      const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / 20)));
      const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM registros_manifiesto_excepcional WHERE ${condition} ORDER BY "createdAt" DESC, id DESC LIMIT 20 OFFSET ${(page - 1) * 20}`);
      const records = await tx.registroManifiestoExcepcional.findMany({ where: { AND: [access, { id: { in: ids.map(row => row.id) } }] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      return { registros: records.map(r => present(r, req)), total, page, pageSize: 20 };
    }, { isolationLevel: 'RepeatableRead' });
    res.json({ success: true, data: result });
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
    const creator = exceptionalCreator(manifestPracticeIdentity(req.user));
    const input = exceptionalCreateSchema.safeParse(req.body);
    if (!input.success) throw new AppError(input.error.issues[0].message, 400);
    const huellaSolicitud = createHash('sha256').update(JSON.stringify(input.data)).digest('hex');
    const existing = await prisma.registroManifiestoExcepcional.findUnique({ where: { id: input.data.id } });
    if (existing) {
      if (existing.creadoPorId !== req.user.id || existing.impersonadoPorId !== (req.user.impersonatedBy?.id || null) || existing.huellaSolicitud !== huellaSolicitud) throw new AppError('La referencia ya se usó para otro registro', 409);
      res.status(201).json({ success: true, data: { registro: present(existing, req) } }); return;
    }
    const slots = planExceptionalSlots(creator, input.data);
    const active: Partial<Record<ExceptionalSlot, boolean>> = {};
    const snapshot = async (type: ExceptionalSlot) => {
      const declared = slots[type];
      if (!declared.padronId) return declared;
      const args = { where: { id: declared.padronId }, select: { id: true, razonSocial: true, cuit: true, domicilio: true, usuario: { select: { activo: true } } } };
      const actor = type === 'generador' ? await prisma.generador.findUnique(args)
        : type === 'transportista' ? await prisma.transportista.findUnique(args) : await prisma.operador.findUnique(args);
      if (!actor) throw new AppError('El participante seleccionado no existe en el padrón', 400);
      active[type] = actor.usuario?.activo === true;
      return { padronId: actor.id, nombre: actor.razonSocial, identificacion: actor.cuit, domicilio: actor.domicilio || '' };
    };
    const [generador, transportista, operador] = await Promise.all(EXCEPTIONAL_SLOTS.map(snapshot));
    const aprobaciones = exceptionalApprovers(creator, req.user.id, { generador, transportista, operador }, active);
    const datos = { ...input.data, generador, transportista, operador, aprobaciones } as unknown as Prisma.InputJsonValue;
    // Upsert with an empty update gives retry-safe creation without changing facts.
    const record = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`eventual:${input.data.id}`}, 0))::text`;
      const repeated = await tx.registroManifiestoExcepcional.findUnique({ where: { id: input.data.id } });
      if (repeated) return repeated;
      const created = await tx.registroManifiestoExcepcional.upsert({
      where: { id: input.data.id }, update: {},
      create: { id: input.data.id, operadorId: operador.padronId || null, creadoPorId: req.user.id,
        autorRol: creator.rol, autorActorId: creator.rol === 'ADMIN' ? null : creator.actorId,
        impersonadoPorId: req.user.impersonatedBy?.id || null, huellaSolicitud, datos, eventos: [] },
      });
      await recordEventualIntakes(tx, created);
      await notifyEventualParties(tx, created, 'creacion');
      return created;
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
      const decision = command.tipo === 'APROBAR_PARTE' || command.tipo === 'RECHAZAR_PARTE';
      if (command.tipo !== 'RESOLVER' && !decision && !exceptionalCanRegister(req.user, current)) {
        throw new AppError('Registran hechos quien creó el eventual y las partes con usuario que figuran en él', 403);
      }
      const etapa = advanceExceptional(current.id, current.etapa as ExceptionalStage, events, command,
        exceptionalCanReview(req, current), { aprobaciones: approversOf(current), puedeAprobar: canApproveParts(req, current) });
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
          '/manifiestos/baja-intensidad?registro=' + current.id, command.id, req.user.id);
      }
      const committed = await tx.registroManifiestoExcepcional.findUniqueOrThrow({ where: { id: current.id } });
      await notifyEventualParties(tx, committed, command.id);
      return committed;
    });
    res.json({ success: true, data: { registro: present(record, req) } });
  } catch (error) { next(error); }
}
