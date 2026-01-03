import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { StringValue } from 'ms';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/config';
import { AppError } from '../middlewares/errorHandler';

const prisma = new PrismaClient();

// Generar tokens JWT
const generateTokens = (userId: string) => {
  const options: SignOptions = { expiresIn: config.JWT_EXPIRES_IN as StringValue };
  const accessToken = jwt.sign({ id: userId }, config.JWT_SECRET as string, options);

  const refreshOptions: SignOptions = { expiresIn: '7d' as StringValue };
  const refreshToken = jwt.sign({ id: userId }, config.JWT_SECRET as string, refreshOptions);

  return { accessToken, refreshToken };
};

// Registrar nuevo usuario
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, rol, nombre, apellido, empresa, telefono } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await prisma.usuario.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError('El correo electrónico ya está en uso', 400);
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear usuario
    const user = await prisma.usuario.create({
      data: {
        email,
        password: hashedPassword,
        rol,
        nombre,
        apellido,
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
        activo: true,
        createdAt: true,
      },
    });

    // Generar tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    res.status(201).json({
      success: true,
      data: {
        user,
        tokens: { accessToken, refreshToken },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Iniciar sesión
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const user = await prisma.usuario.findUnique({
      where: { email },
      include: {
        generador: true,
        transportista: true,
        operador: true,
      },
    });

    if (!user) {
      throw new AppError('Credenciales inválidas', 401);
    }

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError('Credenciales inválidas', 401);
    }

    // Verificar si el usuario está activo
    if (!user.activo) {
      throw new AppError('Usuario inactivo', 403);
    }

    // Generar tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Registrar login en auditoría
    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: user.id,
          accion: 'LOGIN',
          modulo: 'AUTH',
          ip: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          datosDespues: JSON.stringify({
            email: user.email,
            rol: user.rol,
            timestamp: new Date().toISOString()
          }),
        },
      });
    } catch (auditError) {
      console.error('Error registrando auditoría de login:', auditError);
    }

    // Preparar datos de usuario para la respuesta (sin contraseña)
    const userData = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      nombre: user.nombre,
      apellido: user.apellido,
      empresa: user.empresa,
      telefono: user.telefono,
      activo: user.activo,
      generador: user.generador,
      transportista: user.transportista,
      operador: user.operador,
      createdAt: user.createdAt,
    };

    res.json({
      success: true,
      data: {
        user: userData,
        tokens: { accessToken, refreshToken },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Obtener perfil de usuario
export const getProfile = async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;

    const user = await prisma.usuario.findUnique({
      where: { id: userId },
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

    if (!user) {
      throw new AppError('Usuario no encontrado', 404);
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Cerrar sesión
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // En una implementación real, aquí invalidaríamos el refresh token
    // Por ahora, simplemente respondemos con éxito
    res.json({
      success: true,
      message: 'Sesión cerrada correctamente',
    });
  } catch (error) {
    next(error);
  }
};

// Obtener lista de usuarios (CU-A03 - Gestionar Usuarios)
export const getUsers = async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, rol, activo } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (rol) where.rol = rol;
    if (activo !== undefined) where.activo = activo === 'true';

    const [users, total] = await Promise.all([
      prisma.usuario.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
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
          updatedAt: true,
        },
      }),
      prisma.usuario.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        users,
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
