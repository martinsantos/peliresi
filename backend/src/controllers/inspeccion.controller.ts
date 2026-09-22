import fs from 'fs';
import type { NextFunction, Request, Response } from 'express';
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
import { streamInspectionActPdf } from '../services/inspectionFieldActPdf.service';
import { streamInspectionTechnicalReportPdf } from '../services/inspectionActPdf.service';
import {
  buildInspectionDocumentFingerprint, hashCanonicalPayload,
  inspectDossierReadiness,
} from '../services/inspectionDocumentIntegrity.service';
import { buildInspectionTracePresentation, buildInspectionTraceUrl, verifyInspectionTraceToken } from '../services/inspectionTraceToken.service';
import { inspectionEvidenceMetadataSchema } from '../domain/inspectionEvidence';

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
  generador: { select: { id: true, razonSocial: true, cuit: true, domicilio: true, telefono: true, email: true, activo: true } },
  transportista: { select: { id: true, razonSocial: true, cuit: true, domicilio: true, telefono: true, email: true, activo: true } },
  operador: { select: { id: true, razonSocial: true, cuit: true, domicilio: true, telefono: true, email: true, representanteLegalNombre: true, representanteLegalDNI: true, activo: true } },
  items: {
    orderBy: [{ categoria: 'asc' as const }, { orden: 'asc' as const }],
    include: { evidencias: { orderBy: { createdAt: 'desc' as const }, include: { anuladaPor: { select: { id: true, nombre: true, apellido: true } } } } },
  },
  comparaciones: {
    orderBy: [{ categoria: 'asc' as const }, { orden: 'asc' as const }],
    include: { evidencias: { orderBy: { createdAt: 'desc' as const }, include: { anuladaPor: { select: { id: true, nombre: true, apellido: true } } } } },
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
  intercambios: {
    orderBy: { secuencia: 'asc' as const },
    include: {
      autor: { select: { id: true, nombre: true, apellido: true, rol: true } },
      adjuntos: {
        where: { anuladaAt: null },
        orderBy: { createdAt: 'asc' as const },
        include: { anuladaPor: { select: { id: true, nombre: true, apellido: true } } },
      },
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

export const actaDataSchema = z.object({
  codigoPostal: z.string().trim().max(20).optional(),
  departamento: z.string().trim().max(120).optional(),
  calle: z.string().trim().max(200).optional(),
  numeroDomicilio: z.string().trim().max(40).optional(),
  titular: z.string().trim().max(200).optional(),
  dniTitular: z.string().trim().max(40).optional(),
  atendidoPor: z.string().trim().max(200).optional(),
  dniAtendido: z.string().trim().max(40).optional(),
  cargoAtendido: z.string().trim().max(120).optional(),
  area: z.string().trim().max(160).optional(),
  lugarAfectacion: z.string().trim().max(500).optional(),
  motivoInspeccion: z.string().trim().max(500).optional(),
  infraestructura: z.enum(['SI', 'NO', 'NO_VERIFICADO']).optional(),
  detalleInfraestructura: z.string().trim().max(2_000).optional(),
  estadoInfraestructura: z.string().trim().max(1_000).optional(),
  generacion: z.string().trim().max(1_000).optional(),
  requerimientos: z.string().trim().max(5_000).optional(),
  actaAnterior: z.string().trim().max(120).optional(),
  plazoDescargoDias: z.number().int().min(0).max(365).optional(),
  danosEstado: z.enum(['OBSERVADOS', 'NO_OBSERVADOS', 'NO_VERIFICADO']).optional(),
  danosDetalle: z.string().trim().max(5_000).optional(),
  tercerosTestigosEstado: z.enum(['IDENTIFICADOS', 'NO_IDENTIFICADOS', 'NO_VERIFICADO']).optional(),
  tercerosTestigosDetalle: z.string().trim().max(5_000).optional(),
  libroOperacionesEstado: z.enum(['EXHIBIDO', 'NO_EXHIBIDO', 'NO_DISPONIBLE', 'SECUESTRADO', 'NO_APLICA', 'NO_VERIFICADO']).optional(),
  libroOperacionesDetalle: z.string().trim().max(5_000).optional(),
  firmaIntervinienteEstado: z.enum(['FIRMADA', 'NEGATIVA', 'IMPOSIBILIDAD', 'AUSENTE', 'PENDIENTE']).optional(),
  firmaIntervinienteDetalle: z.string().trim().max(5_000).optional(),
  copiaActaEstado: z.enum(['ENTREGADA', 'NEGATIVA_RECEPCION', 'NO_ENTREGADA', 'PENDIENTE']).optional(),
  copiaActaDetalle: z.string().trim().max(5_000).optional(),
  domicilioLegal: z.string().trim().max(500).optional(),
  notificacionEstado: z.enum(['COMUNICADA_EN_ACTA', 'CONSTANCIA_FORMAL', 'NO_REALIZADA', 'PENDIENTE']).optional(),
  notificacionDetalle: z.string().trim().max(5_000).optional(),
}).strict();

const technicalReportSchema = z.object({
  expedienteElectronico: z.string().trim().max(300).optional(),
  referencias: z.string().trim().max(5_000).optional(),
  objetivo: z.string().trim().max(5_000).optional(),
  antecedentes: z.string().trim().max(20_000).optional(),
  evaluacion: z.string().trim().max(30_000).optional(),
  conclusion: z.string().trim().max(20_000).optional(),
  recomendacion: z.string().trim().max(10_000).optional(),
}).strict();

const updateSchema = z.object({
  version: z.number().int().positive(),
  numeroActa: z.string().trim().max(80).optional().nullable(),
  ubicacion: z.string().trim().max(300).optional().nullable(),
  latitud: z.number().min(-90).max(90).optional().nullable(),
  longitud: z.number().min(-180).max(180).optional().nullable(),
  fechaProgramada: z.string().datetime().optional().nullable(),
  plazoRespuestaAt: z.string().datetime().optional().nullable(),
  observaciones: z.string().trim().max(10_000).optional().nullable(),
  datosActa: actaDataSchema.optional().nullable(),
  informeTecnico: technicalReportSchema.optional().nullable(),
});

const technicalReportUpdateSchema = z.object({
  version: z.number().int().positive(),
  informeTecnico: technicalReportSchema.nullable(),
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

const draftSchema = updateSchema.extend({
  items: z.array(itemSchema).max(100).refine(
    (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
    'No se puede repetir un item de checklist',
  ),
  comparaciones: z.array(comparisonSchema).max(100).refine(
    (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
    'No se puede repetir un dato comparativo',
  ),
}).strict();

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

type InspectionAccessTarget = {
  inspectorId: string;
  tipoActor: TipoActorInspeccion;
};

/**
 * One authorization rule for the whole inspection module. Sector
 * administrators are administrators only for their own actor type; an
 * inspector without an administrative role is limited to assigned cases.
 */
export function canAccessInspection(user: any, inspection: InspectionAccessTarget): boolean {
  const role = String(user?.rol || '');
  if (role === 'ADMIN') return true;
  if (role.startsWith('ADMIN_')) return role === `ADMIN_${inspection.tipoActor}`;
  return Boolean(user?.esInspector) && user?.id === inspection.inspectorId;
}

export function inspectionScopeForUser(user: any): Prisma.InspeccionWhereInput {
  const role = String(user?.rol || '');
  if (role === 'ADMIN') return {};
  if (role === 'ADMIN_GENERADOR') return { tipoActor: 'GENERADOR' };
  if (role === 'ADMIN_TRANSPORTISTA') return { tipoActor: 'TRANSPORTISTA' };
  if (role === 'ADMIN_OPERADOR') return { tipoActor: 'OPERADOR' };
  return { inspectorId: user?.id };
}

function assertInspectionStaff(req: AuthRequest): void {
  if (!isInspectionStaff(req.user)) throw new AppError('Se requiere perfil inspector o administrador autorizado', 403);
}

function assertCanAccess(req: AuthRequest, inspection: InspectionAccessTarget): void {
  assertInspectionStaff(req);
  if (!canAccessInspection(req.user, inspection)) throw new AppError('No autorizado para este expediente', 403);
}

function assertCanEdit(req: AuthRequest, inspection: InspectionAccessTarget & { estado: EstadoInspeccion }): void {
  assertCanAccess(req, inspection);
  if (!EDITABLE_STATES.has(inspection.estado)) throw new AppError('La inspeccion ya no admite cambios de campo', 409);
}

async function reserveFieldMutation(
  tx: Prisma.TransactionClient,
  inspectionId: string,
  version: number,
): Promise<void> {
  const reserved = await tx.inspeccion.updateMany({
    where: {
      id: inspectionId,
      version,
      estado: { in: Array.from(EDITABLE_STATES) },
    },
    data: { version: { increment: 1 } },
  });
  if (reserved.count !== 1) {
    throw new AppError('La inspeccion cambio o cerro mientras se procesaba la accion. Actualice antes de continuar.', 409);
  }
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
      // Apply this after user filters so a query parameter can never widen a
      // sector administrator's scope.
      ...inspectionScopeForUser(req.user),
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
    assertCanAccess(req, inspection);
    if (!inspection.declaradoSnapshot || inspection.comparaciones.length === 0 || inspection.comparaciones.some((row) => row.codigo === 'RES-CORRIENTES' || row.codigo === 'RES-CORRIENTES-RESUMEN')) {
      await ensureInspectionDeclaredComparisons(prisma, inspection);
      inspection = await prisma.inspeccion.findUniqueOrThrow({ where: { id: req.params.id }, include: inspectionInclude });
    }
    const fingerprint = buildInspectionDocumentFingerprint(inspection);
    const trace = buildInspectionTracePresentation({ id: inspection.id, numero: inspection.numero, version: inspection.version, fingerprint });
    res.json({
      success: true,
      data: {
        ...inspection,
        verificacion: {
          url: trace.url,
          huella: fingerprint,
          version: inspection.version,
        },
      },
    });
  } catch (error) { next(error); }
}

/** Public QR landing data. Never return the inspection dossier or actor PII. */
export async function verificarInspeccionPublica(req: Request, res: Response, next: NextFunction) {
  try {
    const claims = verifyInspectionTraceToken(String(req.params.token || ''));
    if (!claims) throw new AppError('Código de verificación inválido', 404);
    // Load the same canonical dossier used by the PDFs, but only project a
    // minimal envelope below. This keeps the public hash identical to the
    // hash printed on the official documents without leaking dossier fields.
    const inspection = await prisma.inspeccion.findUnique({ where: { id: claims.inspectionId }, include: inspectionInclude });
    if (!inspection || inspection.numero !== claims.numero) throw new AppError('Código de verificación inválido', 404);
    const huellaActual = buildInspectionDocumentFingerprint(inspection);
    const estadoVerificacion = claims.fingerprint === huellaActual && claims.recordVersion === inspection.version
      ? 'VIGENTE'
      : 'HISTORICA_AUTENTICA';
    // Verification reflects a live administrative record. Do not let browsers,
    // shared proxies or search engines persist a stale public result.
    res.set('Cache-Control', 'no-store, max-age=0');
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.json({
      success: true,
      valido: true,
      data: {
        numero: inspection.numero,
        numeroActa: inspection.numeroActa,
        tipoActor: inspection.tipoActor,
        estado: inspection.estado,
        version: inspection.version,
        updatedAt: inspection.updatedAt,
        createdAt: inspection.createdAt,
        verificacion: {
          url: buildInspectionTraceUrl(String(req.params.token)),
          huella: claims.fingerprint,
          version: claims.recordVersion,
          estadoVerificacion,
          versionActual: inspection.version,
          huellaActual: huellaActual,
        },
        authorizedPath: `/inspecciones/${encodeURIComponent(inspection.id)}#trazabilidad`,
        accesoDetallado: 'requiere_autorizacion',
      },
    });
  } catch (error) { next(error); }
}

export async function crearInspeccion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertInspectionStaff(req);
    const input = createSchema.parse(req.body);
    if (String(req.user?.rol).startsWith('ADMIN_') && !isSectorReviewer(req.user, input.tipoActor)) {
      throw new AppError('El administrador sectorial solo puede crear inspecciones de su tipo de actor', 403);
    }
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
    const inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, select: { inspectorId: true, tipoActor: true, estado: true, version: true } });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    assertCanEdit(req, inspection);
    if (inspection.version !== body.version) throw new AppError('La inspeccion fue modificada en otro dispositivo. Actualice antes de continuar.', 409);

    await prisma.$transaction(async (tx) => {
      // Reserve the parent version and re-check the editable state in the
      // transaction. A simultaneous field closure or another device edit now
      // makes this request fail before any comparison row is changed.
      await reserveFieldMutation(tx, req.params.id, body.version);
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
    assertCanAccess(req, inspection);
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
    const inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, select: { inspectorId: true, tipoActor: true, estado: true, version: true } });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    assertCanEdit(req, inspection);
    const { version, datosActa, informeTecnico, ...fields } = input;
    const result = await prisma.inspeccion.updateMany({
      where: { id: req.params.id, version, estado: { in: Array.from(EDITABLE_STATES) } },
      data: {
        ...fields,
        datosActa: datosActa === undefined ? undefined : datosActa === null ? Prisma.DbNull : datosActa as Prisma.InputJsonValue,
        informeTecnico: informeTecnico === undefined ? undefined : informeTecnico === null ? Prisma.DbNull : informeTecnico as Prisma.InputJsonValue,
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

export async function guardarBorradorInspeccion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = draftSchema.parse(req.body);
    const inspection = await prisma.inspeccion.findUnique({
      where: { id: req.params.id },
      select: { inspectorId: true, tipoActor: true, estado: true, version: true },
    });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    assertCanEdit(req, inspection);
    if (inspection.version !== input.version) throw new AppError('La inspeccion fue modificada en otro dispositivo. Actualice antes de continuar.', 409);

    const { version, items, comparaciones, datosActa, informeTecnico, ...fields } = input;
    const full = await prisma.$transaction(async (tx) => {
      // Reserve once for the complete draft. A failure in any section also
      // rolls back this reservation, so retries never inherit a partial save.
      await reserveFieldMutation(tx, req.params.id, version);
      const itemIds = items.map((item) => item.id);
      const comparacionIds = comparaciones.map((comparison) => comparison.id);
      if (itemIds.length && await tx.itemInspeccion.count({ where: { id: { in: itemIds }, inspeccionId: req.params.id } }) !== itemIds.length) {
        throw new AppError('Item de checklist invalido', 400);
      }
      const existingComparisons = comparacionIds.length ? await tx.comparacionInspeccion.findMany({
        where: { id: { in: comparacionIds }, inspeccionId: req.params.id },
        select: { id: true, resultado: true, valorObservado: true, observacion: true },
      }) : [];
      if (existingComparisons.length !== comparacionIds.length) {
        throw new AppError('Dato comparativo inválido', 400);
      }
      const comparisonsById = new Map(existingComparisons.map((comparison) => [comparison.id, comparison]));

      await tx.inspeccion.update({
        where: { id: req.params.id },
        data: {
          ...fields,
          datosActa: datosActa === undefined ? undefined : datosActa === null ? Prisma.DbNull : datosActa as Prisma.InputJsonValue,
          informeTecnico: informeTecnico === undefined ? undefined : informeTecnico === null ? Prisma.DbNull : informeTecnico as Prisma.InputJsonValue,
          fechaProgramada: fields.fechaProgramada === undefined ? undefined : fields.fechaProgramada ? new Date(fields.fechaProgramada) : null,
          plazoRespuestaAt: fields.plazoRespuestaAt === undefined ? undefined : fields.plazoRespuestaAt ? new Date(fields.plazoRespuestaAt) : null,
        },
      });
      for (const item of items) {
        const updated = await tx.itemInspeccion.updateMany({
          where: { id: item.id, inspeccionId: req.params.id },
          data: { resultado: item.resultado, observacion: item.observacion || null },
        });
        if (updated.count !== 1) throw new AppError('Item de checklist invalido', 400);
      }
      for (const comparison of comparaciones) {
        const existing = comparisonsById.get(comparison.id)!;
        const valorObservado = comparison.valorObservado || null;
        const observacion = comparison.observacion || null;
        // Saving another section must not reattribute an earlier verification
        // or change its timestamp when the comparison content is unchanged.
        if (existing.resultado === comparison.resultado && (existing.valorObservado || null) === valorObservado && (existing.observacion || null) === observacion) continue;
        const updated = await tx.comparacionInspeccion.updateMany({
          where: { id: comparison.id, inspeccionId: req.params.id },
          data: {
            resultado: comparison.resultado,
            valorObservado,
            observacion,
            verificadoPorId: comparison.resultado === 'PENDIENTE' ? null : req.user.id,
            verificadoAt: comparison.resultado === 'PENDIENTE' ? null : new Date(),
          },
        });
        if (updated.count !== 1) throw new AppError('Dato comparativo inválido', 400);
      }
      await tx.eventoInspeccion.create({
        data: {
          inspeccionId: req.params.id,
          usuarioId: req.user.id,
          tipo: 'BORRADOR_ACTUALIZADO',
          titulo: 'Borrador de campo guardado',
          visibleActor: false,
          metadata: { schemaVersion: 1, versionBase: version, versionNueva: version + 1, itemIds, comparacionIds, contenidoSha256: hashCanonicalPayload(input) },
        },
      });
      return tx.inspeccion.findUniqueOrThrow({ where: { id: req.params.id }, include: inspectionInclude });
    });
    res.json({ success: true, data: full });
  } catch (error) { next(error); }
}

export async function actualizarInformeTecnico(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = technicalReportUpdateSchema.parse(req.body);
    const inspection = await prisma.inspeccion.findUnique({
      where: { id: req.params.id },
      select: { id: true, inspectorId: true, estado: true, version: true, tipoActor: true },
    });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    if (!canAccessInspection(req.user, inspection)) {
      throw new AppError('Solo el inspector asignado o el administrador competente puede completar el informe tecnico', 403);
    }
    if (inspection.estado !== 'EN_REVISION') {
      throw new AppError('El informe tecnico posterior solo puede editarse durante la revision del expediente', 409);
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.inspeccion.updateMany({
        where: { id: inspection.id, version: input.version, estado: 'EN_REVISION' },
        data: {
          informeTecnico: input.informeTecnico === null ? Prisma.DbNull : input.informeTecnico as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new AppError('La inspeccion fue modificada en otro dispositivo. Actualice antes de continuar.', 409);
      }
      await tx.eventoInspeccion.create({
        data: {
          inspeccionId: inspection.id,
          usuarioId: req.user.id,
          tipo: 'INFORME_TECNICO_ACTUALIZADO',
          titulo: 'Informe tecnico actualizado',
          detalle: 'Se guardo una nueva version de la evaluacion tecnica sin modificar el acta de campo.',
          visibleActor: false,
          metadata: {
            schemaVersion: 1,
            versionBase: input.version,
            versionNueva: input.version + 1,
            contenidoSha256: hashCanonicalPayload(input.informeTecnico),
            snapshot: input.informeTecnico,
          },
        },
      });
    });

    const full = await prisma.inspeccion.findUniqueOrThrow({ where: { id: inspection.id }, include: inspectionInclude });
    res.json({ success: true, data: full });
  } catch (error) { next(error); }
}

export async function actualizarItems(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = z.object({ version: z.number().int().positive(), items: z.array(itemSchema).min(1).max(100) }).parse(req.body);
    const inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, select: { inspectorId: true, tipoActor: true, estado: true, version: true } });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    assertCanEdit(req, inspection);
    if (inspection.version !== body.version) throw new AppError('La inspeccion fue modificada en otro dispositivo. Actualice antes de continuar.', 409);

    await prisma.$transaction(async (tx) => {
      await reserveFieldMutation(tx, req.params.id, body.version);
      for (const item of body.items) {
        const updated = await tx.itemInspeccion.updateMany({
          where: { id: item.id, inspeccionId: req.params.id },
          data: { resultado: item.resultado, observacion: item.observacion || null },
        });
        if (updated.count !== 1) throw new AppError('Item de checklist invalido', 400);
      }
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
        items: { select: { id: true, codigo: true, categoria: true, etiqueta: true, obligatorio: true, resultado: true, observacion: true, updatedAt: true } },
        comparaciones: { select: { id: true, codigo: true, categoria: true, etiqueta: true, origen: true, valorDeclarado: true, valorObservado: true, resultado: true, observacion: true, verificadoPorId: true, verificadoAt: true, updatedAt: true } },
        evidencias: { select: { id: true, tipo: true, sha256: true, capturadaAt: true, createdAt: true, creadoPorId: true, itemId: true, comparacionId: true, eventoId: true, anuladaAt: true, anuladaPorId: true, motivoAnulacion: true } },
      },
    });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    assertInspectionStaff(req);
    if (!canAccessInspection(req.user, inspection)) throw new AppError('No autorizado para cambiar el estado de esta inspeccion', 403);
    const admin = isSectorReviewer(req.user, inspection.tipoActor);
    const assignedInspector = inspection.inspectorId === req.user.id;
    if (!admin && !assignedInspector) throw new AppError('No autorizado para cambiar el estado de esta inspeccion', 403);
    if (inspection.estado === input.estado) {
      const current = await prisma.inspeccion.findUniqueOrThrow({ where: { id: inspection.id }, include: inspectionInclude });
      return res.json({ success: true, data: current });
    }
    if (inspection.version !== input.version) throw new AppError('La inspeccion fue modificada en otro dispositivo. Actualice antes de continuar.', 409);
    if (!canTransitionInspection(inspection.estado, input.estado, admin)) throw new AppError(`Transicion ${inspection.estado} a ${input.estado} no permitida`, 409);
    if (input.estado === 'EN_REVISION' && !isChecklistReadyForReview(inspection.items)) {
      throw new AppError('Complete todos los items obligatorios antes de enviar a revision', 400);
    }
    if (input.estado === 'EN_REVISION' && !isComparisonReadyForReview(inspection.comparaciones)) {
      throw new AppError('Complete el contraste de todos los datos declarados antes de enviar a revision', 400);
    }
    if (input.estado === 'NOTIFICADA' && !input.plazoRespuestaAt) throw new AppError('Defina el plazo de respuesta antes de notificar', 400);
    if (input.estado === 'NOTIFICADA') {
      const readiness = inspectDossierReadiness(inspection);
      if (!readiness.ready) {
        throw new AppError(`Complete el expediente antes de notificar: ${readiness.missing.join(', ')}`, 400);
      }
    }

    const transitionAt = new Date();
    const fieldClosureSnapshot = input.estado === 'EN_REVISION' ? {
      schemaVersion: 1,
      numero: inspection.numero,
      numeroActa: inspection.numeroActa,
      tipoActor: inspection.tipoActor,
      generadorId: inspection.generadorId,
      transportistaId: inspection.transportistaId,
      operadorId: inspection.operadorId,
      inspectorId: inspection.inspectorId,
      ubicacion: inspection.ubicacion,
      latitud: inspection.latitud,
      longitud: inspection.longitud,
      iniciadaAt: inspection.iniciadaAt,
      cerradaCampoAt: transitionAt,
      observaciones: inspection.observaciones,
      declaradoSnapshot: inspection.declaradoSnapshot,
      datosActa: inspection.datosActa,
      items: inspection.items,
      comparaciones: inspection.comparaciones,
      evidencias: inspection.evidencias,
    } : null;
    const fieldClosureSnapshotJson = fieldClosureSnapshot
      ? JSON.parse(JSON.stringify(fieldClosureSnapshot)) as Prisma.InputJsonValue
      : null;

    await prisma.$transaction(async (tx) => {
      const updated = await tx.inspeccion.updateMany({
        where: { id: inspection.id, version: input.version },
        data: {
          estado: input.estado,
          version: { increment: 1 },
          iniciadaAt: input.estado === 'EN_CAMPO' && !inspection.iniciadaAt ? transitionAt : undefined,
          cerradaCampoAt: input.estado === 'EN_REVISION' ? transitionAt : undefined,
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
          metadata: fieldClosureSnapshot ? {
            schemaVersion: 1,
            versionBase: input.version,
            versionNueva: input.version + 1,
            actaSha256: hashCanonicalPayload(fieldClosureSnapshot),
            actaSnapshot: fieldClosureSnapshotJson,
          } as Prisma.InputJsonValue : undefined,
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
    const parsedMetadata = inspectionEvidenceMetadataSchema.safeParse(req.body || {});
    if (!parsedMetadata.success) throw new AppError(parsedMetadata.error.issues[0].message, 400);
    const metadata = parsedMetadata.data;
    const inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, select: { inspectorId: true, tipoActor: true, estado: true, version: true } });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    const eventoId = metadata.eventoId || null;
    const comparacionId = metadata.comparacionId || null;
    const itemId = metadata.itemId || null;
    const clienteId = metadata.clienteId || null;
    if (!hasSingleEvidenceTarget([eventoId, comparacionId, itemId])) {
      throw new AppError('La evidencia debe vincularse a un único comentario, comparación o evento', 400);
    }
    // Evidence is part of the field record. Re-checking the same state/version
    // in the transaction below prevents an upload that started online from
    // landing after another device closed the field act.
    assertCanEdit(req, inspection);
    let itemTarget: { codigo: string; etiqueta: string } | null = null;
    if (eventoId) {
      const eventExists = await prisma.eventoInspeccion.count({ where: { id: eventoId, inspeccionId: req.params.id } });
      if (!eventExists) throw new AppError('Evento de trazabilidad inválido', 400);
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
    const inferredType: TipoEvidenciaInspeccion = stored.mimeType.startsWith('image/')
      ? 'FOTO' : stored.mimeType.startsWith('audio/') ? 'AUDIO' : 'DOCUMENTO';
    const tipo = metadata.tipo || inferredType;
    if ((tipo === 'FOTO' && !stored.mimeType.startsWith('image/')) || (tipo === 'AUDIO' && !stored.mimeType.startsWith('audio/'))) {
      throw new AppError('El tipo declarado no coincide con el contenido del archivo', 400);
    }
    if (itemId && !stored.mimeType.startsWith('image/')) {
      throw new AppError('Los comentarios del checklist admiten imágenes JPG, PNG o WEBP', 400);
    }
    const clientHash = metadata.clienteSha256?.toLowerCase() || null;
    if (clientHash && clientHash !== stored.sha256) {
      throw new AppError('La evidencia cambió durante la sincronización', 400);
    }
    const requestedCaptureDate = metadata.capturadaAt || null;
    const duplicate = await prisma.evidenciaInspeccion.findFirst({ where: { inspeccionId: req.params.id, sha256: stored.sha256 } });
    if (duplicate) {
      await removeInspectionEvidence(stored.storageKey);
      storedKey = null;
      if (itemId && !duplicate.itemId && !duplicate.comparacionId && !duplicate.eventoId) {
        const linked = await prisma.$transaction(async (tx) => {
          await reserveFieldMutation(tx, req.params.id, inspection.version);
          const updated = await tx.evidenciaInspeccion.update({
            where: { id: duplicate.id },
            data: {
              itemId,
              descripcion: metadata.descripcion || duplicate.descripcion,
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
      await reserveFieldMutation(tx, req.params.id, inspection.version);
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
          descripcion: metadata.descripcion || null,
          transcripcion: metadata.transcripcion || null,
          capturadaAt: requestedCaptureDate || new Date(),
          latitud: metadata.latitud ?? null,
          longitud: metadata.longitud ?? null,
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
      select: { id: true, inspectorId: true, tipoActor: true, estado: true, version: true },
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
        where: { id: inspection.id, version: input.version, estado: { in: Array.from(EDITABLE_STATES) } },
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
    assertCanAccess(req, inspection);
    await streamInspectionActPdf(res, inspection, resolveInspectionEvidence);
  } catch (error) { next(error); }
}

export async function generarInformeTecnicoInspeccionPdf(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertInspectionStaff(req);
    const inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, include: inspectionInclude });
    if (!inspection) throw new AppError('Inspeccion no encontrada', 404);
    assertCanAccess(req, inspection);
    await streamInspectionTechnicalReportPdf(res, inspection, resolveInspectionEvidence);
  } catch (error) { next(error); }
}

export async function descargarEvidencia(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertInspectionStaff(req);
    const evidence = await prisma.evidenciaInspeccion.findUnique({
      where: { id: req.params.evidenciaId },
      include: { inspeccion: { select: { id: true, inspectorId: true, tipoActor: true } } },
    });
    if (!evidence || evidence.inspeccionId !== req.params.id) throw new AppError('Evidencia no encontrada', 404);
    assertCanAccess(req, evidence.inspeccion);
    const filePath = resolveInspectionEvidence(evidence.storageKey);
    await fs.promises.access(filePath, fs.constants.R_OK);
    res.setHeader('Content-Type', evidence.mimeDetectado);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(evidence.nombreOriginal)}`);
    res.sendFile(filePath);
  } catch (error) { next(error); }
}
