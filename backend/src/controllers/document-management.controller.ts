import fs from 'fs';
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { Prisma, Rol, TipoDocumentoRegulatorio } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import { canAccessActor, isActorTypeAdmin, isRootAdmin, type ActorType } from '../utils/authorization';
import { config } from '../config/config';
import {
  atmFingerprintHmac,
  normalizeAtmReference,
  normalizeCuitDigits,
  normalizeDocumentIdentifier,
  sha256Buffer,
} from '../utils/documentNormalization';
import { persistDocumentFile, storageKeyPath } from '../services/documentStorage.service';
import { recognizeDocument } from '../utils/ocr';
import { buildStructuredOcrData } from '../utils/documentOcr';
import { sanitizeTefInputs } from '../utils/tef';
import { satisfiesDocumentRequirement } from '../utils/documentEligibility';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

/** Multer never writes an upload to a web-visible directory. */
export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    // This is only an early UX filter; documentStorage re-checks magic bytes.
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new AppError('Tipo de archivo no permitido. Solo PDF, JPG, PNG.', 400));
  },
});

const ACTOR_TYPES: ActorType[] = ['generador', 'transportista', 'operador'];

async function regulatoryActorAccess(documento: { generadorId: string | null; transportistaId: string | null; operadorId: string | null; vehiculoId?: string | null; choferId?: string | null }, user: AuthRequest['user'], mode: 'read' | 'write') {
  if (documento.generadorId) return canAccessActor(user, 'generador', documento.generadorId, mode) ? { type: 'generador' as const, id: documento.generadorId } : null;
  if (documento.transportistaId) return canAccessActor(user, 'transportista', documento.transportistaId, mode) ? { type: 'transportista' as const, id: documento.transportistaId } : null;
  if (documento.operadorId) return canAccessActor(user, 'operador', documento.operadorId, mode) ? { type: 'operador' as const, id: documento.operadorId } : null;
  if (documento.vehiculoId) {
    const vehicle = await prisma.vehiculo.findUnique({ where: { id: documento.vehiculoId }, select: { transportistaId: true } });
    return vehicle && canAccessActor(user, 'transportista', vehicle.transportistaId, mode) ? { type: 'transportista' as const, id: vehicle.transportistaId } : null;
  }
  if (documento.choferId) {
    const driver = await prisma.chofer.findUnique({ where: { id: documento.choferId }, select: { transportistaId: true } });
    return driver && canAccessActor(user, 'transportista', driver.transportistaId, mode) ? { type: 'transportista' as const, id: driver.transportistaId } : null;
  }
  return null;
}

const REQUIRED_DOCUMENTS: Record<string, Array<{
  tipo: TipoDocumentoRegulatorio;
  nombre: string;
  requiereVigencia: boolean;
  requiereFrenteDorso: boolean;
}>> = {
  GENERADOR: [
    { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP', requiereVigencia: false, requiereFrenteDorso: false },
    { tipo: 'MEMORIA_TECNICA', nombre: 'Memoria técnica', requiereVigencia: false, requiereFrenteDorso: false },
    { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Certificado de habilitación', requiereVigencia: true, requiereFrenteDorso: false },
  ],
  OPERADOR: [
    { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP', requiereVigencia: false, requiereFrenteDorso: false },
    { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Certificado de habilitación', requiereVigencia: true, requiereFrenteDorso: false },
    { tipo: 'RESOLUCION_DPA', nombre: 'Resolución DPA', requiereVigencia: false, requiereFrenteDorso: false },
  ],
  TRANSPORTISTA: [
    { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP', requiereVigencia: false, requiereFrenteDorso: false },
    { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Habilitación de transporte', requiereVigencia: true, requiereFrenteDorso: false },
    { tipo: 'SEGURO_AMBIENTAL', nombre: 'Seguro ambiental', requiereVigencia: true, requiereFrenteDorso: false },
  ],
};

export function requiredDocumentsFor(tipoActor: string) {
  return REQUIRED_DOCUMENTS[tipoActor] || [];
}

/** Resolve the active versioned policy, with a compatibility fallback before
 * the additive migration is deployed to a local/QA database. */
export async function getRequiredDocumentsFor(tipoActor: string) {
  const fallback = requiredDocumentsFor(tipoActor);
  try {
    const rows = await prisma.requisitoDocumental.findMany({
      where: { tipoActor: tipoActor as Rol, activo: true, obligatorio: true },
      orderBy: [{ version: 'desc' }, { tipo: 'asc' }],
      select: { tipo: true, requiereVigencia: true, requiereFrenteDorso: true },
    });
    if (!Array.isArray(rows) || rows.length === 0) return fallback;
    const names = new Map(fallback.map((item) => [item.tipo, item.nombre]));
    return rows.map((row) => ({
      tipo: row.tipo,
      nombre: names.get(row.tipo) || String(row.tipo).replace(/_/g, ' '),
      requiereVigencia: row.requiereVigencia,
      requiereFrenteDorso: row.requiereFrenteDorso,
    }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') return fallback;
    throw error;
  }
}

function asActorType(value: string): ActorType {
  const normalized = value.toLowerCase() as ActorType;
  if (!ACTOR_TYPES.includes(normalized)) throw new AppError('Tipo de actor invalido', 400);
  return normalized;
}

function parseOptionalDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new AppError(`${field} invalida`, 400);
  return date;
}

function parseAmountCents(value: unknown): bigint | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = String(value).trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new AppError('importe invalido', 400);
  const [whole, fraction = ''] = raw.split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}

async function actorExists(actorType: ActorType, actorId: string): Promise<boolean> {
  if (actorType === 'generador') return Boolean(await prisma.generador.findUnique({ where: { id: actorId }, select: { id: true } }));
  if (actorType === 'transportista') return Boolean(await prisma.transportista.findUnique({ where: { id: actorId }, select: { id: true } }));
  return Boolean(await prisma.operador.findUnique({ where: { id: actorId }, select: { id: true } }));
}

function exactActorSubject(actorType: ActorType, actorId: string): Record<string, string | null> {
  return {
    generadorId: actorType === 'generador' ? actorId : null,
    transportistaId: actorType === 'transportista' ? actorId : null,
    operadorId: actorType === 'operador' ? actorId : null,
  };
}

function handleUniqueConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError('DOCUMENTO_YA_REGISTRADO', 409);
  }
  throw error;
}

async function recordAtmAudit(req: AuthRequest, actorType: ActorType, actorId: string, accion: string): Promise<void> {
  await prisma.auditoria.create({
    data: {
      accion,
      modulo: 'DOCUMENTO',
      usuarioId: req.user?.id,
      [`${actorType}Id`]: actorId,
      datosDespues: JSON.stringify({ actorType, resultado: accion }),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    } as any,
  }).catch(() => undefined);
}

async function findAtmDuplicateWithRetry(input: {
  emisor: string;
  referenciaNormalizada: string;
  fingerprintHmac: string;
}, attempts = 5) {
  // A concurrent upload can lose the unique-index race while the winning
  // transaction is still committing. Give PostgreSQL a short window to make
  // the committed row visible before classifying the retry as a real conflict.
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const duplicate = await prisma.comprobanteATM.findFirst({
      where: { OR: [{ emisor: input.emisor, referenciaNormalizada: input.referenciaNormalizada }, { fingerprintHmac: input.fingerprintHmac }] },
      select: {
        id: true, generadorId: true, transportistaId: true, operadorId: true,
        documento: { select: { archivo: { select: { creadoPorId: true } } } },
      },
    }).catch(() => null);
    if (duplicate) return duplicate;
    if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
  }
  return null;
}

/** GET /solicitudes/:id/requisitos */
export const getSolicitudRequisitos = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const solicitud = await prisma.solicitudInscripcion.findUnique({
      where: { id: req.params.id },
      include: { documentos: { select: { id: true, tipo: true, cara: true, estado: true, estadoScan: true, archivoId: true, vigenteDesde: true, vigenteHasta: true } } },
    });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);
    if (!canAccessSolicitudDocument(req.user, solicitud.usuarioId, solicitud.tipoActor)) {
      throw new AppError('No tiene permisos sobre esta solicitud', 403);
    }
    const required = (await getRequiredDocumentsFor(solicitud.tipoActor)).map((requirement) => ({
      ...requirement,
      documentos: solicitud.documentos.filter((documento) => documento.tipo === requirement.tipo),
      completo: satisfiesDocumentRequirement(requirement, solicitud.documentos),
    }));
    res.json({ success: true, data: { requisitos: required } });
  } catch (error) { next(error); }
};

/** PUT /solicitudes/:id/secciones/:seccion */
export const updateSolicitudSection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const allowed: Record<string, 'datosActor' | 'datosResiduos' | 'datosTEF' | 'datosRegulatorio'> = {
      actor: 'datosActor', empresa: 'datosActor', residuos: 'datosResiduos', tef: 'datosTEF', regulatorio: 'datosRegulatorio',
    };
    const field = allowed[req.params.seccion.toLowerCase()];
    if (!field) throw new AppError('Seccion invalida', 400);
    const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id: req.params.id }, select: { usuarioId: true, estado: true, datosActor: true, datosResiduos: true, datosTEF: true, datosRegulatorio: true } });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);
    if (solicitud.usuarioId !== req.user!.id) throw new AppError('No tiene permisos sobre esta solicitud', 403);
    if (!['BORRADOR', 'OBSERVADA'].includes(solicitud.estado)) throw new AppError('La solicitud ya no admite cambios', 400);
    const value = req.body?.data ?? req.body?.value ?? req.body;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('La seccion debe ser un objeto', 400);
    // Sections are independently retryable: merge into the existing JSON
    // instead of replacing previous steps when a user autosaves out of order.
    const previousRaw = solicitud[field];
    let previous: Record<string, unknown> = {};
    if (previousRaw) {
      try {
        const parsed = JSON.parse(previousRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) previous = parsed;
      } catch { /* malformed legacy data is replaced by the typed section */ }
    }
    const merged = { ...previous, ...(value as Record<string, unknown>) };
    if (field === 'datosTEF') {
      merged.tefInputs = sanitizeTefInputs(merged.tefInputs);
      delete merged.factorR;
      delete merged.montoMxR;
      delete merged.TEF;
      delete merged.MxR;
      merged.estadoCalculo = 'PENDIENTE_LIQUIDACION';
    }
    const updated = await prisma.solicitudInscripcion.update({ where: { id: req.params.id }, data: { [field]: JSON.stringify(merged) } });
    res.json({ success: true, data: { solicitud: updated, seccion: req.params.seccion } });
  } catch (error) { next(error); }
};

/** POST /solicitudes/:id/documentos */
export const uploadSolicitudDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let storedPath: string | undefined;
  try {
    const { id } = req.params;
    const { tipo } = req.body;
    const cara = req.body.cara ? String(req.body.cara).toUpperCase() : null;
    if (cara && !['FRENTE', 'DORSO'].includes(cara)) throw new AppError('Cara de documento inválida', 400);
    const vigenteDesde = parseOptionalDate(req.body.vigenteDesde, 'vigenteDesde');
    const vigenteHasta = parseOptionalDate(req.body.vigenteHasta, 'vigenteHasta');
    if (vigenteDesde && vigenteHasta && vigenteDesde >= vigenteHasta) throw new AppError('El vencimiento debe ser posterior al inicio de vigencia', 400);
    if (!req.file) throw new AppError('No se envio ningun archivo', 400);
    if (!tipo || typeof tipo !== 'string') throw new AppError('El tipo de documento es obligatorio', 400);
    const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id }, select: { usuarioId: true, tipoActor: true, estado: true } });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);
    if (!canAccessSolicitudDocument(req.user, solicitud.usuarioId, solicitud.tipoActor)) throw new AppError('No tiene permisos sobre esta solicitud', 403);
    if (!['BORRADOR', 'OBSERVADA'].includes(solicitud.estado)) throw new AppError('La solicitud ya no admite documentos', 400);

    const sha256 = sha256Buffer(req.file.buffer);
    const existing = await prisma.archivoBinario.findUnique({ where: { sha256 }, include: { documentosSolicitud: true } });
    if (existing) {
      const sameRequest = existing.documentosSolicitud.find((documento) => documento.solicitudId === id && documento.tipo === tipo && documento.cara === cara);
      if (sameRequest) return res.status(200).json({ success: true, data: { documento: sameRequest, idempotent: true } });
      throw new AppError('DOCUMENTO_YA_REGISTRADO', 409);
    }

    const stored = await persistDocumentFile(req.file, ['solicitudes', id]);
    storedPath = stored.path;
    const storageKey = `solicitudes/${id}/${stored.storageKey}`;
    const documento = await prisma.$transaction(async (tx) => {
      const archivo = await tx.archivoBinario.create({
        data: {
          storageKey,
          nombreOriginal: req.file!.originalname,
          mimeDetectado: stored.mimeType,
          bytes: stored.size,
          sha256: stored.sha256,
          estadoScan: 'LIMPIO',
          motorScan: config.FILE_SCAN_MODE === 'required' ? 'clamav' : 'disabled-test-mode',
          escaneadoAt: new Date(),
          creadoPorId: req.user!.id,
        },
      });
      return tx.documentoSolicitud.create({
        data: {
          solicitudId: id,
          archivoId: archivo.id,
          tipo,
          cara,
          vigenteDesde,
          vigenteHasta,
          nombre: req.body?.cara
            ? `${req.file!.originalname} [${String(req.body.cara).toUpperCase()}]`
            : req.file!.originalname,
          path: storageKey,
          mimeType: stored.mimeType,
          size: stored.size,
          sha256: stored.sha256,
          estado: 'PENDIENTE',
          estadoScan: 'LIMPIO',
        },
      });
    });
    res.status(201).json({ success: true, data: { documento } });
  } catch (error) {
    if (storedPath) await fs.promises.rm(storedPath, { force: true }).catch(() => undefined);
    try { handleUniqueConflict(error); } catch (handled) { return next(handled); }
    next(error);
  }
};

/** POST /documentos/:id/ocr */
export const runDocumentOcr = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const documento = await prisma.documentoSolicitud.findUnique({ where: { id: req.params.id } });
    if (documento) {
      const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id: documento.solicitudId }, select: { usuarioId: true, tipoActor: true } });
      if (!solicitud || !canAccessSolicitudDocument(req.user, solicitud.usuarioId, solicitud.tipoActor)) throw new AppError('No tiene permisos sobre este documento', 403);
      // New uploads always carry the private ArchivoBinario relation. The
      // fallback to path is limited to rows created before the migration and
      // still passes through storageKeyPath (never a webroot URL).
      const archivo = documento.archivoId
        ? await prisma.archivoBinario.findUnique({ where: { id: documento.archivoId }, select: { storageKey: true } })
        : null;
      if (!archivo && !documento.path) throw new AppError('Archivo no encontrado', 404);
      const result = await recognizeDocument(storageKeyPath(archivo?.storageKey || documento.path));
      const datosOcr = buildStructuredOcrData({ tipo: documento.tipo, text: result.text, language: result.language, engine: result.engine });
      const updated = await prisma.documentoSolicitud.update({ where: { id: documento.id }, data: { datosOcr: datosOcr as unknown as Prisma.InputJsonObject, confianzaOcr: result.confidence } });
      return res.json({ success: true, data: { documento: updated, ocr: result } });
    }
    const regulatory = await prisma.documentoRegulatorio.findUnique({ where: { id: req.params.id }, include: { archivo: true } });
    if (!regulatory) throw new AppError('Documento no encontrado', 404);
    if (!await regulatoryActorAccess(regulatory, req.user, 'write')) throw new AppError('No tiene permisos sobre este documento', 403);
    const result = await recognizeDocument(storageKeyPath(regulatory.archivo.storageKey));
    const datosOcr = buildStructuredOcrData({ tipo: regulatory.tipo, text: result.text, language: result.language, engine: result.engine });
    const updated = await prisma.documentoRegulatorio.update({ where: { id: regulatory.id }, data: { datosOcr: datosOcr as unknown as Prisma.InputJsonObject, confianzaOcr: result.confidence } });
    return res.json({ success: true, data: { documento: updated, ocr: result } });
  } catch (error) { next(error); }
};

/** PATCH /documentos/:id/confirmar */
export const confirmDocumentOcr = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const documento = await prisma.documentoSolicitud.findUnique({ where: { id: req.params.id } });
    if (documento) {
      const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id: documento.solicitudId }, select: { usuarioId: true, tipoActor: true, estado: true } });
      if (!solicitud || !canAccessSolicitudDocument(req.user, solicitud.usuarioId, solicitud.tipoActor)) throw new AppError('No tiene permisos sobre este documento', 403);
      if (!['BORRADOR', 'OBSERVADA'].includes(solicitud.estado)) throw new AppError('La solicitud ya no admite cambios documentales', 400);
      const vigenteDesde = parseOptionalDate(req.body?.vigenteDesde, 'vigenteDesde') ?? documento.vigenteDesde;
      const vigenteHasta = parseOptionalDate(req.body?.vigenteHasta, 'vigenteHasta') ?? documento.vigenteHasta;
      if (vigenteDesde && vigenteHasta && vigenteDesde >= vigenteHasta) throw new AppError('Vigencia inválida', 400);
      const changed = vigenteDesde?.getTime() !== documento.vigenteDesde?.getTime() || vigenteHasta?.getTime() !== documento.vigenteHasta?.getTime() || req.body?.datosOcr !== undefined;
      const updated = await prisma.documentoSolicitud.update({
        where: { id: documento.id },
        data: { vigenteDesde, vigenteHasta, datosOcr: req.body?.datosOcr ?? documento.datosOcr, ...(changed && documento.estado === 'APROBADO' ? { estado: 'PENDIENTE', revisadoPor: null, revisadoAt: null } : {}) },
      });
      return res.json({ success: true, data: { documento: updated } });
    }

    // The same confirmation contract is used by transport documents. OCR is
    // only a suggestion: the actor/admin explicitly confirms the extracted
    // fields and (optionally) the validity dates/identifier on the real
    // regulatory subject. No approval state is changed here.
    const regulatory = await prisma.documentoRegulatorio.findUnique({ where: { id: req.params.id } });
    if (!regulatory) throw new AppError('Documento no encontrado', 404);
    if (!await regulatoryActorAccess(regulatory, req.user, 'write')) throw new AppError('No tiene permisos sobre este documento', 403);
    const updated = await prisma.documentoRegulatorio.update({
      where: { id: regulatory.id },
      data: {
        vigenteDesde: parseOptionalDate(req.body?.vigenteDesde, 'vigenteDesde'),
        vigenteHasta: parseOptionalDate(req.body?.vigenteHasta, 'vigenteHasta'),
        numeroNormalizado: req.body?.numeroNormalizado === undefined ? regulatory.numeroNormalizado : normalizeDocumentIdentifier(String(req.body.numeroNormalizado)),
        emisor: req.body?.emisor === undefined ? regulatory.emisor : normalizeDocumentIdentifier(String(req.body.emisor)),
        cara: req.body?.cara === undefined ? regulatory.cara : String(req.body.cara).toUpperCase(),
        datosOcr: req.body?.datosOcr ?? regulatory.datosOcr,
      },
    });
    return res.json({ success: true, data: { documento: updated } });
  } catch (error) { next(error); }
};

/** GET /documentos/:id/download */
export const downloadSolicitudDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const documento = await prisma.documentoSolicitud.findUnique({ where: { id: req.params.id } });
    if (documento) {
      const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id: documento.solicitudId }, select: { usuarioId: true, tipoActor: true } });
      if (!solicitud || !canAccessSolicitudDocument(req.user, solicitud.usuarioId, solicitud.tipoActor)) throw new AppError('No tiene permisos sobre este documento', 403);
      const storedPath = storageKeyPath(documento.path);
      if (!fs.existsSync(storedPath)) throw new AppError('Archivo no encontrado', 404);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(documento.nombre)}"`);
      res.setHeader('Content-Type', documento.mimeType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      return fs.createReadStream(storedPath).pipe(res);
    }
    const regulatory = await prisma.documentoRegulatorio.findUnique({ where: { id: req.params.id }, include: { archivo: true } });
    if (!regulatory) throw new AppError('Documento no encontrado', 404);
    if (!await regulatoryActorAccess(regulatory, req.user, 'read')) throw new AppError('No tiene permisos sobre este documento', 403);
    const storedPath = storageKeyPath(regulatory.archivo.storageKey);
    if (!fs.existsSync(storedPath)) throw new AppError('Archivo no encontrado', 404);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(regulatory.archivo.nombreOriginal)}"`);
    res.setHeader('Content-Type', regulatory.archivo.mimeDetectado);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    return fs.createReadStream(storedPath).pipe(res);
  } catch (error) { next(error); }
};

/** PATCH /admin/documentos/:id/revisar */
export const reviewSolicitudDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const estado = req.body?.estado;
    if (!['APROBADO', 'RECHAZADO'].includes(estado)) throw new AppError('Estado debe ser APROBADO o RECHAZADO', 400);
    // The legacy request route is nested as /solicitudes/:id/documentos/:docId,
    // while the new admin route is flat as /admin/documentos/:id/revisar.
    // Always review the document id, never the parent request id.  The route
    // middleware authorizes the parent request; this lookup then re-checks the
    // actual document subject and sector before mutating it.
    const documentId = req.params.docId || req.params.id;
    const documento = await prisma.documentoSolicitud.findUnique({ where: { id: documentId } });
    if (!documento) throw new AppError('Documento no encontrado', 404);
    const solicitud = await prisma.solicitudInscripcion.findUnique({
      where: { id: documento.solicitudId },
      select: { tipoActor: true },
    });
    if (!solicitud || !canReviewSolicitudType(req.user, solicitud.tipoActor)) {
      throw new AppError('No tiene permisos para revisar este documento', 403);
    }
    if (estado === 'APROBADO' && documento.estadoScan !== 'LIMPIO') throw new AppError('El archivo no esta limpio', 400);
    const updated = await prisma.documentoSolicitud.update({ where: { id: documento.id }, data: { estado, observaciones: req.body?.observaciones, revisadoPor: req.user!.id, revisadoAt: new Date() } });
    res.json({ success: true, data: { documento: updated } });
  } catch (error) { next(error); }
};

/**
 * DELETE /solicitudes/:id/documentos/:docId
 * Delete a draft/observed document without ever trusting the persisted path.
 * Files created by the new private storage are removed only after the database
 * reference is deleted; legacy paths outside the private root are never
 * followed or unlinked.
 */
export const deleteSolicitudDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: solicitudId, docId } = req.params;
    const [solicitud, documento] = await Promise.all([
      prisma.solicitudInscripcion.findUnique({ where: { id: solicitudId }, select: { usuarioId: true, estado: true } }),
      prisma.documentoSolicitud.findUnique({ where: { id: docId } }),
    ]);
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);
    if (!documento || documento.solicitudId !== solicitudId) throw new AppError('Documento no encontrado', 404);
    if (solicitud.usuarioId !== req.user!.id && !isAdminUser(req.user!.rol)) throw new AppError('No tiene permisos para eliminar este documento', 403);
    if (!['BORRADOR', 'OBSERVADA'].includes(solicitud.estado)) throw new AppError('La solicitud ya no admite cambios', 400);

    const privatePath = (() => {
      try { return storageKeyPath(documento.path); } catch { return null; }
    })();
    const archivoId = documento.archivoId;
    await prisma.$transaction(async (tx) => {
      await tx.documentoSolicitud.delete({ where: { id: documento.id } });
      if (archivoId) {
        const [regulatoryCount, requestCount] = await Promise.all([
          tx.documentoRegulatorio.count({ where: { archivoId } }),
          tx.documentoSolicitud.count({ where: { archivoId } }),
        ]);
        if (regulatoryCount === 0 && requestCount === 0) {
          await tx.archivoBinario.delete({ where: { id: archivoId } }).catch(() => undefined);
        }
      }
    });
    if (privatePath) await fs.promises.rm(privatePath, { force: true }).catch(() => undefined);
    res.json({ success: true, message: 'Documento eliminado' });
  } catch (error) { next(error); }
};

/** Sector administrators may review only applications from their own sector. */
export function canReviewSolicitudType(user: AuthRequest['user'] | undefined, tipoActor: string): boolean {
  if (!user) return false;
  if (user.rol === 'ADMIN') return true;
  return (tipoActor === 'GENERADOR' && user.rol === 'ADMIN_GENERADOR')
    || (tipoActor === 'TRANSPORTISTA' && user.rol === 'ADMIN_TRANSPORTISTA')
    || (tipoActor === 'OPERADOR' && user.rol === 'ADMIN_OPERADOR');
}

/**
 * A document endpoint receives only a document id, so it must recover the
 * request subject before authorizing. Owners can continue their own draft;
 * sector administrators can operate only on their sector and the root admin
 * can operate across sectors. This prevents an admin role from becoming a
 * blanket document capability through /documentos/:id.
 */
export function canAccessSolicitudDocument(
  user: AuthRequest['user'] | undefined,
  solicitudUsuarioId: string,
  tipoActor: string,
): boolean {
  if (!user) return false;
  if (user.id === solicitudUsuarioId) return true;
  return canReviewSolicitudType(user, tipoActor);
}

/** POST /transportistas/:id/(vehiculos|choferes)/:subjectId/documentos */
export const listActorDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transportistaId = req.params.id;
    const subjectType = req.params.subjectType === 'vehiculos' ? 'vehiculo' : req.params.subjectType === 'choferes' ? 'chofer' : null;
    const subjectId = req.params.subjectId;
    if (!subjectType || !subjectId) throw new AppError('Sujeto documental invalido', 400);
    if (!canAccessActor(req.user, 'transportista', transportistaId, 'read')) throw new AppError('No tiene permisos sobre este transportista', 403);
    const subject = subjectType === 'vehiculo'
      ? await prisma.vehiculo.findFirst({ where: { id: subjectId, transportistaId }, select: { id: true } })
      : await prisma.chofer.findFirst({ where: { id: subjectId, transportistaId }, select: { id: true } });
    if (!subject) throw new AppError('Sujeto no encontrado', 404);
    const documentos = await prisma.documentoRegulatorio.findMany({
      where: subjectType === 'vehiculo' ? { vehiculoId: subjectId } : { choferId: subjectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, tipo: true, estado: true, cara: true, vigenteDesde: true,
        vigenteHasta: true, datosOcr: true, confianzaOcr: true, revisadoAt: true, motivoRechazo: true,
        archivo: { select: { id: true, nombreOriginal: true, mimeDetectado: true, bytes: true, sha256: true } },
      },
    });
    // Deliberately omit storageKey, filesystem paths and the original binary
    // from this listing. OCR text is only exposed after subject authorization;
    // downloads still go through the authenticated document endpoint.
    res.json({ success: true, data: { documentos } });
  } catch (error) { next(error); }
};

/** POST /transportistas/:id/(vehiculos|choferes)/:subjectId/documentos */
export const uploadActorDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let storedPath: string | undefined;
  try {
    const transportistaId = req.params.id;
    const subjectType = req.params.subjectType === 'vehiculos' ? 'vehiculo' : req.params.subjectType === 'choferes' ? 'chofer' : null;
    const subjectId = req.params.subjectId;
    if (!subjectType || !subjectId) throw new AppError('Sujeto documental invalido', 400);
    if (!canAccessActor(req.user, 'transportista', transportistaId, 'write')) throw new AppError('No tiene permisos sobre este transportista', 403);
    if (!req.file) throw new AppError('No se envio ningun archivo', 400);
    const subject = subjectType === 'vehiculo'
      ? await prisma.vehiculo.findFirst({ where: { id: subjectId, transportistaId }, select: { id: true } })
      : await prisma.chofer.findFirst({ where: { id: subjectId, transportistaId }, select: { id: true } });
    if (!subject) throw new AppError('Sujeto no encontrado', 404);
    const tipo = String(req.body?.tipo || (subjectType === 'vehiculo' ? 'TARJETA_IDENTIFICACION_VEHICULO' : 'LICENCIA_CONDUCIR')) as TipoDocumentoRegulatorio;
    if (!['TARJETA_IDENTIFICACION_VEHICULO', 'AUTORIZACION_USO_VEHICULO', 'LICENCIA_CONDUCIR'].includes(tipo)) throw new AppError('Tipo documental no permitido para este sujeto', 400);
    const stored = await persistDocumentFile(req.file, ['transportistas', transportistaId, subjectType, subjectId]);
    storedPath = stored.path;
    const shaDuplicate = await prisma.archivoBinario.findUnique({ where: { sha256: stored.sha256 }, select: { id: true } });
    if (shaDuplicate) throw new AppError('DOCUMENTO_YA_REGISTRADO', 409);
    const documento = await prisma.$transaction(async (tx) => {
      const archivo = await tx.archivoBinario.create({ data: { storageKey: `transportistas/${transportistaId}/${subjectType}/${subjectId}/${stored.storageKey}`, nombreOriginal: req.file!.originalname, mimeDetectado: stored.mimeType, bytes: stored.size, sha256: stored.sha256, estadoScan: 'LIMPIO', motorScan: config.FILE_SCAN_MODE === 'required' ? 'clamav' : 'disabled-test-mode', escaneadoAt: new Date(), creadoPorId: req.user!.id } });
      return tx.documentoRegulatorio.create({ data: { archivoId: archivo.id, tipo, estado: 'PENDIENTE', ...(subjectType === 'vehiculo' ? { vehiculoId: subjectId } : { choferId: subjectId }), cara: req.body?.cara ? String(req.body.cara).toUpperCase() : undefined } as any });
    });
    return res.status(201).json({ success: true, data: { documento } });
  } catch (error) {
    if (storedPath) await fs.promises.rm(storedPath, { force: true }).catch(() => undefined);
    try { handleUniqueConflict(error); } catch (handled) { return next(handled); }
    next(error);
  }
};

export const reviewRegulatoryDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const documento = await prisma.documentoRegulatorio.findUnique({ where: { id: req.params.id } });
    if (!documento) throw new AppError('Documento no encontrado', 404);
    let canReview = isRootAdmin(req.user);
    if (!canReview && documento.generadorId) canReview = isActorTypeAdmin(req.user, 'generador');
    if (!canReview && documento.transportistaId) canReview = isActorTypeAdmin(req.user, 'transportista');
    if (!canReview && documento.operadorId) canReview = isActorTypeAdmin(req.user, 'operador');
    if (!canReview && documento.vehiculoId) {
      const vehicle = await prisma.vehiculo.findUnique({ where: { id: documento.vehiculoId }, select: { transportistaId: true } });
      canReview = Boolean(vehicle && isActorTypeAdmin(req.user, 'transportista'));
    }
    if (!canReview && documento.choferId) {
      const driver = await prisma.chofer.findUnique({ where: { id: documento.choferId }, select: { transportistaId: true } });
      canReview = Boolean(driver && isActorTypeAdmin(req.user, 'transportista'));
    }
    if (!canReview) throw new AppError('No tiene permisos para revisar este documento', 403);
    const estado = req.body?.estado;
    if (!['APROBADO', 'RECHAZADO'].includes(estado)) throw new AppError('Estado debe ser APROBADO o RECHAZADO', 400);
    const updated = await prisma.documentoRegulatorio.update({ where: { id: documento.id }, data: { estado, motivoRechazo: estado === 'RECHAZADO' ? String(req.body?.motivoRechazo || 'Sin detalle') : null, revisadoPorId: req.user!.id, revisadoAt: new Date() } });
    return res.json({ success: true, data: { documento: updated } });
  } catch (error) { next(error); }
};

const GENERIC_REGULATORY_TYPES = new Set<TipoDocumentoRegulatorio>([
  'CONSTANCIA_AFIP', 'HABILITACION_ACTOR', 'SEGURO_AMBIENTAL',
  'MEMORIA_TECNICA', 'RESOLUCION_DPA', 'CERTIFICADO_HABILITACION',
  'TARJETA_IDENTIFICACION_VEHICULO', 'AUTORIZACION_USO_VEHICULO', 'LICENCIA_CONDUCIR', 'OTRO',
]);

/** GET /actores/:tipo/:id/documentos-regulatorios */
export const listActorRegulatoryDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actorType = asActorType(req.params.tipo);
    const actorId = req.params.id;
    if (!canAccessActor(req.user, actorType, actorId, 'read')) throw new AppError('No tiene permisos sobre este actor', 403);
    const relation = exactActorSubject(actorType, actorId);
    const [documentos, requisitosBase, credenciales] = await Promise.all([
      prisma.documentoRegulatorio.findMany({
        where: relation as Prisma.DocumentoRegulatorioWhereInput,
        orderBy: { createdAt: 'desc' },
        select: { id: true, tipo: true, estado: true, cara: true, emitidoAt: true, vigenteDesde: true, vigenteHasta: true, datosOcr: true, confianzaOcr: true, revisadoAt: true, motivoRechazo: true, archivo: { select: { id: true, nombreOriginal: true, mimeDetectado: true, bytes: true, sha256: true, estadoScan: true } } },
      }),
      getRequiredDocumentsFor(actorType.toUpperCase()),
      prisma.credencialActor.findMany({ where: relation as Prisma.CredencialActorWhereInput, include: { emisiones: { orderBy: { emitidoAt: 'desc' }, take: 1, select: { id: true, serial: true, emitidoAt: true, pdfSha256: true } } }, orderBy: { createdAt: 'desc' } }),
    ]);
    const now = new Date();
    const requisitos = requisitosBase.map((requirement) => ({
      ...requirement,
      completo: satisfiesDocumentRequirement(requirement, documentos.map(documento => ({ ...documento, archivoId: documento.archivo.id, estadoScan: documento.archivo.estadoScan })), now),
    }));
    res.json({ success: true, data: { documentos, requisitos, credenciales } });
  } catch (error) { next(error); }
};

/** POST /actores/:tipo/:id/documentos-regulatorios */
export const uploadActorRegulatoryDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let storedPath: string | undefined;
  try {
    const actorType = asActorType(req.params.tipo);
    const actorId = req.params.id;
    if (!canAccessActor(req.user, actorType, actorId, 'write')) throw new AppError('No tiene permisos sobre este actor', 403);
    if (!req.file) throw new AppError('No se envio ningun archivo', 400);
    const tipo = String(req.body?.tipo || '') as TipoDocumentoRegulatorio;
    if (!GENERIC_REGULATORY_TYPES.has(tipo)) throw new AppError('Tipo documental no permitido para este actor', 400);
    const stored = await persistDocumentFile(req.file, ['actores', actorType, actorId, 'regulatorios']);
    storedPath = stored.path;
    const relation = exactActorSubject(actorType, actorId);
    const documento = await prisma.$transaction(async tx => {
      const archivo = await tx.archivoBinario.create({ data: { storageKey: `actores/${actorType}/${actorId}/regulatorios/${stored.storageKey}`, nombreOriginal: req.file!.originalname, mimeDetectado: stored.mimeType, bytes: stored.size, sha256: stored.sha256, estadoScan: 'LIMPIO', motorScan: config.FILE_SCAN_MODE === 'required' ? 'clamav' : 'disabled-test-mode', escaneadoAt: new Date(), creadoPorId: req.user!.id } });
      return tx.documentoRegulatorio.create({ data: { archivoId: archivo.id, tipo, estado: 'PENDIENTE', cara: req.body?.cara ? String(req.body.cara).toUpperCase() : undefined, vigenteDesde: parseOptionalDate(req.body?.vigenteDesde, 'vigenteDesde'), vigenteHasta: parseOptionalDate(req.body?.vigenteHasta, 'vigenteHasta'), emisor: req.body?.emisor ? normalizeDocumentIdentifier(req.body.emisor) : undefined, numeroNormalizado: req.body?.numero ? normalizeDocumentIdentifier(req.body.numero) : undefined, ...relation } as any });
    });
    res.status(201).json({ success: true, data: { documento } });
  } catch (error) {
    if (storedPath) await fs.promises.rm(storedPath, { force: true }).catch(() => undefined);
    try { handleUniqueConflict(error); } catch (handled) { return next(handled); }
    next(error);
  }
};

/** POST /actores/:tipo/:id/comprobantes-atm */
export const createAtmReceipt = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let storedPath: string | undefined;
  let auditActorType: ActorType | null = null;
  let auditActorId = '';
  let dedupeEmisor = '';
  let dedupeReference = '';
  let dedupeFingerprint = '';
  try {
    const actorType = asActorType(req.params.tipo);
    const actorId = req.params.id;
    auditActorType = actorType;
    auditActorId = actorId;
    if (!canAccessActor(req.user, actorType, actorId, 'write')) throw new AppError('No tiene permisos sobre este actor', 403);
    if (!await actorExists(actorType, actorId)) throw new AppError('Actor no encontrado', 404);
    if (!req.file) throw new AppError('El comprobante ATM es obligatorio', 400);
    const referenciaNormalizada = normalizeAtmReference(req.body?.referencia);
    const emisor = normalizeDocumentIdentifier(req.body?.emisor);
    if (!referenciaNormalizada || !emisor) throw new AppError('Emisor y referencia ATM son obligatorios', 400);
    dedupeEmisor = emisor;
    dedupeReference = referenciaNormalizada;
    const fechaPago = parseOptionalDate(req.body?.fechaPago, 'fechaPago');
    const importeCentavos = parseAmountCents(req.body?.importe);
    const fingerprintHmac = atmFingerprintHmac({ issuer: emisor, reference: referenciaNormalizada, cuit: req.body?.cuit, amountCents: importeCentavos, period: req.body?.periodo, paidAt: fechaPago }, config.DOCUMENT_HMAC_SECRET);
    dedupeFingerprint = fingerprintHmac;
    const existing = await prisma.comprobanteATM.findFirst({
      where: { OR: [{ emisor, referenciaNormalizada }, { fingerprintHmac }] },
      select: {
        id: true, generadorId: true, transportistaId: true, operadorId: true,
        documento: { select: { archivo: { select: { creadoPorId: true } } } },
      },
    });
    if (existing) {
      const sameActor = existing[`${actorType}Id`] === actorId;
      const sameUser = existing.documento.archivo.creadoPorId === req.user!.id;
      if (sameActor && sameUser) {
        return res.status(200).json({ success: true, data: { comprobanteId: existing.id, idempotent: true } });
      }
      throw new AppError('DOCUMENTO_YA_REGISTRADO', 409);
    }
    const stored = await persistDocumentFile(req.file, ['actores', actorType, actorId, 'atm']);
    storedPath = stored.path;
    const result = await prisma.$transaction(async (tx) => {
      const archivo = await tx.archivoBinario.create({ data: { storageKey: `actores/${actorType}/${actorId}/atm/${stored.storageKey}`, nombreOriginal: req.file!.originalname, mimeDetectado: stored.mimeType, bytes: stored.size, sha256: stored.sha256, estadoScan: 'LIMPIO', motorScan: config.FILE_SCAN_MODE === 'required' ? 'clamav' : 'disabled-test-mode', escaneadoAt: new Date(), creadoPorId: req.user!.id } });
      const documento = await tx.documentoRegulatorio.create({ data: { archivoId: archivo.id, tipo: 'ATM_COMPROBANTE_SELLADO', estado: 'PENDIENTE', emisor, numeroNormalizado: referenciaNormalizada, ...exactActorSubject(actorType, actorId) } as any });
      const comprobante = await tx.comprobanteATM.create({ data: { documentoId: documento.id, emisor, referenciaNormalizada, cuitContribuyente: normalizeCuitDigits(req.body?.cuit) || undefined, concepto: req.body?.concepto, periodo: req.body?.periodo ? normalizeDocumentIdentifier(req.body.periodo) : undefined, fechaPago, importeCentavos, fingerprintHmac, ...exactActorSubject(actorType, actorId) } as any });
      return { documento, comprobante };
    });
    // Prisma returns BigInt for fiscal cents; Express cannot JSON-serialize
    // it directly. Keep the wire contract explicit and lossless as a string.
    const comprobante = result.comprobante.importeCentavos === null || result.comprobante.importeCentavos === undefined
      ? result.comprobante
      : { ...result.comprobante, importeCentavos: result.comprobante.importeCentavos.toString() };
    res.status(201).json({ success: true, data: { ...result, comprobante } });
  } catch (error) {
    if (storedPath) await fs.promises.rm(storedPath, { force: true }).catch(() => undefined);
    try { handleUniqueConflict(error); } catch (handled) {
      if (handled instanceof AppError && handled.statusCode === 409) {
        // A concurrent retry can lose the unique-index race after the first
        // request commits. Resolve it as idempotent for the same actor, but
        // keep a generic 409 for another actor without revealing ownership.
        const actorType = auditActorType || asActorType(req.params.tipo);
        const duplicate = await findAtmDuplicateWithRetry({
          emisor: dedupeEmisor,
          referenciaNormalizada: dedupeReference,
          fingerprintHmac: dedupeFingerprint,
        });
        if (duplicate && duplicate[`${actorType}Id`] === (auditActorId || req.params.id) && duplicate.documento.archivo.creadoPorId === req.user!.id) {
          return res.status(200).json({ success: true, data: { comprobanteId: duplicate.id, idempotent: true } });
        }
        await recordAtmAudit(req, actorType, auditActorId || req.params.id, 'ATM_DUPLICADO');
      }
      return next(handled);
    }
    next(error);
  }
};

export const getActorCredentials = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actorType = asActorType(req.params.tipo);
    const actorId = req.params.id;
    if (!canAccessActor(req.user, actorType, actorId, 'read')) throw new AppError('No tiene permisos sobre este actor', 403);
    const where = actorType === 'generador' ? { generadorId: actorId } : actorType === 'transportista' ? { transportistaId: actorId } : { operadorId: actorId };
    const credenciales = await prisma.credencialActor.findMany({ where, include: { emisiones: { orderBy: { emitidoAt: 'desc' }, take: 1, select: { id: true, serial: true, emitidoAt: true, pdfSha256: true } } }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: { credenciales } });
  } catch (error) { next(error); }
};

function isAdminUser(rol: Rol | string): boolean {
  return ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'].includes(String(rol));
}
