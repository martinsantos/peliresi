import { NextFunction, Response } from 'express';
import {
  EstadoInspeccion,
  ParteIntercambioInspeccion,
  Prisma,
  TipoEvidenciaInspeccion,
  TipoIntercambioInspeccion,
} from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import {
  buildInspectionExchangeDigests,
  canDecideInspectionExchange,
  exchangePartyForUser,
  isExchangeTypeAllowed,
  isInspectionExchangeOpen,
  nextInspectionStateForExchange,
} from '../services/inspectionExchange.service';
import {
  persistInspectionEvidence,
  removeInspectionEvidence,
  resolveInspectionEvidence,
  StoredInspectionEvidence,
} from '../services/inspectionEvidence.service';

const PARTICIPANT_VISIBLE_STATES: EstadoInspeccion[] = [
  'NOTIFICADA',
  'EN_DESCARGO',
  'REQUIERE_SUBSANACION',
  'CERRADA_CONFORME',
  'DERIVADA_LEGALES',
  'EN_TRAMITE_LEGAL',
  'DERIVADA_ATM',
  'FINALIZADA',
];

const exchangeInputSchema = z.object({
  version: z.coerce.number().int().positive(),
  clienteId: z.string().trim().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  tipo: z.nativeEnum(TipoIntercambioInspeccion),
  asunto: z.string().trim().min(5).max(180),
  cuerpo: z.string().trim().min(10).max(12_000),
  respondeAId: z.string().trim().min(1).optional(),
  plazoRespuestaAt: z.string().datetime().optional(),
});

const decisionInputSchema = z.object({
  version: z.coerce.number().int().positive(),
  clienteId: z.string().trim().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  decision: z.enum(['CERRADA_CONFORME', 'DERIVADA_LEGALES']),
  fundamento: z.string().trim().min(20).max(12_000),
  expedienteLegal: z.string().trim().max(180).optional(),
});

const inspectionAccessSelect = {
  id: true,
  numero: true,
  numeroActa: true,
  estado: true,
  version: true,
  tipoActor: true,
  inspectorId: true,
  generadorId: true,
  transportistaId: true,
  operadorId: true,
  plazoRespuestaAt: true,
  generador: { select: { id: true, razonSocial: true, cuit: true } },
  transportista: { select: { id: true, razonSocial: true, cuit: true } },
  operador: { select: { id: true, razonSocial: true, cuit: true } },
} satisfies Prisma.InspeccionSelect;

const exchangeInclude = {
  autor: { select: { id: true, nombre: true, apellido: true, rol: true } },
  adjuntos: {
    where: { anuladaAt: null },
    select: {
      id: true,
      nombreOriginal: true,
      mimeDetectado: true,
      bytes: true,
      sha256: true,
      descripcion: true,
      capturadaAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.IntercambioInspeccionInclude;

function participantWhere(user: any): Prisma.InspeccionWhereInput | null {
  if (user?.rol === 'GENERADOR' && user?.generador?.id) return { generadorId: user.generador.id };
  if (user?.rol === 'TRANSPORTISTA' && user?.transportista?.id) return { transportistaId: user.transportista.id };
  if (user?.rol === 'OPERADOR' && user?.operador?.id) return { operadorId: user.operador.id };
  return null;
}

function actorSummary(inspection: any) {
  return inspection.generador || inspection.transportista || inspection.operador || null;
}

function assertExchangeAccess(user: any, inspection: any): ParteIntercambioInspeccion {
  const party = exchangePartyForUser(user, inspection);
  if (!party) throw new AppError('No autorizado para este intercambio de inspección', 403);
  if (party === 'INSPECCIONADO' && !PARTICIPANT_VISIBLE_STATES.includes(inspection.estado)) {
    throw new AppError('El expediente todavía no fue puesto a disposición del inspeccionado', 403);
  }
  return party;
}

function evidenceType(mimeType: string): TipoEvidenciaInspeccion {
  if (mimeType.startsWith('image/')) return 'FOTO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  return 'DOCUMENTO';
}

function eventTitle(tipo: TipoIntercambioInspeccion, parte: ParteIntercambioInspeccion): string {
  const labels: Record<TipoIntercambioInspeccion, string> = {
    REQUERIMIENTO: 'Requerimiento formal emitido',
    RESPUESTA: parte === 'INSPECCIONADO' ? 'Respuesta del inspeccionado presentada' : 'Respuesta de la autoridad presentada',
    DESCARGO: 'Descargo del inspeccionado presentado',
    SUBSANACION: 'Documentación de subsanación presentada',
    PRONUNCIAMIENTO: 'Pronunciamiento técnico de la autoridad',
    CIERRE_CONFORME: 'Intercambio cerrado conforme',
    DERIVACION_LEGALES: 'Expediente derivado a Legales',
  };
  return labels[tipo];
}

export async function listarParticipacionInspeccionado(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const ownActor = participantWhere(req.user);
    if (!ownActor) throw new AppError('La cuenta no está vinculada a un actor inspeccionable', 403);
    const rows = await prisma.inspeccion.findMany({
      where: { ...ownActor, estado: { in: PARTICIPANT_VISIBLE_STATES } },
      select: {
        ...inspectionAccessSelect,
        _count: { select: { intercambios: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({
      success: true,
      data: rows.map((inspection) => ({
        id: inspection.id,
        numero: inspection.numero,
        numeroActa: inspection.numeroActa,
        estado: inspection.estado,
        tipoActor: inspection.tipoActor,
        actor: actorSummary(inspection),
        plazoRespuestaAt: inspection.plazoRespuestaAt,
        version: inspection.version,
        cantidadPresentaciones: inspection._count.intercambios,
      })),
    });
  } catch (error) { next(error); }
}

export async function obtenerIntercambiosInspeccion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const inspection = await prisma.inspeccion.findUnique({
      where: { id: req.params.id },
      select: inspectionAccessSelect,
    });
    if (!inspection) throw new AppError('Inspección no encontrada', 404);
    const party = assertExchangeAccess(req.user, inspection);
    const exchanges = await prisma.intercambioInspeccion.findMany({
      where: { inspeccionId: inspection.id },
      include: exchangeInclude,
      orderBy: { secuencia: 'asc' },
    });
    res.json({
      success: true,
      data: {
        inspeccion: {
          id: inspection.id,
          numero: inspection.numero,
          numeroActa: inspection.numeroActa,
          estado: inspection.estado,
          tipoActor: inspection.tipoActor,
          actor: actorSummary(inspection),
          plazoRespuestaAt: inspection.plazoRespuestaAt,
          version: inspection.version,
        },
        parteActual: party,
        intercambios: exchanges,
        comunicacionExterna: false,
      },
    });
  } catch (error) { next(error); }
}

export async function presentarIntercambioInspeccion(req: AuthRequest, res: Response, next: NextFunction) {
  const storedKeys: string[] = [];
  try {
    const input = exchangeInputSchema.parse(req.body || {});
    const files = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
    if (files.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) {
      throw new AppError('Los adjuntos de una presentación no pueden superar 50 MB en total', 400);
    }
    const inspection = await prisma.inspeccion.findUnique({
      where: { id: req.params.id },
      select: inspectionAccessSelect,
    });
    if (!inspection) throw new AppError('Inspección no encontrada', 404);
    const party = assertExchangeAccess(req.user, inspection);
    if (!isInspectionExchangeOpen(inspection.estado)) throw new AppError('El intercambio formal se encuentra cerrado', 409);
    if (!isExchangeTypeAllowed(party, input.tipo)) throw new AppError('El tipo de presentación no corresponde a la parte autenticada', 403);
    if (party === 'INSPECCIONADO' && input.plazoRespuestaAt) throw new AppError('El inspeccionado no puede fijar el plazo de respuesta', 403);
    if (input.plazoRespuestaAt && input.tipo !== 'REQUERIMIENTO') throw new AppError('Sólo un requerimiento puede fijar un nuevo plazo', 400);
    if (input.plazoRespuestaAt && new Date(input.plazoRespuestaAt).getTime() <= Date.now()) throw new AppError('El plazo debe ser posterior al momento actual', 400);

    if (input.clienteId) {
      const existing = await prisma.intercambioInspeccion.findFirst({
        where: { inspeccionId: inspection.id, clienteId: input.clienteId },
        include: exchangeInclude,
      });
      if (existing) return res.json({ success: true, data: existing, message: 'La presentación ya estaba incorporada.' });
    }

    const storedFiles: Array<{ file: Express.Multer.File; stored: StoredInspectionEvidence }> = [];
    for (const file of files) {
      const stored = await persistInspectionEvidence(file, inspection.id);
      storedKeys.push(stored.storageKey);
      storedFiles.push({ file, stored });
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "inspecciones" WHERE "id" = ${inspection.id} FOR UPDATE`;
      const locked = await tx.inspeccion.findUniqueOrThrow({ where: { id: inspection.id }, select: { version: true, estado: true, plazoRespuestaAt: true } });
      if (locked.version !== input.version) throw new AppError('El expediente cambió en otro dispositivo. Actualice antes de presentar.', 409);
      if (!isInspectionExchangeOpen(locked.estado)) throw new AppError('El intercambio formal se encuentra cerrado', 409);

      const previous = await tx.intercambioInspeccion.findFirst({
        where: { inspeccionId: inspection.id },
        orderBy: { secuencia: 'desc' },
        select: { secuencia: true, hashCadena: true },
      });
      const parent = input.respondeAId
        ? await tx.intercambioInspeccion.findFirst({
          where: { id: input.respondeAId, inspeccionId: inspection.id },
          select: { id: true, parte: true },
        })
        : null;
      if (input.respondeAId && !parent) throw new AppError('La presentación respondida no pertenece a este expediente', 400);
      if (party === 'INSPECCIONADO' && (!parent || parent.parte !== 'AUTORIDAD')) {
        throw new AppError('El descargo debe responder a una presentación previa de la autoridad', 400);
      }
      if (party === 'AUTORIDAD' && input.tipo !== 'REQUERIMIENTO' && (!parent || parent.parte !== 'INSPECCIONADO')) {
        throw new AppError('La respuesta o pronunciamiento debe vincularse a una presentación del inspeccionado', 400);
      }

      const secuencia = (previous?.secuencia || 0) + 1;
      const createdAt = new Date();
      const nextState = nextInspectionStateForExchange(locked.estado, party, input.tipo);
      const late = party === 'INSPECCIONADO'
        && Boolean(locked.plazoRespuestaAt && createdAt.getTime() > locked.plazoRespuestaAt.getTime());
      const digests = buildInspectionExchangeDigests({
        inspeccionId: inspection.id,
        secuencia,
        respondeAId: input.respondeAId || null,
        tipo: input.tipo,
        parte: party,
        asunto: input.asunto,
        cuerpo: input.cuerpo,
        plazoRespuestaAt: input.plazoRespuestaAt || null,
        canal: 'PORTAL_SITREP',
        versionExpediente: locked.version + 1,
        autorId: req.user.id,
        createdAt,
        adjuntos: storedFiles.map(({ file, stored }) => ({
          nombreOriginal: file.originalname,
          mimeDetectado: stored.mimeType,
          bytes: stored.bytes,
          sha256: stored.sha256,
        })),
      }, previous?.hashCadena);

      const exchange = await tx.intercambioInspeccion.create({
        data: {
          inspeccionId: inspection.id,
          secuencia,
          clienteId: input.clienteId || null,
          respondeAId: input.respondeAId || null,
          tipo: input.tipo,
          parte: party,
          asunto: input.asunto,
          cuerpo: input.cuerpo,
          plazoRespuestaAt: input.plazoRespuestaAt ? new Date(input.plazoRespuestaAt) : null,
          canal: 'PORTAL_SITREP',
          versionExpediente: locked.version + 1,
          presentadoFueraDePlazo: late,
          contenidoSha256: digests.contenidoSha256,
          hashAnterior: previous?.hashCadena || null,
          hashCadena: digests.hashCadena,
          autorId: req.user.id,
          createdAt,
        },
      });
      for (const { file, stored } of storedFiles) {
        await tx.evidenciaInspeccion.create({
          data: {
            inspeccionId: inspection.id,
            intercambioId: exchange.id,
            creadoPorId: req.user.id,
            tipo: evidenceType(stored.mimeType),
            nombreOriginal: file.originalname,
            storageKey: stored.storageKey,
            mimeDetectado: stored.mimeType,
            bytes: stored.bytes,
            sha256: stored.sha256,
            descripcion: `Adjunto de presentación #${secuencia}`,
            capturadaAt: createdAt,
          },
        });
      }
      await tx.inspeccion.update({
        where: { id: inspection.id },
        data: {
          estado: nextState,
          version: { increment: 1 },
          plazoRespuestaAt: input.plazoRespuestaAt ? new Date(input.plazoRespuestaAt) : undefined,
        },
      });
      await tx.eventoInspeccion.create({
        data: {
          inspeccionId: inspection.id,
          usuarioId: req.user.id,
          tipo: `INTERCAMBIO_${input.tipo}`,
          titulo: eventTitle(input.tipo, party),
          detalle: input.asunto,
          estadoDesde: locked.estado,
          estadoHasta: nextState,
          visibleActor: true,
          canal: 'PORTAL_SITREP',
          estadoEntrega: 'REGISTRADO_EN_PORTAL',
          destinatario: party === 'AUTORIDAD' ? 'INSPECCIONADO' : 'AUTORIDAD',
          metadata: {
            intercambioId: exchange.id,
            secuencia,
            contenidoSha256: digests.contenidoSha256,
            hashCadena: digests.hashCadena,
            adjuntosSha256: storedFiles.map(({ stored }) => stored.sha256),
            presentadoFueraDePlazo: late,
            correoEnviado: false,
          },
        },
      });
      return exchange;
    });

    storedKeys.length = 0;
    const full = await prisma.intercambioInspeccion.findUniqueOrThrow({ where: { id: created.id }, include: exchangeInclude });
    res.status(201).json({ success: true, data: full, message: 'Presentación registrada en SITREP. No se envió correo electrónico.' });
  } catch (error) {
    await Promise.all(storedKeys.map((key) => removeInspectionEvidence(key).catch(() => undefined)));
    next(error);
  }
}

export async function decidirIntercambioInspeccion(req: AuthRequest, res: Response, next: NextFunction) {
  const storedKeys: string[] = [];
  try {
    const input = decisionInputSchema.parse(req.body);
    const files = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
    if (files.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) {
      throw new AppError('Los adjuntos de una decisión no pueden superar 50 MB en total', 400);
    }
    const inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, select: inspectionAccessSelect });
    if (!inspection) throw new AppError('Inspección no encontrada', 404);
    if (!canDecideInspectionExchange(req.user, inspection)) throw new AppError('Sólo el administrador competente puede cerrar o derivar el expediente', 403);
    if (input.clienteId) {
      const existing = await prisma.intercambioInspeccion.findFirst({
        where: { inspeccionId: inspection.id, clienteId: input.clienteId },
        include: exchangeInclude,
      });
      if (existing) return res.json({ success: true, data: existing, message: 'La decisión ya estaba incorporada.' });
    }
    if (!isInspectionExchangeOpen(inspection.estado)) throw new AppError('El expediente no admite esta decisión', 409);

    const storedFiles: Array<{ file: Express.Multer.File; stored: StoredInspectionEvidence }> = [];
    for (const file of files) {
      const stored = await persistInspectionEvidence(file, inspection.id);
      storedKeys.push(stored.storageKey);
      storedFiles.push({ file, stored });
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "inspecciones" WHERE "id" = ${inspection.id} FOR UPDATE`;
      const locked = await tx.inspeccion.findUniqueOrThrow({ where: { id: inspection.id }, select: { version: true, estado: true } });
      if (locked.version !== input.version) throw new AppError('El expediente cambió en otro dispositivo. Actualice antes de decidir.', 409);
      if (!isInspectionExchangeOpen(locked.estado)) throw new AppError('El expediente no admite esta decisión', 409);
      const previous = await tx.intercambioInspeccion.findFirst({
        where: { inspeccionId: inspection.id },
        orderBy: { secuencia: 'desc' },
        select: { secuencia: true, hashCadena: true },
      });
      if (!previous) throw new AppError('Debe existir al menos una presentación formal antes de cerrar el intercambio', 409);
      const secuencia = previous.secuencia + 1;
      const createdAt = new Date();
      const tipo: TipoIntercambioInspeccion = input.decision === 'CERRADA_CONFORME' ? 'CIERRE_CONFORME' : 'DERIVACION_LEGALES';
      const asunto = input.decision === 'CERRADA_CONFORME' ? 'Cierre conforme del intercambio' : 'Derivación del expediente a Legales';
      const cuerpo = [input.fundamento, input.expedienteLegal ? `Expediente legal: ${input.expedienteLegal}` : null].filter(Boolean).join('\n\n');
      const digests = buildInspectionExchangeDigests({
        inspeccionId: inspection.id,
        secuencia,
        respondeAId: null,
        tipo,
        parte: 'AUTORIDAD',
        asunto,
        cuerpo,
        plazoRespuestaAt: null,
        canal: 'PORTAL_SITREP',
        versionExpediente: locked.version + 1,
        autorId: req.user.id,
        createdAt,
        adjuntos: storedFiles.map(({ file, stored }) => ({
          nombreOriginal: file.originalname,
          mimeDetectado: stored.mimeType,
          bytes: stored.bytes,
          sha256: stored.sha256,
        })),
      }, previous.hashCadena);
      const exchange = await tx.intercambioInspeccion.create({
        data: {
          inspeccionId: inspection.id,
          secuencia,
          clienteId: input.clienteId || null,
          tipo,
          parte: 'AUTORIDAD',
          asunto,
          cuerpo,
          canal: 'PORTAL_SITREP',
          versionExpediente: locked.version + 1,
          contenidoSha256: digests.contenidoSha256,
          hashAnterior: previous.hashCadena,
          hashCadena: digests.hashCadena,
          autorId: req.user.id,
          createdAt,
        },
      });
      for (const { file, stored } of storedFiles) {
        await tx.evidenciaInspeccion.create({
          data: {
            inspeccionId: inspection.id,
            intercambioId: exchange.id,
            creadoPorId: req.user.id,
            tipo: evidenceType(stored.mimeType),
            nombreOriginal: file.originalname,
            storageKey: stored.storageKey,
            mimeDetectado: stored.mimeType,
            bytes: stored.bytes,
            sha256: stored.sha256,
            descripcion: input.decision === 'CERRADA_CONFORME' ? 'Adjunto del cierre conforme' : 'Adjunto de la derivación a Legales',
            capturadaAt: createdAt,
          },
        });
      }
      await tx.inspeccion.update({
        where: { id: inspection.id },
        data: { estado: input.decision, version: { increment: 1 }, plazoRespuestaAt: null },
      });
      await tx.eventoInspeccion.create({
        data: {
          inspeccionId: inspection.id,
          usuarioId: req.user.id,
          tipo: `INTERCAMBIO_${tipo}`,
          titulo: eventTitle(tipo, 'AUTORIDAD'),
          detalle: input.fundamento,
          estadoDesde: locked.estado,
          estadoHasta: input.decision,
          visibleActor: true,
          canal: 'PORTAL_SITREP',
          estadoEntrega: 'REGISTRADO_EN_PORTAL',
          destinatario: 'INSPECCIONADO',
          metadata: {
            intercambioId: exchange.id,
            secuencia,
            contenidoSha256: digests.contenidoSha256,
            hashCadena: digests.hashCadena,
            expedienteLegal: input.expedienteLegal || null,
            adjuntosSha256: storedFiles.map(({ stored }) => stored.sha256),
            correoEnviado: false,
          },
        },
      });
      return exchange;
    });
    storedKeys.length = 0;
    const full = await prisma.intercambioInspeccion.findUniqueOrThrow({ where: { id: created.id }, include: exchangeInclude });
    res.json({ success: true, data: full, message: 'Decisión auditada en SITREP. No se envió correo electrónico.' });
  } catch (error) {
    await Promise.all(storedKeys.map((key) => removeInspectionEvidence(key).catch(() => undefined)));
    next(error);
  }
}

export async function descargarAdjuntoIntercambio(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const inspection = await prisma.inspeccion.findUnique({ where: { id: req.params.id }, select: inspectionAccessSelect });
    if (!inspection) throw new AppError('Inspección no encontrada', 404);
    assertExchangeAccess(req.user, inspection);
    const evidence = await prisma.evidenciaInspeccion.findFirst({
      where: {
        id: req.params.evidenciaId,
        inspeccionId: inspection.id,
        intercambioId: req.params.intercambioId,
        anuladaAt: null,
      },
    });
    if (!evidence) throw new AppError('Adjunto no encontrado', 404);
    res.setHeader('Content-Type', evidence.mimeDetectado);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(evidence.nombreOriginal)}`);
    res.sendFile(resolveInspectionEvidence(evidence.storageKey));
  } catch (error) { next(error); }
}
