import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Rol } from '@prisma/client';
import { config } from '../config/config';
import { AppError } from './errorHandler';
import prisma from '../lib/prisma';

/** Shape of req.user set by isAuthenticated middleware. */
export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  esInspector: boolean;
  generador: { id: string; [key: string]: unknown } | null;
  transportista: { id: string; [key: string]: unknown } | null;
  operador: { id: string; [key: string]: unknown } | null;
  restricted: boolean;
}

export interface AuthRequest extends Request {
  // Typed as `any` for backward compatibility with existing controller code
  // that accesses req.user without null-checks. See AuthUser for the runtime shape.
  user?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const isAuthenticated = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Obtener el token del encabezado
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No autorizado - Token no proporcionado', 401);
    }

    const token = authHeader.split(' ')[1];
    
    // Verificar el token
    const decoded = jwt.verify(token, config.JWT_SECRET as string) as { id: string; restricted?: boolean };

    // Obtener el usuario de la base de datos
    const user = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        activo: true,
        esInspector: true,
        generador: true,
        transportista: true,
        operador: true,
      },
    });

    if (!user) {
      throw new AppError('Usuario no autorizado', 401);
    }

    // Block inactive users UNLESS they have a restricted token
    if (!user.activo && !decoded.restricted) {
      throw new AppError('Usuario no autorizado o inactivo', 401);
    }

    // Adjuntar el usuario al objeto de solicitud (with restricted flag)
    req.user = { ...user, restricted: decoded.restricted || false };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('No autorizado - Token inválido', 401));
    } else {
      next(error);
    }
  }
};

// Middleware para verificar roles
export const hasRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('No autorizado', 401));
    }

    if (!roles.includes(req.user.rol)) {
      return next(
        new AppError('No tiene permisos para realizar esta acción', 403)
      );
    }

    next();
  };
};

// Alias semánticos para sub-admins
export const requireRole = (roles: string[]) => hasRole(...roles);

export const requireAnyAdmin        = hasRole('ADMIN', 'ADMIN_TRANSPORTISTA', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR');
export const requireAdminOrTransportista = hasRole('ADMIN', 'ADMIN_TRANSPORTISTA');
export const requireAdminOrGenerador     = hasRole('ADMIN', 'ADMIN_GENERADOR');
export const requireAdminOrOperador      = hasRole('ADMIN', 'ADMIN_OPERADOR');

// Allow restricted users (candidates with pending solicitudes)
export const allowRestricted = (_req: AuthRequest, _res: Response, next: NextFunction) => {
  next();
};

// Block restricted users from full-access routes
export const requireFullAccess = (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (req.user?.restricted) {
    return next(new AppError('Acceso restringido - Tu solicitud esta siendo procesada', 403));
  }
  next();
};
