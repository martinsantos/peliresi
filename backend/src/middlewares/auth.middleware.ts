import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Rol } from '@prisma/client';
import { config } from '../config/config';
import { AppError } from './errorHandler';
import prisma from '../lib/prisma';
import { ADMIN_ROLES, isPrivilegedAccessUser } from '../utils/privilegedAccess';

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
  esDemo?: boolean;
  demoExpiresAt?: Date | null;
  forcePasswordChange?: boolean;
}

export interface AuthRequest extends Request {
  // Typed as `any` for backward compatibility with existing controller code
  // that accesses req.user without null-checks. See AuthUser for the runtime shape.
  user?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const AUDITOR_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const AUDITOR_ACCOUNT_ACTIONS = new Set([
  '/api/auth/logout',
  '/api/auth/change-password',
]);

/**
 * AUDITOR is read-only across the whole authenticated API. Keeping this at the
 * authentication boundary prevents a newly-added mutation route from silently
 * bypassing role-specific guards. Account logout/password rotation are the only
 * deliberate non-business exceptions.
 */
export function canAuditorAccessRequest(method: string, originalUrl: string): boolean {
  if (AUDITOR_SAFE_METHODS.has(method.toUpperCase())) return true;
  const path = originalUrl.split('?')[0].replace(/\/$/, '');
  return AUDITOR_ACCOUNT_ACTIONS.has(path);
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
    const decoded = jwt.verify(token, config.JWT_SECRET as string) as { id: string; restricted?: boolean; iat?: number };

    // Check token revocation (blacklist)
    const blacklisted = await prisma.refreshToken.findFirst({
      where: { token, revocado: true },
    });
    if (blacklisted) {
      throw new AppError('No autorizado - Token revocado, inicie sesión nuevamente', 401);
    }

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
        esDemo: true,
        demoExpiresAt: true,
        forcePasswordChange: true,
        passwordChangedAt: true,
      },
    });

    if (!user) {
      throw new AppError('Usuario no autorizado', 401);
    }

    // Password changes invalidate access tokens issued before the change.
    if (user.passwordChangedAt && decoded.iat && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
      throw new AppError('Sesión invalidada por cambio de contraseña', 401);
    }

    // Block inactive users UNLESS they have a restricted token
    if (!user.activo && !decoded.restricted) {
      throw new AppError('Usuario no autorizado o inactivo', 401);
    }

    // Adjuntar el usuario al objeto de solicitud (with restricted flag)
    req.user = { ...user, restricted: decoded.restricted || false };

    if (user.rol === 'AUDITOR' && !canAuditorAccessRequest(req.method, req.originalUrl)) {
      throw new AppError('El rol AUDITOR es de solo lectura', 403);
    }
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

    if (req.user.restricted) {
      return next(new AppError('Acceso restringido - Tu solicitud esta siendo procesada', 403));
    }

    // Every admin-flavored role is explicitly allowlisted in production.
    // This prevents a historical/accidental admin account from retaining
    // global administration merely because its scalar role is ADMIN_*.
    if (ADMIN_ROLES.has(String(req.user.rol)) && !isPrivilegedAccessUser(req.user)) {
      return next(new AppError('Cuenta administrativa no autorizada para este entorno', 403));
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
  if (req.user?.forcePasswordChange) {
    return next(new AppError('Debes cambiar tu contraseña antes de continuar', 403));
  }
  next();
};
