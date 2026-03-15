import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

// ============== USUARIOS CRUD (Admin) ==============

const createUsuarioSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  nombre: z.string().min(1, 'El nombre es requerido'),
  apellido: z.string().optional(),
  rol: z.enum(['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR']),
  empresa: z.string().optional(),
  telefono: z.string().optional(),
  cuit: z.string().optional(),
});

const updateUsuarioSchema = z.object({
  nombre: z.string().min(1).optional(),
  apellido: z.string().optional(),
  empresa: z.string().optional(),
  telefono: z.string().optional(),
  activo: z.boolean().optional(),
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

    const { email, password, nombre, apellido, rol, empresa, telefono } = parsed.data;

    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      throw new AppError('Ya existe un usuario con ese email', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const usuario = await prisma.usuario.create({
      data: {
        email,
        password: hashedPassword,
        nombre,
        apellido,
        rol,
        empresa,
        telefono,
      },
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

    res.status(201).json({ success: true, data: { usuario } });
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

    res.json({ success: true, data: { usuario: updated } });
  } catch (error) {
    next(error);
  }
};
