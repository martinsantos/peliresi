import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { StringValue } from 'ms';
import { z } from 'zod';
import { config } from '../config/config';
import { AppError } from '../middlewares/errorHandler';
import prisma from '../lib/prisma';

// Demo mode accounts (relaxed password validation)
const DEMO_EMAILS = [
  'juan.perez@dgfa.gob.ar',
  'm.gonzalez@hospitalcentral.gob.ar',
  'c.rodriguez@transportesandes.com',
  'ana.martinez@plantalasheras.com',
];

// Zod schemas
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
  rol: z.enum(['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR']),
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  apellido: z.string().optional(),
  empresa: z.string().optional(),
  telefono: z.string().optional(),
});

// Password strength validation for non-demo users
function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe contener al menos una mayúscula';
  if (!/[0-9]/.test(password)) return 'La contraseña debe contener al menos un número';
  return null;
}

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
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { email, password, rol, nombre, apellido, empresa, telefono } = parsed.data;

    // Password strength check (skip for demo mode accounts)
    const isDemoMode = process.env.DEMO_MODE === 'true';
    if (!isDemoMode || !DEMO_EMAILS.includes(email)) {
      const passwordError = validatePasswordStrength(password);
      if (passwordError) {
        throw new AppError(passwordError, 400);
      }
    }

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
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { email, password } = parsed.data;

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
    res.json({
      success: true,
      message: 'Sesión cerrada correctamente',
    });
  } catch (error) {
    next(error);
  }
};

// Refrescar tokens (access token expirado, refresh token válido)
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      throw new AppError('Refresh token es requerido', 400);
    }

    let decoded: { id: string };
    try {
      decoded = jwt.verify(token, config.JWT_SECRET as string) as { id: string };
    } catch (err) {
      throw new AppError('Refresh token inválido o expirado', 401);
    }

    const user = await prisma.usuario.findUnique({
      where: { id: decoded.id },
    });

    if (!user || !user.activo) {
      throw new AppError('Usuario no encontrado o inactivo', 401);
    }

    const tokens = generateTokens(user.id);

    res.json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    next(error);
  }
};
