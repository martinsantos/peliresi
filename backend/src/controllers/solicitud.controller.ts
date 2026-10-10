import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Rol } from '@prisma/client';
import prisma from '../lib/prisma';
import logger from '../utils/logger';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emailService } from '../services/email.service';
import { generateTokens } from './auth.controller';
import { registrationActorFields } from '../domain/registrationActorData';
import { registrationFleet, declaredLicenseDocument, isLicenseDocument } from '../domain/registrationFleet';
import { licenseFields } from '../domain/licenseReading';
import { describeDocument, readReceipt, mergeReceiptRead, receiptDuplicate, receiptNotice, retainReceiptDigest } from '../services/documentAnalysis.service';
import {
  getMissingRequiredDocumentTypes,
  getSolicitudRequirements,
  isSolicitudActorType,
  SOLICITUD_DOCUMENT_ACCEPT,
  SOLICITUD_DOCUMENT_MAX_BYTES,
} from '../services/solicitudRequirements.service';

// ── CUIT normalization (same pattern as auth.controller) ────────────
function normalizeCuit(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length !== 11) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

// ── Password strength validation (same pattern as auth.controller) ──
function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'La contrasena debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contrasena debe contener al menos una mayuscula';
  if (!/[0-9]/.test(password)) return 'La contrasena debe contener al menos un numero';
  return null;
}

// ── Multer setup for document uploads ───────────────────────────────
const uploadDir = path.join(process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'), 'solicitudes');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});
const SOLICITUD_DOCUMENT_MIMES = new Set<string>(SOLICITUD_DOCUMENT_ACCEPT);
export const upload = multer({
  storage,
  limits: { fileSize: SOLICITUD_DOCUMENT_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (SOLICITUD_DOCUMENT_MIMES.has(file.mimetype)) callback(null, true);
    else callback(new AppError('Tipo de archivo no permitido. Solo PDF, JPG o PNG.', 400));
  },
});

// Helper: check if user is an admin role
const ADMIN_ROLES = ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA'];
function isAdmin(rol: string): boolean {
  return ADMIN_ROLES.includes(rol);
}

function assertReviewPermission(req: AuthRequest, solicitud: { tipoActor: string }) {
  if (!req.user || req.user.restricted || !['ADMIN', `ADMIN_${solicitud.tipoActor}`].includes(req.user.rol)) {
    throw new AppError('No tiene permisos para modificar una solicitud de este sector', 403);
  }
}

function jsonObject(value: unknown, allowArray = false): string {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { throw new AppError('Los datos deben ser un objeto JSON válido', 400); }
  }
  if (!parsed || typeof parsed !== 'object' || (!allowArray && Array.isArray(parsed))) throw new AppError('Los datos deben ser un objeto JSON válido', 400);
  return JSON.stringify(parsed);
}

// =====================================================================
// PUBLIC (no auth)
// =====================================================================

/**
 * GET /solicitudes/requisitos/:tipoActor
 * Canonical document requirements consumed by both the UI and submit validation.
 */
export const getRequisitosSolicitud = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tipoActor = String(req.params.tipoActor || '').toUpperCase();
    if (!isSolicitudActorType(tipoActor)) {
      throw new AppError('tipoActor debe ser GENERADOR, OPERADOR o TRANSPORTISTA', 400);
    }

    res.json({
      success: true,
      data: {
        tipoActor,
        documentos: getSolicitudRequirements(tipoActor),
        acceptedMimeTypes: [...SOLICITUD_DOCUMENT_ACCEPT],
        maxBytes: SOLICITUD_DOCUMENT_MAX_BYTES,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /solicitudes/iniciar
 * Create user (activo:false) + SolicitudInscripcion (BORRADOR)
 */
export const iniciarSolicitud = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, nombre, tipoActor, cuit } = req.body;

    // Validate required fields
    if (!email || !password || !nombre || !tipoActor || !cuit) {
      throw new AppError('email, password, nombre, tipoActor y cuit son obligatorios', 400);
    }

    if (!['GENERADOR', 'OPERADOR', 'TRANSPORTISTA'].includes(tipoActor)) {
      throw new AppError('tipoActor debe ser GENERADOR, OPERADOR o TRANSPORTISTA', 400);
    }

    // Email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError('Email invalido', 400);
    }

    // Password strength
    const passwordError = validatePasswordStrength(password);
    if (passwordError) throw new AppError(passwordError, 400);

    // CUIT normalization
    const normalizedCuit = normalizeCuit(cuit);
    if (!normalizedCuit) throw new AppError('CUIT invalido (debe tener 11 digitos)', 400);

    // Check email uniqueness
    const existingByEmail = await prisma.usuario.findUnique({ where: { email } });
    if (existingByEmail) throw new AppError('El correo electronico ya esta en uso', 400);

    // Check CUIT uniqueness
    const existingByCuit = await prisma.usuario.findUnique({ where: { cuit: normalizedCuit } });
    if (existingByCuit) throw new AppError('El CUIT ya esta registrado', 400);

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Email verification token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Create user + solicitud in transaction
    const result = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          email,
          password: hashedPassword,
          rol: tipoActor as Rol,
          nombre,
          cuit: normalizedCuit,
          activo: false,
          emailVerified: false,
          emailVerificationToken: hashedToken,
        },
      });

      const solicitud = await tx.solicitudInscripcion.create({
        data: {
          usuarioId: usuario.id,
          tipoActor,
          estado: 'BORRADOR',
          datosActor: JSON.stringify({ nombre, cuit: normalizedCuit, email }),
        },
      });

      return { usuario, solicitud };
    });

    // Limited to this draft by isAuthenticated; it is not a full user login.
    const tokens = generateTokens(result.usuario.id, true, result.solicitud.id);

    // Send email verification (fire-and-forget, don't block)
    emailService.sendEmailVerification(email, nombre, rawToken).catch((err) => {
      logger.error({ err }, 'Error enviando email de verificacion de solicitud');
    });

    res.status(201).json({
      success: true,
      data: { solicitudId: result.solicitud.id, tokens },
      message: 'Solicitud creada. Revisa tu email para verificar tu cuenta.',
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================================
// CANDIDATE AUTH (isAuthenticated)
// =====================================================================

/**
 * GET /solicitudes/mis-solicitudes
 * List own solicitudes
 */
export const getMisSolicitudes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const solicitudes = await prisma.solicitudInscripcion.findMany({
      where: { usuarioId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        documentos: { select: { id: true, tipo: true, nombre: true, estado: true, createdAt: true } },
        _count: { select: { mensajes: true } },
      },
    });

    res.json({ success: true, data: { solicitudes } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /solicitudes/:id
 * Detail (check ownership OR admin)
 */
export const getSolicitud = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const solicitud = await prisma.solicitudInscripcion.findUnique({
      where: { id },
      include: {
        usuario: { select: { id: true, email: true, nombre: true, cuit: true } },
        documentos: true,
        mensajes: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);

    // Check ownership or admin
    if (solicitud.usuarioId !== req.user!.id && !isAdmin(req.user!.rol)) {
      throw new AppError('No tiene permisos para ver esta solicitud', 403);
    }

    res.json({ success: true, data: { solicitud } });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /solicitudes/:id
 * Update wizard data (only BORRADOR/OBSERVADA, check ownership)
 */
export const updateSolicitud = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { datosActor, datosResiduos, datosTEF, datosRegulatorio, expectedUpdatedAt } = req.body;
    if (expectedUpdatedAt !== undefined && (typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt)))) throw new AppError('La versión del borrador es inválida', 400);

    const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id } });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);

    if (solicitud.usuarioId !== req.user!.id) {
      throw new AppError('No tiene permisos para editar esta solicitud', 403);
    }

    if (!['BORRADOR', 'OBSERVADA'].includes(solicitud.estado)) {
      throw new AppError('Solo se pueden editar solicitudes en estado BORRADOR u OBSERVADA', 400);
    }

    const data: any = {};
    if (datosActor !== undefined) data.datosActor = jsonObject(datosActor);
    if (datosResiduos !== undefined) data.datosResiduos = jsonObject(datosResiduos, true);
    if (datosTEF !== undefined) data.datosTEF = jsonObject(datosTEF);
    if (datosRegulatorio !== undefined) data.datosRegulatorio = jsonObject(datosRegulatorio);

    const updated = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM solicitudes_inscripcion WHERE id = ${id} FOR UPDATE`;
      const current = await tx.solicitudInscripcion.findUnique({ where: { id } });
      if (!current || !['BORRADOR', 'OBSERVADA'].includes(current.estado)) throw new AppError('La solicitud ya no admite cambios', 409);
      if (expectedUpdatedAt !== undefined && current.updatedAt.toISOString() !== expectedUpdatedAt) throw new AppError('El borrador cambió en SITREP. Recuperá la versión actual antes de guardar; tus cambios siguen en pantalla.', 409);
      // Monotonic even when two serialized edits land in the same millisecond.
      return tx.solicitudInscripcion.update({ where: { id }, data: { ...data, updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) } });
    });

    res.json({ success: true, data: { solicitud: updated } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /solicitudes/:id/datos-revision
 * Correct declarations during administrative review, with revision and history.
 */
export const editarDatosRevision = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { datosActor, expectedUpdatedAt } = req.body;
    if (typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt))) throw new AppError('Recuperá la versión actual antes de corregir los datos.', 400);
    const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id }, include: { usuario: { select: { cuit: true } } } });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);
    assertReviewPermission(req, solicitud);
    const changes = JSON.parse(jsonObject(datosActor));
    const updated = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM solicitudes_inscripcion WHERE id = ${id} FOR UPDATE`;
      const current = await tx.solicitudInscripcion.findUnique({ where: { id } });
      if (!current || current.estado !== 'EN_REVISION' || current.updatedAt.toISOString() !== expectedUpdatedAt) throw new AppError('La solicitud cambió o ya no está en revisión. Actualizá antes de guardar; tus cambios siguen en pantalla.', 409);
      const previous = JSON.parse(jsonObject(current.datosActor));
      const corrected = { ...previous, ...changes };
      if (corrected.cuit && normalizeCuit(String(corrected.cuit)) !== solicitud.usuario.cuit) throw new AppError('El CUIT debe seguir correspondiendo a la cuenta solicitante.', 400);
      registrationActorFields(solicitud.tipoActor, corrected);
      const saved = await tx.solicitudInscripcion.update({ where: { id }, data: { datosActor: JSON.stringify(corrected), updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) } });
      await tx.auditoria.create({ data: { accion: 'UPDATE', modulo: 'SOLICITUD', usuarioId: req.user!.id,
        datosAntes: JSON.stringify({ solicitudId: id, datosActor: previous }), datosDespues: JSON.stringify({ solicitudId: id, datosActor: corrected }), ip: req.ip, userAgent: req.headers['user-agent'] } });
      return saved;
    });
    res.json({ success: true, data: { solicitud: updated } });
  } catch (error) { next(error); }
};

/** BORRADOR/OBSERVADA -> ENVIADA. Validate required data and documents. */
export const enviarSolicitud = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updated = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM solicitudes_inscripcion WHERE id = ${id} FOR UPDATE`;
    const solicitud = await tx.solicitudInscripcion.findUnique({
      where: { id },
      include: {
        usuario: { select: { email: true, nombre: true } },
        documentos: { select: { tipo: true, estado: true } },
      },
    });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);

    if (solicitud.usuarioId !== req.user!.id) {
      throw new AppError('No tiene permisos para enviar esta solicitud', 403);
    }
    if (solicitud.estado === 'ENVIADA') return solicitud;

    if (!['BORRADOR', 'OBSERVADA'].includes(solicitud.estado)) {
      throw new AppError('Solo se pueden enviar solicitudes en estado BORRADOR u OBSERVADA', 400);
    }

    // Validate required data
    if (!solicitud.datosActor) {
      throw new AppError('Datos del actor son obligatorios', 400);
    }

    const datosActor = JSON.parse(jsonObject(solicitud.datosActor));
    registrationActorFields(solicitud.tipoActor, datosActor);
    if (solicitud.tipoActor === 'TRANSPORTISTA') registrationFleet(datosActor);
    if (!datosActor.razonSocial && !datosActor.nombre) {
      throw new AppError('La razon social o nombre es obligatorio', 400);
    }
    if (!datosActor.cuit) {
      throw new AppError('El CUIT es obligatorio', 400);
    }
    if (!datosActor.domicilio) {
      throw new AppError('El domicilio es obligatorio', 400);
    }

    const missingTypes = getMissingRequiredDocumentTypes(
      solicitud.tipoActor,
      solicitud.documentos.filter(documento => documento.estado !== 'RECHAZADO').map((documento) => documento.tipo),
    );
    if (missingTypes.length > 0) {
      const namesByType = new Map(getSolicitudRequirements(solicitud.tipoActor).map((item) => [item.tipo, item.nombre]));
      const missingNames = missingTypes.map((type) => namesByType.get(type) || type).join(', ');
      throw new AppError(`Faltan documentos obligatorios: ${missingNames}`, 400);
    }

    const saved = await tx.solicitudInscripcion.update({
      where: { id },
      data: {
        estado: 'ENVIADA',
        fechaEnvio: new Date(),
      },
    });

    // Notify admins via in-app notification
    const admins = await tx.usuario.findMany({
      where: { rol: { in: ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA'] }, activo: true },
      select: { id: true },
    });

    await Promise.all(admins.map((admin) =>
      tx.notificacion.create({
        data: {
          usuarioId: admin.id,
          tipo: 'SOLICITUD_ENVIADA',
          titulo: 'Nueva solicitud de inscripcion',
          mensaje: `${solicitud.usuario.nombre} envio una solicitud de inscripcion como ${solicitud.tipoActor}.`,
          prioridad: 'ALTA',
          datos: JSON.stringify({
            tipo: 'solicitud_enviada',
            solicitudId: id,
            tipoActor: solicitud.tipoActor,
          }),
        },
      })
    ));
    return saved;
    });

    res.json({ success: true, data: { solicitud: updated } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /solicitudes/:id/documentos
 * Upload file (multer middleware applied in route)
 */
export const uploadDocumento = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let persisted = false;
  try {
    const { id } = req.params;
    const { tipo } = req.body;

    if (!req.file) throw new AppError('No se envio ningun archivo', 400);
    if (!tipo) throw new AppError('El tipo de documento es obligatorio', 400);

    const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id } });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);

    if (!['BORRADOR', 'OBSERVADA'].includes(solicitud.estado)) {
      throw new AppError('No se pueden agregar archivos a una solicitud enviada o cerrada', 400);
    }

    if (solicitud.usuarioId !== req.user!.id && !isAdmin(req.user!.rol)) {
      throw new AppError('No tiene permisos para subir documentos a esta solicitud', 403);
    }
    if (solicitud.usuarioId !== req.user!.id) assertReviewPermission(req, solicitud);

    const requirement = getSolicitudRequirements(solicitud.tipoActor).find((item) => item.tipo === tipo);
    const license = isLicenseDocument(tipo) && solicitud.tipoActor === 'TRANSPORTISTA' && declaredLicenseDocument(JSON.parse(jsonObject(solicitud.datosActor)), tipo);
    if (!requirement && !license) {
      throw new AppError('El tipo de documento no corresponde a esta inscripcion', 400);
    }

    const description = describeDocument(req.file);
    const reading = tipo === 'COMPROBANTE_PAGO' || license ? await readReceipt({ path: req.file.path, mimeType: description.mimeType }) : undefined;
    const analysis = reading && license ? { ...reading, documentKind: 'LICENCIA', campos: licenseFields(reading.texto) } : reading;
    let previous: Array<{ id: string; path: string; sha256: string | null }> = [];
    const documento = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM solicitudes_inscripcion WHERE id = ${id} FOR UPDATE`;
      const current = await tx.solicitudInscripcion.findUnique({ where: { id } });
      if (!current || !['BORRADOR', 'OBSERVADA'].includes(current.estado)) throw new AppError('La solicitud ya fue enviada; no se reemplazó ningún archivo.', 409);
      if (license && !declaredLicenseDocument(JSON.parse(jsonObject(current.datosActor)), tipo)) throw new AppError('El chofer cambió durante la carga. Guardá la lista y reintentá.', 409);
      previous = await tx.documentoSolicitud.findMany({ where: { solicitudId: id, tipo }, select: { id: true, path: true, sha256: true } });
      if (previous[0]?.sha256 === description.sha256) {
        const original = await tx.documentoSolicitud.findUniqueOrThrow({ where: { id: previous[0].id } });
        if (analysis && analysis.lectura === 'LEIDO' && (original.analisis as { lectura?: string } | null)?.lectura !== 'LEIDO') {
          return tx.documentoSolicitud.update({ where: { id: original.id }, data: { analisis: license ? analysis : mergeReceiptRead(original.analisis, analysis) } });
        }
        return original;
      }
      if (analysis && !license) analysis.duplicado = await receiptDuplicate(tx, description.sha256, previous[0]?.id);
      await tx.documentoSolicitud.deleteMany({ where: { solicitudId: id, tipo } });
      const saved = await tx.documentoSolicitud.create({
        data: {
          solicitudId: id,
          tipo,
          nombre: req.file!.originalname,
          path: req.file!.path,
          ...description,
          ...(analysis ? { analisis: analysis } : {}),
          estado: 'PENDIENTE',
        },
      });
      if (analysis && !license) await retainReceiptDigest(tx, description.sha256, saved.id, 'SOLICITUD');
      if (analysis?.duplicado) await receiptNotice(tx, solicitud.usuarioId, { solicitudId: id, documentoId: saved.id });
      return saved;
    });
    persisted = true;
    if (documento.path !== req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    for (const oldDocument of previous) {
      if (oldDocument.path !== documento.path && fs.existsSync(oldDocument.path)) {
        try { fs.unlinkSync(oldDocument.path); } catch (error) {
          logger.warn({ error, path: oldDocument.path }, 'No se pudo eliminar el archivo reemplazado de solicitud');
        }
      }
    }

    res.status(201).json({ success: true, data: { documento } });
  } catch (error) {
    if (!persisted && req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (cleanupError) {
        logger.warn({ cleanupError, path: req.file.path }, 'No se pudo limpiar un archivo de solicitud rechazado');
      }
    }
    next(error);
  }
};

/** Retry only OCR metadata; never replace the original or approve a payment. */
export const analizarDocumentoSolicitud = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, docId } = req.params;
    const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id } });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);
    if (solicitud.usuarioId !== req.user?.id) assertReviewPermission(req, solicitud);
    const original = await prisma.documentoSolicitud.findUnique({ where: { id: docId } });
    if (!original || original.solicitudId !== id) throw new AppError('Documento no encontrado', 404);
    const license = isLicenseDocument(original.tipo) && solicitud.tipoActor === 'TRANSPORTISTA';
    if (original.tipo !== 'COMPROBANTE_PAGO' && !license) throw new AppError('La lectura automática corresponde a comprobantes o licencias de chofer', 400);
    if (!fs.existsSync(original.path)) throw new AppError('Archivo no disponible', 404);
    const description = describeDocument({ path: original.path, mimetype: original.mimeType });
    if (original.sha256 && original.sha256 !== description.sha256) throw new AppError('El archivo no coincide con su huella registrada; requiere revisión.', 409);
    const reading = await readReceipt({ path: original.path, mimeType: description.mimeType });
    const documento = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM solicitudes_inscripcion WHERE id = ${id} FOR UPDATE`;
      const current = await tx.documentoSolicitud.findUnique({ where: { id: docId } });
      if (!current || current.solicitudId !== id || current.path !== original.path || current.sha256 !== original.sha256) {
        throw new AppError('El adjunto cambió durante la lectura. Actualizá la solicitud para continuar.', 409);
      }
      if (!license) reading.duplicado = await receiptDuplicate(tx, description.sha256, docId);
      const analisis = license ? { ...reading, documentKind: 'LICENCIA', campos: licenseFields(reading.texto) } : mergeReceiptRead(current.analisis, reading);
      const saved = await tx.documentoSolicitud.update({ where: { id: docId }, data: { sha256: description.sha256, analisis } });
      if (!license) await retainReceiptDigest(tx, description.sha256, docId, 'SOLICITUD');
      if (analisis.duplicado && !(current.analisis as { duplicado?: boolean } | null)?.duplicado) await receiptNotice(tx, solicitud.usuarioId, { solicitudId: id, documentoId: docId });
      return saved;
    });
    res.json({ success: true, data: { documento } });
  } catch (error) { next(error); }
};

/** Protected original-file download; filesystem paths are never browser URLs. */
export const downloadDocumentoSolicitud = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id: req.params.id } });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);
    if (solicitud.usuarioId !== req.user?.id && (!req.user || req.user.restricted || !isAdmin(req.user.rol))) throw new AppError('No tiene permisos para consultar este documento', 403);
    const documento = await prisma.documentoSolicitud.findUnique({ where: { id: req.params.docId } });
    if (!documento || documento.solicitudId !== solicitud.id) throw new AppError('Documento no encontrado', 404);
    if (!fs.existsSync(documento.path)) throw new AppError('Archivo no disponible', 404);
    res.setHeader('Content-Type', documento.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(documento.nombre)}`);
    fs.createReadStream(documento.path).on('error', next).pipe(res);
  } catch (error) { next(error); }
};

/**
 * DELETE /solicitudes/:id/documentos/:docId
 * Delete own doc
 */
export const deleteDocumento = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, docId } = req.params;

    const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id } });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);

    if (solicitud.usuarioId !== req.user!.id && !isAdmin(req.user!.rol)) {
      throw new AppError('No tiene permisos para eliminar documentos de esta solicitud', 403);
    }
    if (solicitud.usuarioId !== req.user!.id) assertReviewPermission(req, solicitud);

    if (!['BORRADOR', 'OBSERVADA'].includes(solicitud.estado)) {
      throw new AppError('No se pueden eliminar archivos de una solicitud enviada o cerrada', 400);
    }

    const documento = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM solicitudes_inscripcion WHERE id = ${id} FOR UPDATE`;
      const current = await tx.solicitudInscripcion.findUnique({ where: { id } });
      if (!current || !['BORRADOR', 'OBSERVADA'].includes(current.estado)) throw new AppError('La solicitud ya fue enviada; no se eliminó ningún archivo.', 409);
      const saved = await tx.documentoSolicitud.findUnique({ where: { id: docId } });
      if (!saved) throw new AppError('Documento no encontrado', 404);
      if (saved.solicitudId !== id) throw new AppError('El documento no pertenece a esta solicitud', 400);
      return tx.documentoSolicitud.delete({ where: { id: docId } });
    });
    // Remove bytes only AFTER the database commit. A failed transaction must
    // leave the original available to the applicant and reviewer.
    if (fs.existsSync(documento.path)) {
      try { fs.unlinkSync(documento.path); } catch (error) {
        logger.warn({ error, path: documento.path }, 'No se pudo limpiar un archivo de solicitud eliminado');
      }
    }

    res.json({ success: true, message: 'Documento eliminado' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /solicitudes/:id/mensajes
 * List thread messages
 */
export const getMensajes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id } });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);

    if (solicitud.usuarioId !== req.user!.id && !isAdmin(req.user!.rol)) {
      throw new AppError('No tiene permisos para ver los mensajes de esta solicitud', 403);
    }

    const mensajes = await prisma.mensajeSolicitud.findMany({
      where: { solicitudId: id },
      orderBy: { createdAt: 'asc' },
    });

    // Mark unread messages as read for the current user's role
    const autorRol = isAdmin(req.user!.rol) ? 'CANDIDATO' : 'ADMIN';
    await prisma.mensajeSolicitud.updateMany({
      where: { solicitudId: id, autorRol, leido: false },
      data: { leido: true, leidoAt: new Date() },
    });

    res.json({ success: true, data: { mensajes } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /solicitudes/:id/mensajes
 * Send message (role-aware)
 */
export const crearMensaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { contenido } = req.body;

    if (!contenido || !contenido.trim()) {
      throw new AppError('El contenido del mensaje es obligatorio', 400);
    }

    const solicitud = await prisma.solicitudInscripcion.findUnique({
      where: { id },
      include: { usuario: { select: { id: true, nombre: true } } },
    });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);

    if (solicitud.usuarioId !== req.user!.id && !isAdmin(req.user!.rol)) {
      throw new AppError('No tiene permisos para enviar mensajes en esta solicitud', 403);
    }

    const autorRol = isAdmin(req.user!.rol) ? 'ADMIN' : 'CANDIDATO';

    const mensaje = await prisma.mensajeSolicitud.create({
      data: {
        solicitudId: id,
        autorId: req.user!.id,
        autorRol,
        contenido: contenido.trim(),
      },
    });

    // Notify the other party via in-app notification
    if (autorRol === 'ADMIN') {
      // Notify the candidate
      await prisma.notificacion.create({
        data: {
          usuarioId: solicitud.usuarioId,
          tipo: 'SOLICITUD_MENSAJE',
          titulo: 'Nuevo mensaje en tu solicitud',
          mensaje: 'Un administrador envio un mensaje sobre tu solicitud de inscripcion.',
          prioridad: 'NORMAL',
          datos: JSON.stringify({ tipo: 'solicitud_mensaje', solicitudId: id }),
        },
      });
    } else {
      // Notify admins
      const admins = await prisma.usuario.findMany({
        where: { rol: { in: ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA'] }, activo: true },
        select: { id: true },
      });
      await Promise.all(admins.map((admin) =>
        prisma.notificacion.create({
          data: {
            usuarioId: admin.id,
            tipo: 'SOLICITUD_MENSAJE',
            titulo: 'Nuevo mensaje en solicitud',
            mensaje: `${solicitud.usuario.nombre} envio un mensaje en su solicitud de inscripcion.`,
            prioridad: 'NORMAL',
            datos: JSON.stringify({ tipo: 'solicitud_mensaje', solicitudId: id }),
          },
        })
      ));
    }

    res.status(201).json({ success: true, data: { mensaje } });
  } catch (error) {
    next(error);
  }
};

// =====================================================================
// ADMIN (isAuthenticated + hasRole)
// =====================================================================

/**
 * GET /solicitudes
 * List all with filters (estado, tipoActor, search, page/limit)
 */
export const listarSolicitudes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { estado, tipoActor, search, page = 1, limit = 20 } = req.query;
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (Number(page) - 1) * limitNum;

    const where: any = {};
    if (estado) where.estado = estado;
    if (tipoActor) where.tipoActor = tipoActor;
    if (search && typeof search === 'string') {
      where.OR = [
        { usuario: { nombre: { contains: search, mode: 'insensitive' } } },
        { usuario: { email: { contains: search, mode: 'insensitive' } } },
        { usuario: { cuit: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [solicitudes, total] = await Promise.all([
      prisma.solicitudInscripcion.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          usuario: { select: { id: true, email: true, nombre: true, cuit: true } },
          _count: { select: { documentos: true, mensajes: true } },
        },
      }),
      prisma.solicitudInscripcion.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        solicitudes,
        pagination: { page: Number(page), limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /solicitudes/:id/revisar
 * ENVIADA -> EN_REVISION
 */
export const revisarSolicitud = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id } });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);
    assertReviewPermission(req, solicitud);

    if (solicitud.estado !== 'ENVIADA') {
      throw new AppError('Solo se pueden tomar en revision solicitudes en estado ENVIADA', 400);
    }

    const updated = await prisma.solicitudInscripcion.update({
      where: { id },
      data: {
        estado: 'EN_REVISION',
        revisadoPor: req.user!.id,
      },
    });

    res.json({ success: true, data: { solicitud: updated } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /solicitudes/:id/observar
 * EN_REVISION -> OBSERVADA + create message
 */
export const observarSolicitud = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { observaciones } = req.body;

    if (!observaciones || !observaciones.trim()) {
      throw new AppError('Las observaciones son obligatorias para observar una solicitud', 400);
    }

    const solicitud = await prisma.solicitudInscripcion.findUnique({
      where: { id },
      include: { usuario: { select: { id: true, nombre: true, email: true } } },
    });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);
    assertReviewPermission(req, solicitud);

    if (solicitud.estado !== 'EN_REVISION') {
      throw new AppError('Solo se pueden observar solicitudes en estado EN_REVISION', 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.solicitudInscripcion.update({
        where: { id },
        data: {
          estado: 'OBSERVADA',
          observaciones: observaciones.trim(),
          revisadoPor: req.user!.id,
        },
      });

      // Create message from admin
      await tx.mensajeSolicitud.create({
        data: {
          solicitudId: id,
          autorId: req.user!.id,
          autorRol: 'ADMIN',
          contenido: observaciones.trim(),
        },
      });
    });

    // Notify candidate
    await prisma.notificacion.create({
      data: {
        usuarioId: solicitud.usuarioId,
        tipo: 'SOLICITUD_OBSERVADA',
        titulo: 'Solicitud observada',
        mensaje: 'Tu solicitud de inscripcion tiene observaciones. Revisa los comentarios y corrige lo necesario.',
        prioridad: 'ALTA',
        datos: JSON.stringify({ tipo: 'solicitud_observada', solicitudId: id }),
      },
    });

    const updated = await prisma.solicitudInscripcion.findUnique({ where: { id } });
    res.json({ success: true, data: { solicitud: updated } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /solicitudes/:id/aprobar
 * EN_REVISION -> APROBADA. Creates actor + activates user.
 */
export const aprobarSolicitud = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { observaciones } = req.body;

    const solicitud = await prisma.solicitudInscripcion.findUnique({
      where: { id },
      include: { usuario: { select: { id: true, email: true, nombre: true, cuit: true } } },
    });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);
    assertReviewPermission(req, solicitud);

    if (solicitud.estado !== 'EN_REVISION') {
      throw new AppError('Solo se pueden aprobar solicitudes en estado EN_REVISION', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM solicitudes_inscripcion WHERE id = ${id} FOR UPDATE`;
      const current = await tx.solicitudInscripcion.findUnique({ where: { id } });
      if (!current || current.estado !== 'EN_REVISION') throw new AppError('La solicitud ya fue procesada por otro usuario', 409);
      const datosActor = JSON.parse(jsonObject(current.datosActor));
      if (datosActor.cuit && normalizeCuit(String(datosActor.cuit)) !== solicitud.usuario.cuit) throw new AppError('El CUIT declarado no coincide con el de la cuenta solicitante', 400);
      const declared = registrationActorFields(solicitud.tipoActor, datosActor);
      const contact = typeof datosActor.emailContacto === 'string' && datosActor.emailContacto.trim()
        ? datosActor.emailContacto.trim() : solicitud.usuario.email;
      let generadorId: string | undefined;
      let operadorId: string | undefined;
      let transportistaId: string | undefined;

      if (solicitud.tipoActor === 'GENERADOR') {
        const generador = await tx.generador.create({
          data: {
            usuarioId: solicitud.usuarioId,
            razonSocial: datosActor.razonSocial || datosActor.nombre || solicitud.usuario.nombre,
            cuit: solicitud.usuario.cuit || '',
            domicilio: datosActor.domicilio || '',
            telefono: datosActor.telefono || '',
            email: contact,
            numeroInscripcion: datosActor.numeroInscripcion || 'PENDIENTE',
            categoria: datosActor.categoria || 'PENDIENTE',
            ...declared,
          },
        });
        generadorId = generador.id;
      } else if (solicitud.tipoActor === 'OPERADOR') {
        const operador = await tx.operador.create({
          data: {
            usuarioId: solicitud.usuarioId,
            razonSocial: datosActor.razonSocial || datosActor.nombre || solicitud.usuario.nombre,
            cuit: solicitud.usuario.cuit || '',
            domicilio: datosActor.domicilio || '',
            telefono: datosActor.telefono || '',
            email: contact,
            numeroHabilitacion: datosActor.numeroHabilitacion || 'PENDIENTE',
            categoria: datosActor.categoria || 'PENDIENTE',
            ...declared,
          },
        });
        operadorId = operador.id;
      } else if (solicitud.tipoActor === 'TRANSPORTISTA') {
        const transportista = await tx.transportista.create({
          data: {
            usuarioId: solicitud.usuarioId,
            razonSocial: datosActor.razonSocial || datosActor.nombre || solicitud.usuario.nombre,
            cuit: solicitud.usuario.cuit || '',
            domicilio: datosActor.domicilio || '',
            telefono: datosActor.telefono || '',
            email: contact,
            numeroHabilitacion: datosActor.numeroHabilitacion || 'PENDIENTE',
            ...declared,
            ...registrationFleet(datosActor),
          },
        });
        transportistaId = transportista.id;
      }

      // Update solicitud
      const updated = await tx.solicitudInscripcion.update({
        where: { id },
        data: {
          estado: 'APROBADA',
          generadorId,
          operadorId,
          transportistaId,
          revisadoPor: req.user!.id,
          fechaRevision: new Date(),
          observaciones: observaciones || undefined,
        },
      });

      // Activate user + set correct role
      await tx.usuario.update({
        where: { id: solicitud.usuarioId },
        data: {
          activo: true,
          rol: solicitud.tipoActor as Rol,
        },
      });

      // Same transaction: a failed internal notice must not leave a committed
      // approval reported as failed to the administrator.
      await tx.notificacion.create({
      data: {
        usuarioId: solicitud.usuarioId,
        tipo: 'SOLICITUD_APROBADA',
        titulo: 'Solicitud aprobada',
        mensaje: 'Tu solicitud de inscripcion fue aprobada. Ya podes ingresar a SITREP.',
        prioridad: 'ALTA',
        datos: JSON.stringify({ tipo: 'solicitud_aprobada', solicitudId: id }),
      },
      });
      return updated;
    });

    res.json({ success: true, data: { solicitud: result } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /solicitudes/:id/rechazar
 * EN_REVISION -> RECHAZADA (require motivoRechazo)
 */
export const rechazarSolicitud = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { motivoRechazo, observaciones } = req.body;

    if (!motivoRechazo || !motivoRechazo.trim()) {
      throw new AppError('El motivo de rechazo es obligatorio', 400);
    }

    const solicitud = await prisma.solicitudInscripcion.findUnique({
      where: { id },
      include: { usuario: { select: { id: true, nombre: true } } },
    });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);
    assertReviewPermission(req, solicitud);

    if (solicitud.estado !== 'EN_REVISION') {
      throw new AppError('Solo se pueden rechazar solicitudes en estado EN_REVISION', 400);
    }

    const updated = await prisma.solicitudInscripcion.update({
      where: { id },
      data: {
        estado: 'RECHAZADA',
        motivoRechazo: motivoRechazo.trim(),
        observaciones: observaciones || undefined,
        revisadoPor: req.user!.id,
        fechaRevision: new Date(),
      },
    });

    // Notify candidate
    await prisma.notificacion.create({
      data: {
        usuarioId: solicitud.usuarioId,
        tipo: 'SOLICITUD_RECHAZADA',
        titulo: 'Solicitud rechazada',
        mensaje: `Tu solicitud de inscripcion fue rechazada. Motivo: ${motivoRechazo.trim()}`,
        prioridad: 'ALTA',
        datos: JSON.stringify({ tipo: 'solicitud_rechazada', solicitudId: id, motivoRechazo: motivoRechazo.trim() }),
      },
    });

    res.json({ success: true, data: { solicitud: updated } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /solicitudes/:id/documentos/:docId/revisar
 * Approve/reject individual document
 */
export const revisarDocumento = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, docId } = req.params;
    const { estado, observaciones } = req.body;

    if (!estado || !['APROBADO', 'RECHAZADO'].includes(estado)) {
      throw new AppError('El estado debe ser APROBADO o RECHAZADO', 400);
    }

    const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id } });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);
    assertReviewPermission(req, solicitud);

    const documento = await prisma.documentoSolicitud.findUnique({ where: { id: docId } });
    if (!documento) throw new AppError('Documento no encontrado', 404);
    if (documento.solicitudId !== id) throw new AppError('El documento no pertenece a esta solicitud', 400);

    const updated = await prisma.documentoSolicitud.update({
      where: { id: docId },
      data: {
        estado,
        observaciones: observaciones || undefined,
        revisadoPor: req.user!.id,
        revisadoAt: new Date(),
      },
    });

    res.json({ success: true, data: { documento: updated } });
  } catch (error) {
    next(error);
  }
};
