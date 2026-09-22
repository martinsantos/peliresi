import fs from 'fs';
import type { NextFunction, Response } from 'express';
import {
  EstadoInspeccion,
  Prisma,
  ResultadoComparacionInspeccion,
  ResultadoItemInspeccion,
  TipoActorInspeccion,
  TipoEvidenciaInspeccion,
} from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import type { AuthRequest } from '../middlewares/auth.middleware';
import {
  persistInspectionEvidence,
  removeInspectionEvidence,
  resolveInspectionEvidence,
} from '../services/inspectionEvidence.service';
import {
  buildDeclaredInspectionSnapshot,
  ensureInspectionDeclaredComparisons,
} from '../services/inspectionDeclaredSnapshot.service';
import { streamInspectionActPdf } from '../services/inspectionActPdf.service';

type ChecklistDefinition = { codigo: string; categoria: string; etiqueta: string; orden: number; obligatorio?: boolean };

const COMMON_CHECKLIST: ChecklistDefinition[] = [
  { codigo: 'HAB-01', categoria: 'Habilitacion', etiqueta: 'Cuenta con habilitacion vigente', orden: 10 },
  { codigo: 'HAB-02', categoria: 'Habilitacion', etiqueta: 'La actividad desarrollada coincide con la autorizada', orden: 20 },
  { codigo: 'HAB-03', categoria: 'Habilitacion', etiqueta: 'Rotulos y carteleria reglamentaria visibles', orden: 30 },
  { codigo: 'DOC-01', categoria: 'Documentacion', etiqueta: 'Exhibe documentacion regulatoria respaldatoria', orden: 40 },
  { codigo: 'DOC-02', categoria: 'Documentacion', etiqueta: 'Los registros se encuentran completos y actualizados', orden: 50 },
  { codigo: 'SEG-01', categoria: 'Seguridad', etiqueta: 'Elementos de proteccion personal disponibles y en uso', orden: 60 },
  { codigo: 'SEG-02', categoria: 'Seguridad', etiqueta: 'Senalizacion y elementos de emergencia operativos', orden: 70 },
  { codigo: 'TRZ-01', categoria: 'Trazabilidad', etiqueta: 'La documentacion coincide con los registros de SITREP', orden: 80 },
];

export const CHECKLIST_BY_ACTOR: Record<TipoActorInspeccion, ChecklistDefinition[]> = {
  GENERADOR: [
    ...COMMON_CHECKLIST,
    { codigo: 'GEN-01', categoria: 'Gestion de residuos', etiqueta: 'Residuos identificados y segregados por corriente', orden: 90 },
    { codigo: 'GEN-02', categoria: 'Gestion de residuos', etiqueta: 'Almacenamiento transitorio en condiciones adecuadas', orden: 100 },
    { codigo: 'GEN-03', categoria: 'Trazabilidad', etiqueta: 'Manifiestos emitidos para los retiros verificados', orden: 110 },
  ],
  TRANSPORTISTA: [
    ...COMMON_CHECKLIST,
    { codigo: 'TRA-01', categoria: 'Flota', etiqueta: 'Vehiculos y habilitaciones coinciden con SITREP', orden: 90 },
    { codigo: 'TRA-02', categoria: 'Flota', etiqueta: 'Conductores poseen licencias y autorizaciones vigentes', orden: 100 },
    { codigo: 'TRA-03', categoria: 'Seguridad', etiqueta: 'Carga, estiba y elementos de contingencia son adecuados', orden: 110 },
  ],
  OPERADOR: [
    ...COMMON_CHECKLIST,
    { codigo: 'OPE-01', categoria: 'Operacion', etiqueta: 'Corrientes recibidas coinciden con las autorizadas', orden: 90 },
    { codigo: 'OPE-02', categoria: 'Operacion', etiqueta: 'Tecnologias y tratamientos aplicados estan habilitados', orden: 100 },
    { codigo: 'OPE-03', categoria: 'Trazabilidad', etiqueta: 'Pesajes y certificados de disposicion son consistentes', orden: 110 },
  ],
};

const inspectionInclude = {
  inspector: { select: { id: true, nombre: true, apellido: true, email: true, esInspector: true } },
  generador: { select: { id: true, razonSocial: true, cuit: true, domicilio: true, activo: true } },
  transportista: { select: { id: true, razonSocial: true, cuit: true, domicilio: true, activo: true } },
  operador: { select: { id: true, razonSocial: true, cuit: true, domicilio: true, activo: true } },
  items: {
    orderBy: [{ categoria: 'asc' as const }, { orden: 'asc' as const }],
    include: { evidencias: { orderBy: { createdAt: 'asc' as const }, include: { anuladaPor: { select: { id: true, nombre: true, apellido: true } } } } },
  },
  comparaciones: {
    orderBy: [{ categoria: 'asc' as const }, { orden: 'asc' as const }],
    include: { evidencias: { orderBy: { createdAt: 'asc' as const }, include: { anuladaPor: { select: { id: true, nombre: true, apellido: true } } } } },
  },
  evidencias: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      creadoPor: { select: { id: true, nombre: true, apellido: true } },
      anuladaPor: { select: { id: true, nombre: true, apellido: true } },
    },
  },
  eventos: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      usuario: { select: { id: true, nombre: true, apellido: true } },
      adjuntos: { orderBy: { createdAt: 'asc' as const }, include: { anuladaPor: { select: { id: true, nombre: true, apellido: true } } } },
    },
  },
} satisfies Prisma.InspeccionInclude;

const createSchema = z.object({
  tipoActor: z.nativeEnum(TipoActorInspeccion),
  actorId: z.string().min(1),
  inspectorId: z.string().min(1).optional(),
  numeroActa: z.string().trim().max(80).optional().nullable(),
  ubicacion: z.string().trim().max(300).optional().nullable(),
  fechaProgramada: z.string().datetime().optional().nullable(),
  observaciones: z.string().trim().max(10_000).optional().nullable(),
});

const updateSchema = z.object({
  version: z.number().int().positive(),
  numeroActa: z.string().trim().max(80).optional().nullable(),
  ubicacion: z.string().trim().max(300).optional().nullable(),
  latitud: z.number().min(-90).max(90).optional().nullable(),
  longitud: z.number().min(-180).max(180).optional().nullable(),
  fechaProgramada: z.string().datetime().optional().nullable(),
  plazoRespuestaAt: z.string().datetime().optional().nullable(),
  observaciones: z.string().trim().max(10_000).optional().nullable(),
});

const itemSchema = z.object({
  id: z.string().min(1),
  resultado: z.nativeEnum(ResultadoItemInspeccion),
  observacion: z.string().trim().max(2_000).optional().nullable(),
});

const comparisonSchema = z.object({
  id: z.string().min(1),
  resultado: z.nativeEnum(ResultadoComparacionInspeccion),
  valorObservado: z.string().trim().max(5_000).optional().nullable(),
  observacion: z.string().trim().max(2_000).optional().nullable(),
});

const eventSchema = z.object({
  tipo: z.enum(['COMENTARIO_INTERNO', 'SOLICITUD_CORRECCION', 'RESPUESTA_ACTOR', 'RESOLUCION', 'NOTIFICACION_PREPARADA']),
  titulo: z.string().trim().min(3).max(180),
  detalle: z.string().trim().min(1).max(10_000),
  visibleActor: z.boolean().default(false),
  destinatario: z.string().trim().email().max(320).optional().nullable(),
});

const transitionSchema = z.object({
  estado: z.nativeEnum(EstadoInspeccion),
  version: z.number().int().positive(),
  detalle: z.string().trim().max(5_000).optional().nullable(),
  plazoRespuestaAt: z.string().datetime().optional().nullable(),
});

const annulEvidenceSchema = z.object({
  version: z.number().int().positive(),
  motivo: z.string().trim().min(10, 'Explique el motivo de la anulación').max(1_000),
});

const ADMIN_ROLES = new Set(['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR']);
const EDITABLE_STATES = new Set<EstadoInspeccion>(['BORRADOR', 'PLANIFICADA', 'EN_CAMPO']);
const INSPECTOR_TRANSITIONS: Partial<Record<EstadoInspeccion, EstadoInspeccion[]>> = {
  BORRADOR: ['PLANIFICADA', 'EN_CAMPO', 'CANCELADA'],
  PLANIFICADA: ['EN_CAMPO', 'CANCELADA'],
  EN_CAMPO: ['EN_REVISION'],
};
const ADMIN_TRANSITIONS: Partial<Record<EstadoInspeccion, EstadoInspeccion[]>> = {
  ...INSPECTOR_TRANSITIONS,
  EN_REVISION: ['EN_CAMPO', 'NOTIFICADA', 'CANCELADA'],
  NOTIFICADA: ['EN_DESCARGO', 'CERRADA_CONFORME', 'DERIVADA_LEGALES'],
  EN_DESCARGO: ['REQUIERE_SUBSANACION', 'CERRADA_CONFORME', 'DERIVADA_LEGALES'],
  REQUIERE_SUBSANACION: ['EN_DESCARGO', 'DERIVADA_LEGALES'],
  DERIVADA_LEGALES: ['EN_TRAMITE_LEGAL'],
  EN_TRAMITE_LEGAL: ['DERIVADA_ATM', 'FINALIZADA'],
  DERIVADA_ATM: ['FINALIZADA'],
};

export function canTransitionInspection(current: EstadoInspeccion, next: EstadoInspeccion, admin: boolean): boolean {
  return Boolean((admin ? ADMIN_TRANSITIONS : INSPECTOR_TRANSITIONS)[current]?.includes(next));
}

export function isChecklistReadyForReview(items: Array<{ obligatorio: boolean; resultado: ResultadoItemInspeccion }>): boolean {
  return items.every((item) => !item.obligatorio || item.resultado !== 'PENDIENTE');
}

export function isComparisonReadyForReview(rows: Array<{ resultado: ResultadoComparacionInspeccion }>): boolean {
  return rows.length > 0 && rows.every((row) => row.resultado !== 'PENDIENTE');
}

export function hasSingleEvidenceTarget(targets: Array<string | null | undefined>): boolean {
  return targets.filter(Boolean).length <= 1;
}

function isAuthorizedAdmin(user: any): boolean {
  return ADMIN_ROLES.has(String(user?.rol));
}

function isInspectionStaff(user: any): boolean {
  return Boolean(user?.esInspector) || isAuthorizedAdmin(user);
}

function isSectorReviewer(user: any, tipoActor: TipoActorInspeccion): boolean {
  if (!isAuthorizedAdmin(user)) return false;
  return user.rol === 'ADMIN' || user.rol === `ADMIN_${tipoActor}`;
}

function assertInspectionStaff(req: AuthRequest): void {
  if (!isInspectionStaff(req.user)) throw new AppError('Se requiere perfil inspector o administrador autorizado', 403);
}

function assertCanEdit(req: AuthRequest, inspection: { inspectorId: string; estado: EstadoInspeccion }): void {
  assertInspectionStaff(req);
  if (!isAuthorizedAdmin(req.user) && inspection.inspectorId !== req.user.id) {
    throw new AppError('Solo el inspector asignado puede modificar esta inspeccion', 403);
  }
  if (!EDITABLE_STATES.has(inspection.estado)) throw new AppError('La inspeccion ya no admite cambios de campo', 409);
}

async function actorExists(tipoActor: TipoActorInspeccion, actorId: string): Promise<boolean> {
  if (tipoActor === 'GENERADOR') return Boolean(await prisma.generador.findUnique({ where: { id: actorId }, select: { id: true } }));
  if (tipoActor === 'TRANSPORTISTA') return Boolean(await prisma.transportista.findUnique({ where: { id: actorId }, select: { id: true } }));
  return Boolean(await prisma.operador.findUnique({ where: { id: actorId }, select: { id: true } }));
}

function actorForeignKey(tipoActor: TipoActorInspeccion, actorId: string): {
  generadorId?: string;
  transportistaId?: string;
  operadorId?: string;
} {
  if (tipoActor === 'GENERADOR') return { generadorId: actorId };
  if (tipoActor === 'TRANSPORTISTA') return { transportistaId: actorId };
  return { operadorId: actorId };
}

async function nextInspectionNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const from = new Date(`${year}-01-01T00:00:00.000Z`);
  // Serialize only the short number-allocation section across PM2 instances.
  // This keeps the human-readable sequence unique under concurrent creation.
  // pg_advisory_xact_lock returns PostgreSQL `void`, which Prisma cannot
  // deserialize (P2010). Cast it to a supported scalar while preserving the
  // transaction-scoped lock used by both PM2 workers.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(836271)::text AS "lock"`;
  const count = await tx.inspeccion.count({ where: { createdAt: { gte: from } } });
  return `I-${year}-${String(count + 1).padStart(6, '0')}`;
}

export async function listarInspecciones(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertInspectionStaff(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const estado = req.query.estado && Object.values(EstadoInspeccion).includes(req.query.estado as EstadoInspeccion)
      ? req.query.estado as EstadoInspeccion : undefined;
    const tipoActor = req.query.tipoActor && Object.values(TipoActorInspeccion).includes(req.query.tipoActor as TipoActorInspeccion)
      ? req.query.tipoActor as TipoActorInspeccion : undefined;
    const actorId = String(req.query.actorId || '').trim();
    const search = String(req.query.search || '').trim();
    const baseWhere: Prisma.InspeccionWhereInput = {
      ...(tipoActor ? { tipoActor } : {}),
      ...(actorId && tipoActor === 'GENERADOR' ? { generadorId: actorId } : {}),
      ...(actorId && tipoActor === 'TRANSPORTISTA' ? { transportistaId: actorId } : {}),
      ...(actorId && tipoActor === 'OPERADOR' ? { operadorId: actorId } : {}),
      ...(!isAuthorizedAdmin(req.user) ? { inspectorId: req.user.id } : {}),
      ...(search ? {
        OR: [
          { numero: { contains: search, mode: 'insensitive' } },
          { numeroActa: { contains: search, mode: 'insensitive' } },
          { generador: { razonSocial: { contains: search, mode: 'insensitive' } } },
          { transportista: { razonSocial: { contains: search, mode: 'insensitive' } } },
          { operador: { razonSocial: { contains: search, mode: 'insensitive' } } },
        ],
      } : {}),
    };
    const where: Prisma.InspeccionWhereInput = { ...baseWhere, ...(estado ? { estado } : {}) };
    const [items, total, groupedStates, openDeadlines] = await prisma.$transaction([
      prisma.inspeccion.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          inspector: { select: { id: true, nombre: true, apellido: true } },
          generador: { select: { id: true, razonSocial: true, cuit: true } },
          transportista: { select: { id: true, razonSocial: true, cuit: true } },
          operador: { select: { id: true, razonSocial: true, cuit: true } },
          _count: { select: { items: true, evidencias: true, eventos: true } },
        },
      }),
      prisma.inspeccion.count({ where }),
      prisma.inspeccion.groupBy({ by: ['estado'], where: baseWhere, orderBy: { estado: 'asc' }, _count: { estado: true } }),
      prisma.inspeccion.count({
        where: {
          ...baseWhere,
          plazoRespuestaAt: { gt: new Date() },
          estado: { in: ['NOTIFICADA', 'EN_DESCARGO', 'REQUIERE_SUBSANACION'] },
        },
      }),
    ]);
    res.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        summary: {
          byState: Object.fromEntries(groupedStates.map((row) => [row.estado, typeof row._count === 'object' && row._count ? row._count.estado || 0 : 0])),
          openDeadlines,
        },
      },
    });
  } catch (error) { next(error); }
}

export async function obtenerInspeccion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertInspectionStaff(req);
    let inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, include: inspectionInclude });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    if (!isAuthorizedAdmin(req.user) && inspection.inspectorId !== req.user.id) throw new AppError('No autorizado para esta inspeccion', 403);
    if (!inspection.declaradoSnapshot || inspection.comparaciones.length === 0 || inspection.comparaciones.some((row) => row.codigo === 'RES-CORRIENTES' || row.codigo === 'RES-CORRIENTES-RESUMEN')) {
      await ensureInspectionDeclaredComparisons(prisma, inspection);
      inspection = await prisma.inspeccion.findUniqueOrThrow({ where: { id: req.params.id }, include: inspectionInclude });
    }
    res.json({ success: true, data: inspection });
  } catch (error) { next(error); }
}

export async function crearInspeccion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertInspectionStaff(req);
    const input = createSchema.parse(req.body);
    if (!(await actorExists(input.tipoActor, input.actorId))) throw new AppError('El actor inspeccionado no existe', 404);
    const inspectorId = input.inspectorId || req.user.id;
    if (!isAuthorizedAdmin(req.user) && inspectorId !== req.user.id) throw new AppError('Un inspector solo puede asignarse inspecciones a si mismo', 403);
    const inspector = await prisma.usuario.findUnique({ where: { id: inspectorId }, select: { id: true, activo: true, esInspector: true } });
    if (!inspector?.activo || (!inspector.esInspector && !isAuthorizedAdmin(req.user))) throw new AppError('El usuario seleccionado no tiene perfil inspector activo', 400);

    const created = await prisma.$transaction(async (tx) => {
      const numero = await nextInspectionNumber(tx);
      const snapshot = await buildDeclaredInspectionSnapshot(tx, input.tipoActor, input.actorId);
      const inspection = await tx.inspeccion.create({
        data: {
          numero,
          tipoActor: input.tipoActor,
          inspectorId,
          numeroActa: input.numeroActa || null,
          ubicacion: input.ubicacion || null,
          fechaProgramada: input.fechaProgramada ? new Date(input.fechaProgramada) : null,
          observaciones: input.observaciones || null,
          declaradoSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          ...actorForeignKey(input.tipoActor, input.actorId),
          items: {
            create: CHECKLIST_BY_ACTOR[input.tipoActor].map((item) => ({
              ...item,
              obligatorio: item.obligatorio ?? true,
            })),
          },
          comparaciones: {
            create: snapshot.fields.map((row) => ({ ...row })),
          },
        },
      });
      await tx.eventoInspeccion.create({
        data: { inspeccionId: inspection.id, usuarioId: req.user.id, tipo: 'CREADA', titulo: 'Inspeccion creada' },
      });
      return inspection;
    });
    const full = await prisma.inspeccion.findUniqueOrThrow({ where: { id: created.id }, include: inspectionInclude });
    res.status(201).json({ success: true, data: full });
  } catch (error) { next(error); }
}

export async function actualizarComparaciones(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = z.object({ version: z.number().int().positive(), comparaciones: z.array(comparisonSchema).min(1).max(100) }).parse(req.body);
    const inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, select: { inspectorId: true, estado: true, version: true } });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    assertCanEdit(req, inspection);
    if (inspection.version !== body.version) throw new AppError('La inspeccion fue modificada en otro dispositivo. Actualice antes de continuar.', 409);

    await prisma.$transaction(async (tx) => {
      for (const comparison of body.comparaciones) {
        const updated = await tx.comparacionInspeccion.updateMany({
          where: { id: comparison.id, inspeccionId: req.params.id },
          data: {
            resultado: comparison.resultado,
            valorObservado: comparison.valorObservado || null,
            observacion: comparison.observacion || null,
            verificadoPorId: comparison.resultado === 'PENDIENTE' ? null : req.user.id,
            verificadoAt: comparison.resultado === 'PENDIENTE' ? null : new Date(),
          },
        });
        if (updated.count !== 1) throw new AppError('Dato comparativo inválido', 400);
      }
      await tx.inspeccion.update({ where: { id: req.params.id }, data: { version: { increment: 1 } } });
      await tx.eventoInspeccion.create({
        data: { inspeccionId: req.params.id, usuarioId: req.user.id, tipo: 'COMPARACION_ACTUALIZADA', titulo: 'Datos declarados contrastados en campo' },
      });
    });
    const full = await prisma.inspeccion.findUniqueOrThrow({ where: { id: req.params.id }, include: inspectionInclude });
    res.json({ success: true, data: full });
  } catch (error) { next(error); }
}

export async function agregarEventoInspeccion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = eventSchema.parse(req.body);
    const inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, select: { inspectorId: true, tipoActor: true } });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    assertInspectionStaff(req);
    if (!isAuthorizedAdmin(req.user) && inspection.inspectorId !== req.user.id) throw new AppError('No autorizado para este expediente', 403);
    if (input.tipo === 'RESPUESTA_ACTOR' && !isAuthorizedAdmin(req.user)) throw new AppError('La respuesta del actor debe registrarse por un administrador', 403);

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.eventoInspeccion.create({
        data: {
          inspeccionId: req.params.id,
          usuarioId: req.user.id,
          tipo: input.tipo,
          titulo: input.titulo,
          detalle: input.detalle,
          visibleActor: input.visibleActor,
          canal: input.tipo === 'NOTIFICACION_PREPARADA' ? 'EMAIL' : input.tipo === 'RESPUESTA_ACTOR' ? 'PORTAL_ACTOR' : 'SISTEMA',
          estadoEntrega: input.tipo === 'NOTIFICACION_PREPARADA' ? 'NO_ENVIADO' : null,
          destinatario: input.destinatario || null,
          metadata: input.tipo === 'NOTIFICACION_PREPARADA' ? { dispatchDisabled: true } : undefined,
        },
      });
      await tx.inspeccion.update({ where: { id: req.params.id }, data: { version: { increment: 1 } } });
      return created;
    });
    res.status(201).json({ success: true, data: event, message: input.tipo === 'NOTIFICACION_PREPARADA' ? 'Notificacion registrada sin enviar correo externo.' : undefined });
  } catch (error) { next(error); }
}

export async function actualizarInspeccion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = updateSchema.parse(req.body);
    const inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, select: { inspectorId: true, estado: true, version: true } });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    assertCanEdit(req, inspection);
    const { version, ...fields } = input;
    const result = await prisma.inspeccion.updateMany({
      where: { id: req.params.id, version },
      data: {
        ...fields,
        fechaProgramada: fields.fechaProgramada === undefined ? undefined : fields.fechaProgramada ? new Date(fields.fechaProgramada) : null,
        plazoRespuestaAt: fields.plazoRespuestaAt === undefined ? undefined : fields.plazoRespuestaAt ? new Date(fields.plazoRespuestaAt) : null,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new AppError('La inspeccion fue modificada en otro dispositivo. Actualice antes de continuar.', 409);
    const full = await prisma.inspeccion.findUniqueOrThrow({ where: { id: req.params.id }, include: inspectionInclude });
    res.json({ success: true, data: full });
  } catch (error) { next(error); }
}

export async function actualizarItems(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = z.object({ version: z.number().int().positive(), items: z.array(itemSchema).min(1).max(100) }).parse(req.body);
    const inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, select: { inspectorId: true, estado: true, version: true } });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    assertCanEdit(req, inspection);
    if (inspection.version !== body.version) throw new AppError('La inspeccion fue modificada en otro dispositivo. Actualice antes de continuar.', 409);

    await prisma.$transaction(async (tx) => {
      for (const item of body.items) {
        const updated = await tx.itemInspeccion.updateMany({
          where: { id: item.id, inspeccionId: req.params.id },
          data: { resultado: item.resultado, observacion: item.observacion || null },
        });
        if (updated.count !== 1) throw new AppError('Item de checklist invalido', 400);
      }
      await tx.inspeccion.update({ where: { id: req.params.id }, data: { version: { increment: 1 } } });
      await tx.eventoInspeccion.create({
        data: { inspeccionId: req.params.id, usuarioId: req.user.id, tipo: 'CHECKLIST_ACTUALIZADO', titulo: 'Checklist actualizado' },
      });
    });
    const full = await prisma.inspeccion.findUniqueOrThrow({ where: { id: req.params.id }, include: inspectionInclude });
    res.json({ success: true, data: full });
  } catch (error) { next(error); }
}

export async function cambiarEstadoInspeccion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = transitionSchema.parse(req.body);
    const inspection = await prisma.inspeccion.findUnique({
      where: { id: req.params.id },
      include: {
        items: { select: { obligatorio: true, resultado: true } },
        comparaciones: { select: { resultado: true } },
      },
    });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    assertInspectionStaff(req);
    if (inspection.estado === input.estado) {
      const current = await prisma.inspeccion.findUniqueOrThrow({ where: { id: inspection.id }, include: inspectionInclude });
      return res.json({ success: true, data: current });
    }
    if (inspection.version !== input.version) throw new AppError('La inspeccion fue modificada en otro dispositivo. Actualice antes de continuar.', 409);
    const admin = isSectorReviewer(req.user, inspection.tipoActor);
    const assignedInspector = inspection.inspectorId === req.user.id;
    if (!admin && !assignedInspector) throw new AppError('No autorizado para cambiar el estado de esta inspeccion', 403);
    if (!canTransitionInspection(inspection.estado, input.estado, admin)) throw new AppError(`Transicion ${inspection.estado} a ${input.estado} no permitida`, 409);
    if (input.estado === 'EN_REVISION' && !isChecklistReadyForReview(inspection.items)) {
      throw new AppError('Complete todos los items obligatorios antes de enviar a revision', 400);
    }
    if (input.estado === 'EN_REVISION' && !isComparisonReadyForReview(inspection.comparaciones)) {
      throw new AppError('Complete el contraste de todos los datos declarados antes de enviar a revision', 400);
    }
    if (input.estado === 'NOTIFICADA' && !input.plazoRespuestaAt) throw new AppError('Defina el plazo de respuesta antes de notificar', 400);

    await prisma.$transaction(async (tx) => {
      const updated = await tx.inspeccion.updateMany({
        where: { id: inspection.id, version: input.version },
        data: {
          estado: input.estado,
          version: { increment: 1 },
          iniciadaAt: input.estado === 'EN_CAMPO' && !inspection.iniciadaAt ? new Date() : undefined,
          cerradaCampoAt: input.estado === 'EN_REVISION' ? new Date() : undefined,
          plazoRespuestaAt: input.plazoRespuestaAt ? new Date(input.plazoRespuestaAt) : undefined,
        },
      });
      if (updated.count !== 1) throw new AppError('La inspeccion cambio mientras se procesaba la accion', 409);
      await tx.eventoInspeccion.create({
        data: {
          inspeccionId: inspection.id,
          usuarioId: req.user.id,
          tipo: 'CAMBIO_ESTADO',
          titulo: `Estado actualizado a ${input.estado}`,
          detalle: input.detalle || null,
          estadoDesde: inspection.estado,
          estadoHasta: input.estado,
          visibleActor: ['NOTIFICADA', 'EN_DESCARGO', 'REQUIERE_SUBSANACION', 'CERRADA_CONFORME', 'DERIVADA_LEGALES', 'FINALIZADA'].includes(input.estado),
        },
      });
    });
    const full = await prisma.inspeccion.findUniqueOrThrow({ where: { id: inspection.id }, include: inspectionInclude });
    res.json({ success: true, data: full, message: 'Estado actualizado. No se envio ninguna comunicacion externa.' });
  } catch (error) { next(error); }
}

export async function subirEvidencia(req: AuthRequest, res: Response, next: NextFunction) {
  let storedKey: string | null = null;
  try {
    if (!req.file) throw new AppError('Seleccione un archivo de evidencia', 400);
    const inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, select: { inspectorId: true, estado: true } });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    const eventoId = req.body.eventoId ? String(req.body.eventoId) : null;
    const comparacionId = req.body.comparacionId ? String(req.body.comparacionId) : null;
    const itemId = req.body.itemId ? String(req.body.itemId) : null;
    const clienteId = req.body.clienteId ? String(req.body.clienteId).trim() : null;
    if (clienteId && !/^[a-zA-Z0-9_-]{8,128}$/.test(clienteId)) {
      throw new AppError('Identificador de captura inválido', 400);
    }
    if (!hasSingleEvidenceTarget([eventoId, comparacionId, itemId])) {
      throw new AppError('La evidencia debe vincularse a un único comentario, comparación o evento', 400);
    }
    let itemTarget: { codigo: string; etiqueta: string } | null = null;
    if (eventoId) {
      assertInspectionStaff(req);
      if (!isAuthorizedAdmin(req.user) && inspection.inspectorId !== req.user.id) throw new AppError('No autorizado para adjuntar al expediente', 403);
      const eventExists = await prisma.eventoInspeccion.count({ where: { id: eventoId, inspeccionId: req.params.id } });
      if (!eventExists) throw new AppError('Evento de trazabilidad inválido', 400);
    } else {
      assertCanEdit(req, inspection);
    }
    if (comparacionId) {
      const comparisonExists = await prisma.comparacionInspeccion.count({ where: { id: comparacionId, inspeccionId: req.params.id } });
      if (!comparisonExists) throw new AppError('Dato comparativo inválido', 400);
    }
    if (itemId) {
      itemTarget = await prisma.itemInspeccion.findFirst({
        where: { id: itemId, inspeccionId: req.params.id },
        select: { codigo: true, etiqueta: true },
      });
      if (!itemTarget) throw new AppError('Ítem de checklist inválido', 400);
    }
    if (clienteId) {
      const retried = await prisma.evidenciaInspeccion.findFirst({ where: { inspeccionId: req.params.id, clienteId } });
      if (retried) {
        if ((itemId && retried.itemId !== itemId) || (comparacionId && retried.comparacionId !== comparacionId) || (eventoId && retried.eventoId !== eventoId)) {
          throw new AppError('La captura ya fue vinculada a otro punto del expediente', 409);
        }
        return res.json({ success: true, data: retried, message: 'La captura ya estaba sincronizada' });
      }
    }
    const stored = await persistInspectionEvidence(req.file, req.params.id);
    storedKey = stored.storageKey;
    const requestedType = String(req.body.tipo || '').toUpperCase();
    const inferredType: TipoEvidenciaInspeccion = stored.mimeType.startsWith('image/')
      ? 'FOTO' : stored.mimeType.startsWith('audio/') ? 'AUDIO' : 'DOCUMENTO';
    const tipo = Object.values(TipoEvidenciaInspeccion).includes(requestedType as TipoEvidenciaInspeccion)
      ? requestedType as TipoEvidenciaInspeccion : inferredType;
    if ((tipo === 'FOTO' && !stored.mimeType.startsWith('image/')) || (tipo === 'AUDIO' && !stored.mimeType.startsWith('audio/'))) {
      throw new AppError('El tipo declarado no coincide con el contenido del archivo', 400);
    }
    if (itemId && !stored.mimeType.startsWith('image/')) {
      throw new AppError('Los comentarios del checklist admiten imágenes JPG, PNG o WEBP', 400);
    }
    const clientHash = req.body.clienteSha256 ? String(req.body.clienteSha256).toLowerCase() : null;
    if (clientHash && (!/^[a-f0-9]{64}$/.test(clientHash) || clientHash !== stored.sha256)) {
      throw new AppError('La evidencia cambió durante la sincronización', 400);
    }
    const requestedCaptureDate = req.body.capturadaAt ? new Date(String(req.body.capturadaAt)) : null;
    if (requestedCaptureDate && Number.isNaN(requestedCaptureDate.getTime())) {
      throw new AppError('Fecha de captura inválida', 400);
    }
    const duplicate = await prisma.evidenciaInspeccion.findFirst({ where: { inspeccionId: req.params.id, sha256: stored.sha256 } });
    if (duplicate) {
      await removeInspectionEvidence(stored.storageKey);
      storedKey = null;
      if (itemId && !duplicate.itemId && !duplicate.comparacionId && !duplicate.eventoId) {
        const linked = await prisma.$transaction(async (tx) => {
          const updated = await tx.evidenciaInspeccion.update({
            where: { id: duplicate.id },
            data: {
              itemId,
              descripcion: req.body.descripcion ? String(req.body.descripcion).slice(0, 2_000) : duplicate.descripcion,
            },
          });
          await tx.eventoInspeccion.create({
            data: {
              inspeccionId: req.params.id,
              usuarioId: req.user.id,
              tipo: 'EVIDENCIA_VINCULADA',
              titulo: `Evidencia vinculada a ${itemTarget!.codigo}`,
              detalle: `${duplicate.nombreOriginal} · ${itemTarget!.etiqueta}`,
            },
          });
          await tx.inspeccion.update({ where: { id: req.params.id }, data: { version: { increment: 1 } } });
          return updated;
        });
        return res.json({ success: true, data: linked, message: 'La evidencia existente quedó vinculada al ítem' });
      }
      if ((itemId && duplicate.itemId !== itemId) || (comparacionId && duplicate.comparacionId !== comparacionId) || (eventoId && duplicate.eventoId !== eventoId)) {
        throw new AppError('La misma evidencia ya está vinculada a otro punto del expediente', 409);
      }
      return res.json({ success: true, data: duplicate, message: 'La evidencia ya estaba incorporada' });
    }
    const evidence = await prisma.$transaction(async (tx) => {
      const created = await tx.evidenciaInspeccion.create({
        data: {
          inspeccionId: req.params.id,
          clienteId,
          creadoPorId: req.user.id,
          comparacionId,
          eventoId,
          itemId,
          tipo,
          nombreOriginal: req.file!.originalname,
          storageKey: stored.storageKey,
          mimeDetectado: stored.mimeType,
          bytes: stored.bytes,
          sha256: stored.sha256,
          descripcion: req.body.descripcion ? String(req.body.descripcion).slice(0, 2_000) : null,
          transcripcion: req.body.transcripcion ? String(req.body.transcripcion).slice(0, 20_000) : null,
          capturadaAt: requestedCaptureDate || new Date(),
          latitud: req.body.latitud ? Number(req.body.latitud) : null,
          longitud: req.body.longitud ? Number(req.body.longitud) : null,
        },
      });
      await tx.eventoInspeccion.create({
        data: {
          inspeccionId: req.params.id,
          usuarioId: req.user.id,
          tipo: 'EVIDENCIA_AGREGADA',
          titulo: itemTarget ? `Evidencia vinculada a ${itemTarget.codigo}` : 'Evidencia agregada',
          detalle: itemTarget ? `${req.file!.originalname} · ${itemTarget.etiqueta}` : req.file!.originalname,
        },
      });
      await tx.inspeccion.update({ where: { id: req.params.id }, data: { version: { increment: 1 } } });
      return created;
    });
    storedKey = null;
    res.status(201).json({ success: true, data: evidence });
  } catch (error) {
    if (storedKey) await removeInspectionEvidence(storedKey).catch(() => undefined);
    next(error);
  }
}

export async function anularEvidencia(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = annulEvidenceSchema.parse(req.body);
    const inspection = await prisma.inspeccion.findUnique({
      where: { id: req.params.id },
      select: { id: true, inspectorId: true, estado: true, version: true },
    });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    assertCanEdit(req, inspection);
    if (inspection.version !== input.version) {
      throw new AppError('La inspeccion fue modificada en otro dispositivo. Actualice antes de continuar.', 409);
    }

    const evidence = await prisma.evidenciaInspeccion.findFirst({
      where: { id: req.params.evidenciaId, inspeccionId: inspection.id },
      select: { id: true, nombreOriginal: true, anuladaAt: true, motivoAnulacion: true },
    });
    if (!evidence) throw new AppError('Evidencia no encontrada', 404);
    if (evidence.anuladaAt) {
      const current = await prisma.evidenciaInspeccion.findUniqueOrThrow({
        where: { id: evidence.id },
        include: {
          creadoPor: { select: { id: true, nombre: true, apellido: true } },
          anuladaPor: { select: { id: true, nombre: true, apellido: true } },
        },
      });
      return res.json({ success: true, data: current, message: 'La evidencia ya estaba anulada y permanece preservada.' });
    }

    await prisma.$transaction(async (tx) => {
      const inspectionUpdate = await tx.inspeccion.updateMany({
        where: { id: inspection.id, version: input.version },
        data: { version: { increment: 1 } },
      });
      if (inspectionUpdate.count !== 1) throw new AppError('La inspeccion cambio mientras se procesaba la accion', 409);

      const evidenceUpdate = await tx.evidenciaInspeccion.updateMany({
        where: { id: evidence.id, inspeccionId: inspection.id, anuladaAt: null },
        data: { anuladaAt: new Date(), anuladaPorId: req.user.id, motivoAnulacion: input.motivo },
      });
      if (evidenceUpdate.count !== 1) throw new AppError('La evidencia ya fue modificada', 409);

      await tx.eventoInspeccion.create({
        data: {
          inspeccionId: inspection.id,
          usuarioId: req.user.id,
          tipo: 'EVIDENCIA_ANULADA',
          titulo: 'Evidencia anulada sin eliminar el archivo',
          detalle: `${evidence.nombreOriginal} · Motivo: ${input.motivo}`,
          metadata: { evidenciaId: evidence.id, archivoPreservado: true },
        },
      });
    });

    const updated = await prisma.evidenciaInspeccion.findUniqueOrThrow({
      where: { id: evidence.id },
      include: {
        creadoPor: { select: { id: true, nombre: true, apellido: true } },
        anuladaPor: { select: { id: true, nombre: true, apellido: true } },
      },
    });
    res.json({ success: true, data: updated, message: 'Evidencia anulada. El archivo original y su huella permanecen preservados.' });
  } catch (error) { next(error); }
}

export async function generarActaInspeccionPdf(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertInspectionStaff(req);
    const inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, include: inspectionInclude });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    if (!isAuthorizedAdmin(req.user) && inspection.inspectorId !== req.user.id) throw new AppError('No autorizado para exportar esta acta', 403);
    await streamInspectionActPdf(res, inspection, resolveInspectionEvidence);
  } catch (error) { next(error); }
}

export async function descargarEvidencia(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertInspectionStaff(req);
    const evidence = await prisma.evidenciaInspeccion.findUnique({
      where: { id: req.params.evidenciaId },
      include: { inspeccion: { select: { id: true, inspectorId: true } } },
    });
    if (!evidence || evidence.inspeccionId !== req.params.id) throw new AppError('Evidencia no encontrada', 404);
    if (!isAuthorizedAdmin(req.user) && evidence.inspeccion.inspectorId !== req.user.id) throw new AppError('No autorizado para esta evidencia', 403);
    const filePath = resolveInspectionEvidence(evidence.storageKey);
    await fs.promises.access(filePath, fs.constants.R_OK);
    res.setHeader('Content-Type', evidence.mimeDetectado);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(evidence.nombreOriginal)}`);
    res.sendFile(filePath);
  } catch (error) { next(error); }
}
