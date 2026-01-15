import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/config';
import { AppError } from './errorHandler';
import { redisService, CACHE_TTL, CACHE_PREFIX } from '../lib/redis';

const prisma = new PrismaClient();

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

    // OPTIMIZACIÓN: Intentar obtener usuario de caché Redis
    const cacheKey = `${CACHE_PREFIX.USER}${decoded.id}`;
    let user = await redisService.get<typeof req.user>(cacheKey);

    if (!user) {
      // Cache miss - obtener de base de datos
      user = await prisma.usuario.findUnique({
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

      // Guardar en caché si usuario válido (5 min TTL)
      if (user && user.activo) {
        await redisService.set(cacheKey, user, CACHE_TTL.USER);
      }
    }

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

    // El Super Administrador (ADMIN) siempre tiene acceso
    if (req.user.rol === 'ADMIN') {
      console.log(`[AUTH] Bypass ADMIN para usuario: ${req.user.email}`);
      return next();
    }

    // DEMO MODE: Permitir override de rol para demos
    const isDemoMode = req.headers['x-demo-mode'] === 'true';
    const demoRole = req.headers['x-demo-role'] as string;
    const effectiveRole = (isDemoMode && demoRole) ? demoRole : req.user.rol;

    if (isDemoMode && demoRole) {
      console.log(`[AUTH] DEMO MODE: Usuario ${req.user.email} usando rol simulado "${demoRole}" (rol real: ${req.user.rol})`);
    }

    console.log(`[AUTH] Verificando rol. Usuario: ${req.user.email}, Rol efectivo: "${effectiveRole}", Roles requeridos: ${JSON.stringify(roles)}`);
    if (!roles.includes(effectiveRole)) {
      console.log(`[AUTH] 403 Forbidden para ${req.user.email}. El rol "${effectiveRole}" no está en ${JSON.stringify(roles)}`);
      return next(
        new AppError('No tiene permisos para realizar esta acción', 403)
      );
    }

    next();
  };
};

// Alias para compatibilidad
export const authMiddleware = isAuthenticated;

// ============================================
// Sistema de Permisos Granulares (CU-A04)
// ============================================

// Definición de permisos por rol
const PERMISSIONS_BY_ROLE: Record<string, string[]> = {
  ADMIN: [
    'manifiestos:read', 'manifiestos:write', 'manifiestos:delete', 'manifiestos:revertir',
    'usuarios:read', 'usuarios:write', 'usuarios:delete',
    'generadores:read', 'generadores:write', 'generadores:delete',
    'transportistas:read', 'transportistas:write', 'transportistas:delete',
    'operadores:read', 'operadores:write', 'operadores:delete',
    'reportes:read', 'reportes:export',
    'auditoria:read',
    'alertas:read', 'alertas:write',
    'configuracion:read', 'configuracion:write',
    'logs:read', 'logs:export'
  ],
  // Admin Sectorial de Transportistas
  ADMIN_TRANSPORTISTAS: [
    'transportistas:read', 'transportistas:write', 'transportistas:delete', 'transportistas:aprobar',
    'vehiculos:read', 'vehiculos:write', 'vehiculos:delete',
    'choferes:read', 'choferes:write', 'choferes:delete',
    'manifiestos:read', // Solo lectura de manifiestos
    'manifiestos:revertir:transportista', // Puede revertir estados de transportistas
    'reportes:read:transportistas',
    'usuarios:read:transportistas', 'usuarios:write:transportistas',
    'logs:read:sector'
  ],
  // Admin Sectorial de Operadores
  ADMIN_OPERADORES: [
    'operadores:read', 'operadores:write', 'operadores:delete', 'operadores:aprobar',
    'tratamientos:read', 'tratamientos:write', 'tratamientos:delete',
    'manifiestos:read', // Solo lectura de manifiestos
    'manifiestos:revertir:operador', // Puede revertir estados de operadores
    'reportes:read:operadores',
    'usuarios:read:operadores', 'usuarios:write:operadores',
    'logs:read:sector'
  ],
  // Admin Sectorial de Generadores
  ADMIN_GENERADORES: [
    'generadores:read', 'generadores:write', 'generadores:delete', 'generadores:aprobar',
    'manifiestos:read', // Solo lectura de manifiestos
    'reportes:read:generadores',
    'usuarios:read:generadores', 'usuarios:write:generadores',
    'logs:read:sector'
  ],
  GENERADOR: [
    'manifiestos:read', 'manifiestos:write',
    'perfil:read', 'perfil:write',
    'reportes:read'
  ],
  TRANSPORTISTA: [
    'manifiestos:read', 'manifiestos:update-status',
    'manifiestos:revertir:transportista', // Puede revertir sus entregas
    'tracking:write',
    'perfil:read', 'perfil:write'
  ],
  OPERADOR: [
    'manifiestos:read', 'manifiestos:update-status', 'manifiestos:close',
    'manifiestos:revertir:operador', // Puede revertir sus recepciones
    'recepcion:write',
    'tratamiento:write',
    'certificados:write',
    'perfil:read', 'perfil:write'
  ]
};

// Roles que tienen permisos de administrador (bypass en hasRole)
const ADMIN_ROLES = ['ADMIN', 'ADMIN_TRANSPORTISTAS', 'ADMIN_OPERADORES', 'ADMIN_GENERADORES'];

/**
 * Middleware para verificar permisos específicos
 * @param requiredPermission - Permiso requerido en formato "recurso:accion"
 */
export const hasPermission = (requiredPermission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('No autorizado', 401));
    }

    const userRole = req.user.rol as string;
    const userPermissions = PERMISSIONS_BY_ROLE[userRole] || [];

    if (!userPermissions.includes(requiredPermission)) {
      return next(
        new AppError(`Permiso denegado: ${requiredPermission}`, 403)
      );
    }

    next();
  };
};

/**
 * Middleware para verificar múltiples permisos (cualquiera de ellos)
 */
export const hasAnyPermission = (...permissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('No autorizado', 401));
    }

    const userRole = req.user.rol as string;
    const userPermissions = PERMISSIONS_BY_ROLE[userRole] || [];

    const hasAny = permissions.some(p => userPermissions.includes(p));
    if (!hasAny) {
      return next(
        new AppError(`Permisos insuficientes`, 403)
      );
    }

    next();
  };
};

