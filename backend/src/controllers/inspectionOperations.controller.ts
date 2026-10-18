import type { NextFunction, Response } from 'express';
import { EstadoInspeccion, Prisma, TipoActorInspeccion } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { INSPECTION_ADMIN_ROLES, INSPECTION_TERMINAL_STATES, inspectionPeriod, inspectionScopeForUser, isInspectionStaff, inspectionTypeOf } from '../domain/inspectionOperations';
import { canAccessInspection, CHECKLIST_BY_ACTOR } from './inspeccion.controller';
import { buildDeclaredInspectionSnapshot } from '../services/inspectionDeclaredSnapshot.service';

const querySchema = z.object({
  desde: z.string().optional(), hasta: z.string().optional(),
  fecha: z.enum(['programada', 'creacion', 'campo']).default('programada'),
  estado: z.nativeEnum(EstadoInspeccion).optional(),
  inspectorId: z.string().optional(),
  activas: z.enum(['true', 'false']).default('true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

function assertStaff(req: AuthRequest) {
  if (!isInspectionStaff(req.user)) throw new AppError('Se requiere perfil de inspecciones', 403);
}

export async function operacionesInspecciones(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertStaff(req);
    const input = querySchema.parse(req.query);
    const exporting = req.path.endsWith('/exportar');
    let period: Prisma.DateTimeNullableFilter | undefined;
    try { period = inspectionPeriod(input.desde, input.hasta); }
    catch { throw new AppError('Período inválido: use fechas reales y ordenadas', 400); }
    const dateField = input.fecha === 'creacion' ? 'createdAt' : input.fecha === 'campo' ? 'iniciadaAt' : 'fechaProgramada';
    const where: Prisma.InspeccionWhereInput = { AND: [
      inspectionScopeForUser(req.user),
      ...(period ? [{ [dateField]: period }] : []),
      ...(input.estado ? [{ estado: input.estado }] : []),
      ...(input.inspectorId ? [{ inspectorId: input.inspectorId }] : []),
      ...(input.activas === 'true' ? [{ estado: { notIn: [EstadoInspeccion.BORRADOR, ...INSPECTION_TERMINAL_STATES] } }] : []),
    ] };
    const [items, total, states, sinUbicacion, sinResponsable] = await prisma.$transaction([
      prisma.inspeccion.findMany({ where, skip: exporting ? 0 : (input.page - 1) * input.limit, take: exporting ? 10001 : input.limit,
        orderBy: [{ fechaProgramada: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
        select: { id: true, numero: true, estado: true, tipoActor: true, inspectorId: true, fechaProgramada: true, iniciadaAt: true,
          cerradaCampoAt: true, ubicacion: true, latitud: true, longitud: true, updatedAt: true, createdAt: true, version: true,
          inspector: { select: { id: true, nombre: true, apellido: true } },
          generador: { select: { id: true, razonSocial: true } }, transportista: { select: { id: true, razonSocial: true } }, operador: { select: { id: true, razonSocial: true } },
        },
      }),
      prisma.inspeccion.count({ where }),
      prisma.inspeccion.groupBy({ by: ['estado'], where, orderBy: { estado: 'asc' }, _count: { _all: true } }),
      prisma.inspeccion.count({ where: { AND: [where, { OR: [{ latitud: null }, { longitud: null }] }] } }),
      prisma.inspeccion.count({ where: { AND: [where, { generadorId: null, transportistaId: null, operadorId: null }] } }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    if (exporting && total > 10000) throw new AppError('Ajuste el período: la exportación admite hasta 10.000 legajos', 400);
    res.json({ success: true, data: { items, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit),
      summary: { byState: Object.fromEntries(states.map((row) => [row.estado, typeof row._count === 'object' ? row._count._all || 0 : 0])), sinUbicacion, sinResponsable },
      updatedAt: new Date().toISOString(), fecha: input.fecha,
    } });
  } catch (error) { next(error); }
}

export async function listarInspectores(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertStaff(req);
    const admin = INSPECTION_ADMIN_ROLES.has(req.user.rol);
    const items = await prisma.usuario.findMany({
      where: { activo: true, ...(admin ? { OR: [{ esInspector: true }, { rol: 'ADMIN' }, ...(req.user.rol === 'ADMIN' ? [{ rol: { in: ['ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA'] as const } }] : [{ rol: req.user.rol }])] } : { id: req.user.id }) },
      select: { id: true, nombre: true, apellido: true, rol: true, esInspector: true }, orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    });
    res.json({ success: true, data: items });
  } catch (error) { next(error); }
}

export async function candidatosTerritorialesInspeccion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertStaff(req);
    const inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id } });
    if (!inspection) throw new AppError('Inspección no encontrada', 404);
    if (!canAccessInspection(req.user, inspection)) throw new AppError('No autorizado', 403);
    if (inspection.latitud == null || inspection.longitud == null) throw new AppError('Registre coordenadas del hecho para buscar coincidencias territoriales', 400);
    const lat = inspection.latitud, lng = inspection.longitud;
    const deltaLng = 2 / (111.32 * Math.max(Math.cos(lat * Math.PI / 180), 0.01));
    const where = { latitud: { gte: lat - 2 / 110.57, lte: lat + 2 / 110.57 }, longitud: { gte: lng - deltaLng, lte: lng + deltaLng } };
    const select = { id: true, razonSocial: true, domicilio: true, latitud: true, longitud: true, activo: true } as const;
    const [generadores, transportistas, operadores, sedes] = await Promise.all([
      prisma.generador.findMany({ where, select, take: 101 }),
      prisma.transportista.findMany({ where, select, take: 101 }),
      prisma.operador.findMany({ where, select, take: 101 }),
      prisma.sedeOperador.findMany({ where, take: 101, select: { id: true, nombre: true, domicilio: true, latitud: true, longitud: true, activo: true, operador: { select: { id: true, razonSocial: true } } } }),
    ]);
    const candidates = [
      ...generadores.map((row) => ({ ...row, tipoActor: 'GENERADOR' as const, fuente: 'Domicilio registrado' })),
      ...transportistas.map((row) => ({ ...row, tipoActor: 'TRANSPORTISTA' as const, fuente: 'Base registrada (no posición del vehículo)' })),
      ...operadores.map((row) => ({ ...row, tipoActor: 'OPERADOR' as const, fuente: 'Establecimiento registrado' })),
      ...sedes.map((row) => ({ ...row, id: row.operador.id, razonSocial: row.operador.razonSocial, tipoActor: 'OPERADOR' as const, fuente: `Sede: ${row.nombre}` })),
    ].map((row) => {
      const rad = Math.PI / 180;
      const a = Math.sin(((row.latitud! - lat) * rad) / 2) ** 2 + Math.cos(lat * rad) * Math.cos(row.latitud! * rad) * Math.sin(((row.longitud! - lng) * rad) / 2) ** 2;
      return { id: row.id, tipoActor: row.tipoActor, razonSocial: row.razonSocial, domicilio: row.domicilio, activo: row.activo, fuente: row.fuente, distanciaMetros: Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))) };
    }).filter((row) => row.distanciaMetros <= 2000).sort((a, b) => a.distanciaMetros - b.distanciaMetros);
    res.json({ success: true, data: { items: candidates.slice(0, 20), limitada: candidates.length > 20 || [generadores, transportistas, operadores, sedes].some((rows) => rows.length > 100), radioMetros: 2000 } });
  } catch (error) { next(error); }
}

const organizationSchema = z.object({
  version: z.number().int().positive(),
  inspectorId: z.string().min(1).optional(),
  fechaProgramada: z.string().datetime().nullable().optional(),
  tipoActor: z.nativeEnum(TipoActorInspeccion).optional(), actorId: z.string().min(1).optional(),
  motivo: z.string().trim().min(3).max(1000),
}).strict().refine((v) => Boolean(v.tipoActor) === Boolean(v.actorId), 'Tipo y actor deben indicarse juntos')
  .refine((v) => v.inspectorId !== undefined || v.fechaProgramada !== undefined || Boolean(v.actorId), 'Indique el cambio');

export async function organizarInspeccion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertStaff(req);
    const input = organizationSchema.parse(req.body);
    const current = await prisma.inspeccion.findUnique({ where: { id: req.params.id } });
    if (!current) throw new AppError('Inspección no encontrada', 404);
    if (!canAccessInspection(req.user, current)) throw new AppError('No autorizado', 403);
    if (!['BORRADOR', 'PLANIFICADA', 'EN_CAMPO'].includes(current.estado)) throw new AppError('El cierre de campo debe preservarse; no admite estos cambios', 409);
    if ((input.inspectorId || input.fechaProgramada !== undefined) && !INSPECTION_ADMIN_ROLES.has(req.user.rol)) throw new AppError('La asignación y agenda corresponden a la jefatura', 403);
    if (input.actorId && (current.tipoActor || current.generadorId || current.transportistaId || current.operadorId)) throw new AppError('El legajo ya tiene un sujeto vinculado', 409);
    const inspectionType = inspectionTypeOf(current);
    if (input.tipoActor && ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(inspectionType) && input.tipoActor !== inspectionType) throw new AppError('El sujeto debe corresponder al tipo de inspección del legajo', 400);
    if (input.inspectorId) {
      const assignee = await prisma.usuario.findUnique({ where: { id: input.inspectorId } });
      if (!assignee?.activo || !isInspectionStaff(assignee) || !canAccessInspection(assignee, { inspectorId: assignee.id, tipoActor: input.tipoActor || current.tipoActor })) throw new AppError('Inspector no habilitado para este ámbito', 400);
    }
    await prisma.$transaction(async (tx) => {
      const reserved = await tx.inspeccion.updateMany({ where: { id: current.id, version: input.version, estado: { in: ['BORRADOR', 'PLANIFICADA', 'EN_CAMPO'] } }, data: { version: { increment: 1 } } });
      if (reserved.count !== 1) throw new AppError('El expediente cambió. Actualice antes de organizarlo.', 409);
      const snapshot = input.tipoActor && input.actorId ? await buildDeclaredInspectionSnapshot(tx, input.tipoActor, input.actorId) : null;
      const data: Prisma.InspeccionUpdateInput = {
        ...(input.inspectorId ? { inspector: { connect: { id: input.inspectorId } } } : {}),
        ...(input.fechaProgramada !== undefined ? { fechaProgramada: input.fechaProgramada ? new Date(input.fechaProgramada) : null,
          ...(current.estado !== 'EN_CAMPO' ? { estado: input.fechaProgramada ? 'PLANIFICADA' : 'BORRADOR' } : {}) } : {}),
        ...(snapshot && input.tipoActor && input.actorId ? {
          tipoActor: input.tipoActor, declaradoSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          [input.tipoActor === 'GENERADOR' ? 'generador' : input.tipoActor === 'TRANSPORTISTA' ? 'transportista' : 'operador']: { connect: { id: input.actorId } },
          comparaciones: { create: snapshot.fields },
          ...(inspectionType === 'PETROLEO' || inspectionType === 'AIRE' ? {} : { items: { createMany: { data: CHECKLIST_BY_ACTOR[input.tipoActor].map((row) => ({ ...row, obligatorio: row.obligatorio ?? true })), skipDuplicates: true } } }),
        } : {}),
      };
      await tx.inspeccion.update({ where: { id: current.id }, data });
      await tx.eventoInspeccion.create({ data: { inspeccionId: current.id, usuarioId: req.user.id, tipo: 'ORGANIZACION_ACTUALIZADA', titulo: snapshot ? 'Sujeto vinculado por el inspector' : 'Asignación o agenda actualizada', detalle: input.motivo,
        metadata: { inspectorAnterior: current.inspectorId, inspectorNuevo: input.inspectorId || current.inspectorId, fechaAnterior: current.fechaProgramada?.toISOString() || null, fechaNueva: input.fechaProgramada === undefined ? current.fechaProgramada?.toISOString() || null : input.fechaProgramada, actorVinculado: input.actorId || null } } });
      if (input.inspectorId || input.fechaProgramada !== undefined) await tx.notificacion.create({ data: { usuarioId: input.inspectorId || current.inspectorId, tipo: 'INFO_GENERAL', titulo: `Agenda de inspección · ${current.numero}`, mensaje: 'La asignación o fecha de una inspección cambió. Revise el expediente.', datos: JSON.stringify({ inspeccionId: current.id }) } });
    });
    res.json({ success: true });
  } catch (error) { next(error); }
}
