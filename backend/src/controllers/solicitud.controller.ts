import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emailService } from '../services/email.service';

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
const uploadDir = path.join(process.cwd(), 'uploads', 'solicitudes');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
export const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// Helper: check if user is an admin role
const ADMIN_ROLES = ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'];
function isAdmin(rol: string): boolean {
  return ADMIN_ROLES.includes(rol);
}

// =====================================================================
// PUBLIC (no auth)
// =====================================================================

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

    if (!['GENERADOR', 'OPERADOR'].includes(tipoActor)) {
      throw new AppError('tipoActor debe ser GENERADOR u OPERADOR', 400);
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
          rol: tipoActor as any,
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

    // Send email verification (fire-and-forget, don't block)
    emailService.sendEmailVerification(email, nombre, rawToken).catch((err) => {
      console.error('[SOLICITUD] Error enviando email de verificacion:', err);
    });

    res.status(201).json({
      success: true,
      data: { solicitudId: result.solicitud.id },
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
    const { datosActor, datosResiduos, datosTEF, datosRegulatorio } = req.body;

    const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id } });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);

    if (solicitud.usuarioId !== req.user!.id) {
      throw new AppError('No tiene permisos para editar esta solicitud', 403);
    }

    if (!['BORRADOR', 'OBSERVADA'].includes(solicitud.estado)) {
      throw new AppError('Solo se pueden editar solicitudes en estado BORRADOR u OBSERVADA', 400);
    }

    const data: any = {};
    if (datosActor !== undefined) data.datosActor = typeof datosActor === 'string' ? datosActor : JSON.stringify(datosActor);
    if (datosResiduos !== undefined) data.datosResiduos = typeof datosResiduos === 'string' ? datosResiduos : JSON.stringify(datosResiduos);
    if (datosTEF !== undefined) data.datosTEF = typeof datosTEF === 'string' ? datosTEF : JSON.stringify(datosTEF);
    if (datosRegulatorio !== undefined) data.datosRegulatorio = typeof datosRegulatorio === 'string' ? datosRegulatorio : JSON.stringify(datosRegulatorio);

    const updated = await prisma.solicitudInscripcion.update({
      where: { id },
      data,
    });

    res.json({ success: true, data: { solicitud: updated } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /solicitudes/:id/enviar
 * BORRADOR/OBSERVADA -> ENVIADA. Validate required fields.
 */
export const enviarSolicitud = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const solicitud = await prisma.solicitudInscripcion.findUnique({
      where: { id },
      include: { usuario: { select: { email: true, nombre: true } } },
    });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);

    if (solicitud.usuarioId !== req.user!.id) {
      throw new AppError('No tiene permisos para enviar esta solicitud', 403);
    }

    if (!['BORRADOR', 'OBSERVADA'].includes(solicitud.estado)) {
      throw new AppError('Solo se pueden enviar solicitudes en estado BORRADOR u OBSERVADA', 400);
    }

    // Validate required data
    if (!solicitud.datosActor) {
      throw new AppError('Datos del actor son obligatorios', 400);
    }

    const datosActor = JSON.parse(solicitud.datosActor);
    if (!datosActor.razonSocial && !datosActor.nombre) {
      throw new AppError('La razon social o nombre es obligatorio', 400);
    }
    if (!datosActor.cuit) {
      throw new AppError('El CUIT es obligatorio', 400);
    }
    if (!datosActor.domicilio) {
      throw new AppError('El domicilio es obligatorio', 400);
    }

    const updated = await prisma.solicitudInscripcion.update({
      where: { id },
      data: {
        estado: 'ENVIADA',
        fechaEnvio: new Date(),
      },
    });

    // Notify admins via in-app notification
    const admins = await prisma.usuario.findMany({
      where: { rol: { in: ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'] }, activo: true },
      select: { id: true },
    });

    await Promise.all(admins.map((admin) =>
      prisma.notificacion.create({
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
  try {
    const { id } = req.params;
    const { tipo } = req.body;

    if (!req.file) throw new AppError('No se envio ningun archivo', 400);
    if (!tipo) throw new AppError('El tipo de documento es obligatorio', 400);

    const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id } });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);

    if (solicitud.usuarioId !== req.user!.id && !isAdmin(req.user!.rol)) {
      throw new AppError('No tiene permisos para subir documentos a esta solicitud', 403);
    }

    const documento = await prisma.documentoSolicitud.create({
      data: {
        solicitudId: id,
        tipo,
        nombre: req.file.originalname,
        path: req.file.path,
        mimeType: req.file.mimetype,
        size: req.file.size,
        estado: 'PENDIENTE',
      },
    });

    res.status(201).json({ success: true, data: { documento } });
  } catch (error) {
    next(error);
  }
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

    const documento = await prisma.documentoSolicitud.findUnique({ where: { id: docId } });
    if (!documento) throw new AppError('Documento no encontrado', 404);
    if (documento.solicitudId !== id) throw new AppError('El documento no pertenece a esta solicitud', 400);

    // Delete file from disk
    if (fs.existsSync(documento.path)) {
      fs.unlinkSync(documento.path);
    }

    await prisma.documentoSolicitud.delete({ where: { id: docId } });

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
        where: { rol: { in: ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'] }, activo: true },
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

    if (solicitud.estado !== 'EN_REVISION') {
      throw new AppError('Solo se pueden aprobar solicitudes en estado EN_REVISION', 400);
    }

    const datosActor = JSON.parse(solicitud.datosActor);

    const result = await prisma.$transaction(async (tx) => {
      let generadorId: string | undefined;
      let operadorId: string | undefined;

      if (solicitud.tipoActor === 'GENERADOR') {
        const generador = await tx.generador.create({
          data: {
            usuarioId: solicitud.usuarioId,
            razonSocial: datosActor.razonSocial || datosActor.nombre || solicitud.usuario.nombre,
            cuit: datosActor.cuit || solicitud.usuario.cuit || '',
            domicilio: datosActor.domicilio || '',
            telefono: datosActor.telefono || '',
            email: datosActor.email || solicitud.usuario.email,
            numeroInscripcion: datosActor.numeroInscripcion || 'PENDIENTE',
            categoria: datosActor.categoria || 'PENDIENTE',
            actividad: datosActor.actividad,
            rubro: datosActor.rubro,
            latitud: datosActor.latitud ? parseFloat(datosActor.latitud) : undefined,
            longitud: datosActor.longitud ? parseFloat(datosActor.longitud) : undefined,
          },
        });
        generadorId = generador.id;
      } else if (solicitud.tipoActor === 'OPERADOR') {
        const operador = await tx.operador.create({
          data: {
            usuarioId: solicitud.usuarioId,
            razonSocial: datosActor.razonSocial || datosActor.nombre || solicitud.usuario.nombre,
            cuit: datosActor.cuit || solicitud.usuario.cuit || '',
            domicilio: datosActor.domicilio || '',
            telefono: datosActor.telefono || '',
            email: datosActor.email || solicitud.usuario.email,
            numeroHabilitacion: datosActor.numeroHabilitacion || 'PENDIENTE',
            categoria: datosActor.categoria || 'PENDIENTE',
            tipoOperador: datosActor.tipoOperador,
            tecnologia: datosActor.tecnologia,
            latitud: datosActor.latitud ? parseFloat(datosActor.latitud) : undefined,
            longitud: datosActor.longitud ? parseFloat(datosActor.longitud) : undefined,
          },
        });
        operadorId = operador.id;
      }

      // Update solicitud
      const updated = await tx.solicitudInscripcion.update({
        where: { id },
        data: {
          estado: 'APROBADA',
          generadorId,
          operadorId,
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
          rol: solicitud.tipoActor as any,
        },
      });

      return updated;
    });

    // Notify candidate
    await prisma.notificacion.create({
      data: {
        usuarioId: solicitud.usuarioId,
        tipo: 'SOLICITUD_APROBADA',
        titulo: 'Solicitud aprobada',
        mensaje: 'Tu solicitud de inscripcion fue aprobada. Ya podes ingresar a SITREP.',
        prioridad: 'ALTA',
        datos: JSON.stringify({ tipo: 'solicitud_aprobada', solicitudId: id }),
      },
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
