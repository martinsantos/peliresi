import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { supportCanManage, supportContext, supportCreateInput, supportMutationInput, supportFingerprint, supportNumber, SUPPORT_STATES, SUPPORT_TYPES, SUPPORT_PRIORITIES, SUPPORT_CATEGORIES } from '../services/supportPolicy.service';
import { describeSupportFile, discardSupportFiles, persistSupportFiles, resolveSupportFile, SupportFile } from '../services/supportFile.service';

const userSelect = { id: true, nombre: true, apellido: true } as const;
const fileSelect = { id: true, nombre: true, mime: true, bytes: true, sha256: true } as const;
const ticketInclude = { autor: { select: userSelect }, responsable: { select: userSelect }, registradoPor: { select: userSelect } } as const;
type Db = Prisma.TransactionClient;
async function staff(user: AuthRequest['user'], db: Db = prisma) {
  if (!user || user.restricted || user.activo === false) return false;
  return supportCanManage(user, user.rol === 'ADMIN' || Boolean((await db.agenteSoporte.findUnique({ where: { usuarioId: user.id } }))?.habilitado));
}
async function access(req: AuthRequest, db: Db = prisma) {
  const managing = await staff(req.user, db);
  const ticket = await db.ticketSoporte.findUnique({ where: { id: req.params.id }, include: ticketInclude });
  // Same response for unknown and foreign IDs; no private subject disclosure.
  if (!ticket || (!managing && ticket.autorId !== req.user.id)) throw new AppError('Ticket no encontrado', 404);
  return { ticket, managing };
}
function key(req: AuthRequest): string {
  const value = req.get('Idempotency-Key');
  if (!value || !/^[a-zA-Z0-9_-]{8,100}$/.test(value)) throw new AppError('Falta una clave de envío válida', 400);
  return value;
}
function uploads(req: AuthRequest): Express.Multer.File[] { return Array.isArray(req.files) ? req.files : []; }
function inputBody(req: AuthRequest) {
  const body = { ...req.body };
  if (typeof body.contexto === 'string') {
    try { body.contexto = JSON.parse(body.contexto); } catch { throw new AppError('Contexto inválido', 400); }
  }
  return body;
}
function checkHash(old: { huella: string }, fingerprint: string) {
  if (old.huella !== fingerprint) throw new AppError('La clave de envío ya se usó para otro contenido', 409);
}
async function notices(db: Db, ticket: { id: string; numero: number }, recipients: string[], actorId: string, title: string) {
  const ids = Array.from(new Set(recipients)).filter(id => id !== actorId);
  if (!ids.length) return;
  // Deliberately direct durable in-app writes. No dispatcher, SMTP, push or jobs.
  await db.notificacion.createMany({ data: ids.map(usuarioId => ({ usuarioId, tipo: 'INFO_GENERAL', titulo: title,
    mensaje: supportNumber(ticket.numero) + ' · Consultá el ticket en Soporte.',
    datos: JSON.stringify({ tipo: 'soporte', ticketId: ticket.id, ruta: '/soporte/' + ticket.id }), prioridad: 'NORMAL' })) });
}
async function team(db: Db = prisma) {
  // Directory is staff-only. Keep the public ticket/author projection unchanged.
  return db.usuario.findMany({ where: { activo: true, OR: [{ rol: 'ADMIN' }, { agenteSoporte: { habilitado: true } }] }, select: { ...userSelect, email: true }, orderBy: { nombre: 'asc' } });
}
export async function soporteAcceso(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: { puedeGestionar: await staff(req.user), puedeConfigurar: req.user.rol === 'ADMIN' } }); }
  catch (error) { next(error); }
}
export async function equipoSoporte(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!await staff(req.user)) throw new AppError('No autorizado para consultar el equipo', 403);
    res.json({ success: true, data: await team() });
  } catch (error) { next(error); }
}
export async function candidatosSoporte(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user.rol !== 'ADMIN') throw new AppError('Sólo el administrador configura soporte', 403);
    const search = String(req.query.search || '').trim().slice(0, 100);
    if (search.length < 2) return res.json({ success: true, data: [] });
    const rows = await prisma.usuario.findMany({ where: { activo: true, OR: [
      { nombre: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } },
    ] }, select: { ...userSelect, email: true, rol: true, agenteSoporte: { select: { habilitado: true } } }, take: 20, orderBy: { nombre: 'asc' } });
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}
export async function configurarAgente(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user.rol !== 'ADMIN') throw new AppError('Sólo el administrador configura soporte', 403);
    if (typeof req.body.habilitado !== 'boolean' || Object.keys(req.body).length !== 1) throw new AppError('Indicá si se habilita el acceso', 400);
    const habilitado = req.body.habilitado;
    await prisma.$transaction(async db => {
      await db.$queryRaw`SELECT id FROM usuarios WHERE id = ${req.params.userId} FOR UPDATE`;
      const target = await db.usuario.findUnique({ where: { id: req.params.userId } });
      if (!target || !target.activo) throw new AppError('Usuario activo no encontrado', 404);
      if (target.rol === 'ADMIN') throw new AppError('El administrador ya tiene acceso a soporte', 400);
      if (!habilitado && await db.ticketSoporte.count({ where: { responsableId: target.id, estado: { not: 'CERRADO' } } })) throw new AppError('Derivá sus tickets abiertos antes de deshabilitarlo', 409);
      await db.agenteSoporte.upsert({ where: { usuarioId: target.id }, create: { usuarioId: target.id, habilitado }, update: { habilitado } });
      await db.auditoria.create({ data: { usuarioId: req.user.id, accion: 'CONFIGURAR_SOPORTE', modulo: 'SOPORTE',
        datosDespues: JSON.stringify({ usuarioId: target.id, habilitado }) } });
    });
    res.json({ success: true, data: { habilitado } });
  } catch (error) { next(error); }
}
export async function listarTickets(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const managing = await staff(req.user);
    const scope = req.query.scope || 'mis';
    if (!['mis', 'mesa', 'asignados'].includes(String(scope))) throw new AppError('Vista inválida', 400);
    if (scope !== 'mis' && !managing) throw new AppError('No autorizado para la mesa de soporte', 403);
    const state = req.query.estado && String(req.query.estado);
    if (state && !SUPPORT_STATES.includes(state as typeof SUPPORT_STATES[number])) throw new AppError('Estado inválido', 400);
    const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1));
    if (!Number.isInteger(page)) throw new AppError('Página inválida', 400);
    const search = String(req.query.search || '').trim().slice(0, 180);
    const tipo = req.query.tipo && String(req.query.tipo);
    const prioridad = req.query.prioridad && String(req.query.prioridad);
    const categoria = req.query.categoria && String(req.query.categoria);
    const clasificado = req.query.clasificado && String(req.query.clasificado);
    if (tipo && !SUPPORT_TYPES.includes(tipo as typeof SUPPORT_TYPES[number])) throw new AppError('Tipo de ticket inválido', 400);
    if (prioridad && !SUPPORT_PRIORITIES.includes(prioridad as typeof SUPPORT_PRIORITIES[number])) throw new AppError('Prioridad inválida', 400);
    if (categoria && !SUPPORT_CATEGORIES.includes(categoria as typeof SUPPORT_CATEGORIES[number])) throw new AppError('Área inválida', 400);
    if (clasificado && !['si', 'no'].includes(clasificado)) throw new AppError('Filtro de clasificación inválido', 400);
    const numberMatch = /^(?:SOP-)?([0-9]{1,10})$/i.exec(search);
    const where: Prisma.TicketSoporteWhereInput = {
      ...(scope === 'mis' ? { autorId: req.user.id } : scope === 'asignados' ? { responsableId: req.user.id } : {}),
      ...(state ? { estado: state } : {}),
      ...(tipo ? { tipo } : {}), ...(prioridad ? { prioridad } : {}), ...(categoria ? { categoria } : {}),
      ...(clasificado ? { clasificadoAt: clasificado === 'si' ? { not: null } : null } : {}),
      ...(search ? { OR: [{ asunto: { contains: search, mode: 'insensitive' } }, ...(numberMatch && Number(numberMatch[1]) <= 2147483647 ? [{ numero: Number(numberMatch[1]) }] : [])] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.ticketSoporte.findMany({ where, include: ticketInclude, skip: (page - 1) * 20, take: 20, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] }),
      prisma.ticketSoporte.count({ where }),
    ]);
    // Do not expose request digests/keys through either the list or the detail.
    res.json({ success: true, data: { items: items.map(({ huella, clienteId, ...ticket }) => ({ ...ticket, referencia: supportNumber(ticket.numero) })), total, page, totalPages: Math.ceil(total / 20) } });
  } catch (error) { next(error); }
}
export async function obtenerTicket(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { ticket, managing } = await access(req);
    const [mensajes, eventos] = await Promise.all([
      prisma.mensajeSoporte.findMany({ where: { ticketId: ticket.id, ...(managing ? {} : { interno: false }) },
        include: { autor: { select: userSelect }, adjuntos: { select: fileSelect } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
      prisma.eventoSoporte.findMany({ where: { ticketId: ticket.id, ...(managing ? {} : { interno: false }) },
        select: { id: true, accion: true, estadoAnterior: true, estadoNuevo: true, version: true, createdAt: true, responsableAnteriorId: true, responsableNuevoId: true,
          usuario: { select: userSelect }, detalle: managing }, orderBy: { version: 'asc' } }),
    ]);
    const { huella, clienteId, ...safe } = ticket;
    res.json({ success: true, data: { ...safe, referencia: supportNumber(ticket.numero), mensajes, eventos,
      puedeGestionar: managing, puedeAtender: managing && (req.user.rol === 'ADMIN' || ticket.responsableId === req.user.id),
      esAutor: ticket.autorId === req.user.id } });
  } catch (error) { next(error); }
}
export async function comprobarEnvioTicket(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const ticket = await prisma.ticketSoporte.findUnique({ where: { autorId_clienteId: { autorId: req.user.id, clienteId: req.params.key } } });
    if (!ticket) throw new AppError('No hay constancia de ese envío', 404);
    res.json({ success: true, data: { id: ticket.id, referencia: supportNumber(ticket.numero) } });
  } catch (error) { next(error); }
}
export async function crearTicket(req: AuthRequest, res: Response, next: NextFunction) {
  let stored: SupportFile[] = [];
  let committed = false;
  try {
    const parsed = supportCreateInput.safeParse(inputBody(req));
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const clienteId = key(req);
    const payload = { ...parsed.data, contexto: supportContext(parsed.data.contexto) };
    const operatorId = req.user.impersonatedBy?.id || req.user.id;
    const files = uploads(req);
    const huella = supportFingerprint(payload, files.map(describeSupportFile));
    const previous = await prisma.ticketSoporte.findUnique({ where: { autorId_clienteId: { autorId: req.user.id, clienteId } } });
    if (previous) { checkHash(previous, huella); return res.status(200).json({ success: true, data: { id: previous.id, referencia: supportNumber(previous.numero) } }); }
    stored = await persistSupportFiles(files);
    let created;
    try {
      created = await prisma.$transaction(async db => {
        const ticket = await db.ticketSoporte.create({ data: { autorId: req.user.id, registradoPorId: req.user.impersonatedBy?.id || null, clienteId, huella, asunto: payload.asunto, categoria: payload.categoria, contexto: payload.contexto } });
        await db.mensajeSoporte.create({ data: { ticketId: ticket.id, autorId: operatorId, cuerpo: payload.descripcion,
          adjuntos: { create: stored } } });
        await notices(db, ticket, (await team(db)).map(user => user.id), operatorId, 'Nuevo ticket de soporte');
        if (req.user.impersonatedBy) await notices(db, ticket, [req.user.id], operatorId, 'Ticket registrado a tu nombre');
        return ticket;
      });
      committed = true;
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const replay = await prisma.ticketSoporte.findUnique({ where: { autorId_clienteId: { autorId: req.user.id, clienteId } } });
      if (!replay) throw error;
      checkHash(replay, huella);
      return res.status(200).json({ success: true, data: { id: replay.id, referencia: supportNumber(replay.numero) } });
    }
    res.status(201).json({ success: true, data: { id: created.id, referencia: supportNumber(created.numero) } });
  } catch (error) { next(error); }
  finally { if (!committed && stored.length) await discardSupportFiles(stored); }
}
export async function accionarTicket(req: AuthRequest, res: Response, next: NextFunction) {
  let stored: SupportFile[] = [];
  let committed = false;
  try {
    const parsed = supportMutationInput.safeParse(inputBody(req));
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const input = parsed.data;
    const clienteId = key(req);
    const files = uploads(req);
    if (files.length && !['RESPONDER', 'NOTA'].includes(input.accion)) throw new AppError('Los adjuntos sólo se admiten con un mensaje', 400);
    const huella = supportFingerprint(input, files.map(describeSupportFile));
    await access(req);
    stored = await persistSupportFiles(files);
    const result = await prisma.$transaction(async db => {
      // Same user-row lock as team revocation: a revoked agent cannot win a
      // concurrent claim after the revocation's open-assignment check.
      if (input.accion === 'TOMAR') await db.$queryRaw`SELECT id FROM usuarios WHERE id = ${req.user.id} FOR UPDATE`;
      await db.$queryRaw`SELECT id FROM tickets_soporte WHERE id = ${req.params.id} FOR UPDATE`;
      const { ticket, managing } = await access(req, db);
      const previous = await db.eventoSoporte.findUnique({ where: { ticketId_usuarioId_clienteId: { ticketId: ticket.id, usuarioId: req.user.id, clienteId } } });
      if (previous) { checkHash(previous, huella); return { id: ticket.id, version: ticket.version, replay: true }; }
      if (ticket.version !== input.version) throw new AppError('El ticket cambió. Actualizá antes de volver a actuar.', 409);
      const own = ticket.autorId === req.user.id;
      const assigned = managing && (ticket.responsableId === req.user.id || req.user.rol === 'ADMIN');
      let estado = ticket.estado;
      let responsableId = ticket.responsableId;
      const internal = ['NOTA', 'DERIVAR', 'CLASIFICAR'].includes(input.accion);
      switch (input.accion) {
        case 'RESPONDER':
          if (!own && !assigned) throw new AppError('Tomá o recibí el ticket antes de responder', 403);
          if (own) estado = ticket.estado === 'CERRADO' ? 'ABIERTO' : ticket.responsableId ? 'EN_CURSO' : 'ABIERTO';
          else if (ticket.estado === 'CERRADO') throw new AppError('Reabrí el ticket antes de responder', 409);
          break;
        case 'TOMAR':
          if (!managing) throw new AppError('No autorizado para tomar tickets', 403);
          if (ticket.estado === 'CERRADO') throw new AppError('El ticket está cerrado', 409);
          if (ticket.responsableId && ticket.responsableId !== req.user.id) throw new AppError('El ticket ya tiene responsable; usá una derivación', 409);
          responsableId = req.user.id; estado = 'EN_CURSO'; break;
        case 'DERIVAR': {
          if (!assigned) throw new AppError('Sólo el responsable o administrador puede derivar', 403);
          if (ticket.estado === 'CERRADO') throw new AppError('Reabrí antes de derivar', 409);
          if (input.responsableId === ticket.responsableId) throw new AppError('Elegí otro responsable', 400);
          await db.$queryRaw`SELECT id FROM usuarios WHERE id = ${input.responsableId} FOR UPDATE`;
          const target = await db.usuario.findUnique({ where: { id: input.responsableId } });
          if (!await staff(target, db)) throw new AppError('El destinatario no es un agente de soporte activo', 400);
          responsableId = target!.id; estado = 'EN_CURSO'; break;
        }
        case 'NOTA': if (!assigned) throw new AppError('Sólo el responsable puede agregar notas', 403); break;
        case 'CLASIFICAR': if (!assigned) throw new AppError('Sólo el responsable o administrador puede clasificar', 403); break;
        case 'ESPERAR':
          if (!assigned || own) throw new AppError('Sólo soporte puede solicitar una respuesta', 403);
          if (ticket.estado === 'CERRADO') throw new AppError('El ticket está cerrado', 409);
          estado = 'ESPERANDO_USUARIO'; break;
        case 'CERRAR':
          if (!assigned && !own) throw new AppError('No autorizado para cerrar', 403);
          if (ticket.estado === 'CERRADO') throw new AppError('El ticket ya está cerrado', 409);
          estado = 'CERRADO'; break;
        case 'REABRIR':
          if (!assigned && !own) throw new AppError('No autorizado para reabrir', 403);
          if (ticket.estado !== 'CERRADO') throw new AppError('El ticket ya está abierto', 409);
          estado = 'ABIERTO'; break;
      }
      if (own && ['RESPONDER', 'REABRIR'].includes(input.accion) && responsableId) {
        const assignedUser = await db.usuario.findUnique({ where: { id: responsableId } });
        // A closed ticket can outlive an agent's account/team membership. Put
        // reopened work back on the active desk instead of a dead assignment.
        if (!await staff(assignedUser, db)) { responsableId = null; estado = 'ABIERTO'; }
      }
      const triage = input.accion === 'CLASIFICAR' ? { categoria: input.categoria!, tipo: input.tipo!, prioridad: input.prioridad!, clasificadoAt: new Date() } : {};
      const operatorId = req.user.impersonatedBy?.id || req.user.id;
      const updated = await db.ticketSoporte.update({ where: { id: ticket.id }, data: { estado, responsableId, ...triage, version: { increment: 1 },
        cerradoAt: estado === 'CERRADO' ? ticket.cerradoAt || new Date() : null } });
      if (input.cuerpo) await db.mensajeSoporte.create({ data: { ticketId: ticket.id, autorId: req.user.id, cuerpo: input.cuerpo,
        interno: internal, adjuntos: { create: stored } } });
      await db.eventoSoporte.create({ data: { ticketId: ticket.id, usuarioId: req.user.id, clienteId, huella, accion: input.accion,
        estadoAnterior: ticket.estado, estadoNuevo: estado, responsableAnteriorId: ticket.responsableId,
        responsableNuevoId: responsableId, version: updated.version, interno: input.accion === 'NOTA' || input.accion === 'CLASIFICAR',
        detalle: { ...(req.user.impersonatedBy ? { registradoPorId: operatorId, actuandoPorId: req.user.id } : {}),
          ...(input.accion === 'CLASIFICAR' ? { antes: { categoria: ticket.categoria, tipo: ticket.tipo || null, prioridad: ticket.prioridad || 'NORMAL' }, despues: { categoria: input.categoria!, tipo: input.tipo!, prioridad: input.prioridad! } } : {}),
          ...(input.accion === 'DERIVAR' ? { desde: ticket.responsable?.nombre || 'Sin asignar', hacia: (await db.usuario.findUnique({ where: { id: responsableId! }, select: userSelect }))?.nombre || 'Responsable' } : {}) } } });
      const recipients = internal ? [responsableId].filter((id): id is string => !!id) : [ticket.autorId, responsableId].filter((id): id is string => !!id);
      if (own && !responsableId && !internal) recipients.push(...(await team(db)).map(user => user.id));
      await notices(db, ticket, recipients, req.user.id, input.accion === 'DERIVAR' ? 'Ticket derivado a tu atención' : 'Actualización de soporte');
      return { id: ticket.id, version: updated.version, replay: false };
    });
    committed = !result.replay;
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
  finally { if (!committed && stored.length) await discardSupportFiles(stored); }
}
export async function descargarAdjuntoSoporte(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { ticket, managing } = await access(req);
    const file = await prisma.adjuntoSoporte.findFirst({ where: { id: req.params.fileId,
      mensaje: { ticketId: ticket.id, ...(managing ? {} : { interno: false }) } } });
    if (!file) throw new AppError('Adjunto no encontrado', 404);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type(file.mime);
    res.download(resolveSupportFile(file.storageKey), file.nombre, error => { if (error && !res.headersSent) next(new AppError('El archivo no está disponible', 404)); });
  } catch (error) { next(error); }
}
