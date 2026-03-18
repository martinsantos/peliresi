import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { AppError } from './errorHandler';
import prisma from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: any;
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
    const decoded = jwt.verify(token, config.JWT_SECRET as string) as { id: string };
    
    // Obtener el usuario de la base de datos
    const user = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        rol: true,
        activo: true,
        generador: true,
        transportista: true,
        operador: true,
      },
    });

    if (!user || !user.activo) {
      throw new AppError('Usuario no autorizado o inactivo', 401);
    }

    // Adjuntar el usuario al objeto de solicitud
    req.user = user;
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
