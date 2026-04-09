import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import { verificarVencimientos } from '../jobs/vencimiento.job';
import { emailService } from '../services/email.service';
import { generateTokens } from './auth.controller';
import { parseDateRange } from '../utils/dateRange';

// ============== USUARIOS CRUD (Admin) ==============

const createUsuarioSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  nombre: z.string().min(1, 'El nombre es requerido'),
  apellido: z.string().optional(),
  rol: z.enum(['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR']),
  empresa: z.string().optional(),
  telefono: z.string().optional(),
  cuit: z.string().optional(),
});

const updateUsuarioSchema = z.object({
  nombre: z.string().min(1).optional(),
  apellido: z.string().optional(),
  email: z.string().email().optional(),
  empresa: z.string().optional(),
  telefono: z.string().optional(),
  cuit: z.string().optional(),
  activo: z.boolean().optional(),
  esInspector: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  rol: z.enum(['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR']).optional(),
});

export const getUsuarios = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, rol, activo, page = 1, limit = 10, sortBy, sortOrder } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const order: 'asc' | 'desc' = sortOrder === 'desc' ? 'desc' : 'asc';
    const USR_SORT: Record<string, any> = {
      nombre: { nombre: order },
      rol: { rol: order },
      activo: { activo: order },
      createdAt: { createdAt: order },
    };
    const orderBy = USR_SORT[sortBy as string] ?? { createdAt: 'desc' };

    const where: any = {};
    if (search) {
      where.OR = [
        { nombre: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { empresa: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (rol) where.rol = rol;
    if (activo !== undefined) where.activo = activo === 'true';

    const [usuarios, total] = await Promise.all([
      prisma.usuario.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true,
          email: true,
          rol: true,
          nombre: true,
          apellido: true,
          empresa: true,
          telefono: true,
          activo: true,
          esInspector: true,
          emailVerified: true,
          notifNuevoRegistro: true,
          createdAt: true,
          generador: { select: { id: true, razonSocial: true } },
          transportista: { select: { id: true, razonSocial: true } },
          operador: { select: { id: true, razonSocial: true } },
        },
        orderBy,
      }),
      prisma.usuario.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        usuarios,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUsuarioById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        rol: true,
        nombre: true,
        apellido: true,
        empresa: true,
        telefono: true,
        activo: true,
        esInspector: true,
        createdAt: true,
        generador: true,
        transportista: true,
        operador: true,
      },
    });

    if (!usuario) {
      throw new AppError('Usuario no encontrado', 404);
    }

    res.json({ success: true, data: { usuario } });
  } catch (error) {
    next(error);
  }
};

export const createUsuario = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createUsuarioSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { email, password, nombre, apellido, rol, empresa, telefono, cuit } = parsed.data;

    // Multi-rol: si el CUIT ya existe con el mismo email, reusar el usuario
    const existingByCuit = cuit ? await prisma.usuario.findUnique({ where: { cuit } }) : null;
    const existingByEmail = await prisma.usuario.findUnique({ where: { email } });

    let usuario;

    if (existingByCuit && existingByEmail && existingByCuit.id === existingByEmail.id) {
      // Mismo CUIT y mismo email → multi-rol, retornar usuario existente
      usuario = existingByCuit;
    } else if (existingByCuit) {
      throw new AppError('El CUIT ya está registrado con otro email', 400);
    } else if (existingByEmail) {
      throw new AppError('Ya existe un usuario con ese email', 400);
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      usuario = await prisma.usuario.create({
        data: {
          email,
          password: hashedPassword,
          nombre,
          apellido,
          rol,
          empresa,
          telefono,
          cuit,
        },
      });
    }

    const result = await prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: {
        id: true,
        email: true,
        rol: true,
        nombre: true,
        apellido: true,
        empresa: true,
        telefono: true,
        activo: true,
        createdAt: true,
      },
    });

    res.status(201).json({ success: true, data: { usuario: result } });
  } catch (error) {
    next(error);
  }
};

export const updateUsuario = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const parsed = updateUsuarioSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const usuario = await prisma.usuario.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        email: true,
        rol: true,
        nombre: true,
        apellido: true,
        empresa: true,
        telefono: true,
        activo: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: { usuario } });
  } catch (error) {
    next(error);
  }
};

export const deleteUsuario = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: { generador: true, transportista: true, operador: true },
    });

    if (!usuario) {
      throw new AppError('Usuario no encontrado', 404);
    }

    // No permitir eliminar si tiene actor asociado con manifiestos
    if (usuario.generador) {
      const count = await prisma.manifiesto.count({ where: { generadorId: usuario.generador.id } });
      if (count > 0) {
        throw new AppError('No se puede eliminar: el generador asociado tiene manifiestos', 400);
      }
    }
    if (usuario.transportista) {
      const count = await prisma.manifiesto.count({ where: { transportistaId: usuario.transportista.id } });
      if (count > 0) {
        throw new AppError('No se puede eliminar: el transportista asociado tiene manifiestos', 400);
      }
    }
    if (usuario.operador) {
      const count = await prisma.manifiesto.count({ where: { operadorId: usuario.operador.id } });
      if (count > 0) {
        throw new AppError('No se puede eliminar: el operador asociado tiene manifiestos', 400);
      }
    }

    // Eliminar actor asociado primero, luego usuario
    if (usuario.generador) await prisma.generador.delete({ where: { id: usuario.generador.id } });
    if (usuario.transportista) await prisma.transportista.delete({ where: { id: usuario.transportista.id } });
    if (usuario.operador) await prisma.operador.delete({ where: { id: usuario.operador.id } });
    await prisma.usuario.delete({ where: { id } });

    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (error) {
    next(error);
  }
};

export const toggleActivo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      throw new AppError('Usuario no encontrado', 404);
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: { activo: !usuario.activo },
      select: {
        id: true,
        email: true,
        rol: true,
        nombre: true,
        apellido: true,
        empresa: true,
        telefono: true,
        activo: true,
        createdAt: true,
      },
    });

    // Si se activa la cuenta (false → true), notificar al usuario
    if (!usuario.activo && updated.activo) {
      emailService.sendCuentaAprobadaEmail(updated.email, updated.nombre).catch(console.error);
    }

    res.json({ success: true, data: { usuario: updated } });
  } catch (error) {
    next(error);
  }
};

// ============== PREFERENCIAS NOTIFICACIÓN ==============

const preferenciaSchema = z.object({
  notifNuevoRegistro: z.boolean().optional(),
  notifEmail: z.boolean().optional(),
  notifWhatsapp: z.boolean().optional(),
  notifTelegram: z.boolean().optional(),
  whatsappPhone: z.string().optional(),
  telegramChatId: z.string().optional(),
});

export const updatePreferenciasNotificacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = preferenciaSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const updated = await prisma.usuario.update({
      where: { id: req.user!.id },
      data: parsed.data,
      select: { id: true, notifNuevoRegistro: true, notifEmail: true, notifWhatsapp: true, notifTelegram: true, whatsappPhone: true, telegramChatId: true },
    });

    res.json({ success: true, data: { usuario: updated } });
  } catch (error) {
    next(error);
  }
};

// ============== IMPERSONATE ==============

export const impersonateUsuario = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const target = await prisma.usuario.findUnique({
      where: { id: userId },
      include: { generador: true, transportista: true, operador: true },
    });

    if (!target) throw new AppError('Usuario no encontrado', 404);
    if (!target.activo) throw new AppError('Usuario inactivo', 400);
    if (target.id === req.user.id) throw new AppError('No podés impersonarte a vos mismo', 400);

    const { accessToken, refreshToken } = generateTokens(target.id);

    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: req.user.id,
          accion: 'IMPERSONATION',
          modulo: 'AUTH',
          ip: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          datosDespues: JSON.stringify({
            impersonatedUserId: target.id,
            impersonatedEmail: target.email,
            impersonatedRol: target.rol,
            adminId: req.user.id,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    } catch { /* ignore audit errors */ }

    res.json({
      success: true,
      data: {
        user: {
          id: target.id, email: target.email, rol: target.rol,
          nombre: target.nombre, apellido: target.apellido,
          empresa: target.empresa, activo: target.activo,
          generador: target.generador, transportista: target.transportista, operador: target.operador,
        },
        tokens: { accessToken, refreshToken },
        impersonatedBy: { id: req.user.id, nombre: req.user.nombre, email: req.user.email },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============== JOBS ADMIN ==============

export const ejecutarJobVencimientos = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await verificarVencimientos();
    res.json({ success: true, mensaje: 'Job de vencimientos ejecutado' });
  } catch (error) {
    next(error);
  }
};

// ===== EMAIL QUEUE =====

export const getEmailQueue = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { estado, to, fechaDesde, fechaHasta, page = '1', limit = '20' } = req.query;
    const take = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    const where: any = {};
    if (estado) where.estado = estado;
    if (to) where.to = { contains: to as string, mode: 'insensitive' };
    const emailDateFilter = parseDateRange(fechaDesde, fechaHasta, 'fechaDesde', 'fechaHasta');
    if (emailDateFilter) where.createdAt = emailDateFilter;

    const [data, total] = await Promise.all([
      prisma.emailQueue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          id: true, to: true, subject: true, tipo: true, prioridad: true,
          estado: true, intentos: true, maxIntentos: true, error: true,
          digestKey: true, createdAt: true, sentAt: true, nextRetryAt: true,
        },
      }),
      prisma.emailQueue.count({ where }),
    ]);

    res.json({ data, total, page: Math.floor(skip / take) + 1, limit: take });
  } catch (error) {
    next(error);
  }
};
