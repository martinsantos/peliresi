import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config, isProduction, isDemoEnvironment } from '../config/config';
import { AppError } from './errorHandler';
import { redisService, CACHE_TTL, CACHE_PREFIX } from '../lib/redis';
import {
  ERROR_CODES,
  AppErrorWithCode,
  createRoleMismatchError,
  getRoleName
} from '../utils/errors';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: any;
  demoProfile?: {
    enabled: boolean;
    originalRole: string;
    impersonatedRole: string;
    impersonatedActorId?: string;
    impersonatedActorName?: string;
  };
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
      throw new AppErrorWithCode(ERROR_CODES.AUTH_TOKEN_MISSING);
    }

    const token = authHeader.split(' ')[1];

    // Verificar el token
    let decoded: { id: string };
    try {
      decoded = jwt.verify(token, config.JWT_SECRET as string) as { id: string };
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        throw new AppErrorWithCode(ERROR_CODES.AUTH_TOKEN_EXPIRED);
      }
      throw new AppErrorWithCode(ERROR_CODES.AUTH_TOKEN_INVALID);
    }

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
          nombre: true,
          apellido: true,
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
      throw new AppErrorWithCode(ERROR_CODES.AUTH_SESSION_EXPIRED);
    }

    // Adjuntar el usuario al objeto de solicitud
    req.user = user;

    // Procesar Demo Profile si está habilitado
    await processDemoProfile(req);

    next();
  } catch (error) {
    if (error instanceof AppErrorWithCode) {
      return res.status(error.httpStatus).json(error.toJSON());
    }
    if (error instanceof jwt.JsonWebTokenError) {
      const appError = new AppErrorWithCode(ERROR_CODES.AUTH_TOKEN_INVALID);
      return res.status(appError.httpStatus).json(appError.toJSON());
    }
    next(error);
  }
};

/**
 * Procesar perfil de demo si está habilitado
 * Permite cambiar de rol/actor en ambiente de desarrollo
 */
async function processDemoProfile(req: AuthRequest) {
  const demoProfileHeader = req.headers['x-demo-profile'] as string;

  if (!demoProfileHeader) return;

  // Solo permitir en ambiente DEMO (no producción estricta)
  if (isProduction() && !isDemoEnvironment()) {
    console.warn(`[AUTH] BLOCKED: Demo profile en producción por ${req.user.email}`);
    return;
  }

  try {
    const demoProfile = JSON.parse(demoProfileHeader);
    const { role, actorId } = demoProfile;

    if (!role) return;

    // Cargar actor si se especificó
    let impersonatedActor: any = null;
    if (actorId) {
      if (role === 'GENERADOR') {
        impersonatedActor = await prisma.generador.findUnique({
          where: { id: actorId },
          select: { id: true, razonSocial: true, usuarioId: true }
        });
      } else if (role === 'TRANSPORTISTA') {
        impersonatedActor = await prisma.transportista.findUnique({
          where: { id: actorId },
          select: { id: true, razonSocial: true, usuarioId: true }
        });
      } else if (role === 'OPERADOR') {
        impersonatedActor = await prisma.operador.findUnique({
          where: { id: actorId },
          select: { id: true, razonSocial: true, usuarioId: true }
        });
      }
    }

    // Guardar info del demo profile
    req.demoProfile = {
      enabled: true,
      originalRole: req.user.rol,
      impersonatedRole: role,
      impersonatedActorId: impersonatedActor?.id,
      impersonatedActorName: impersonatedActor?.razonSocial
    };

    // Modificar el usuario para el contexto de la request
    req.user.rol = role;
    if (impersonatedActor) {
      if (role === 'GENERADOR') {
        req.user.generador = impersonatedActor;
      } else if (role === 'TRANSPORTISTA') {
        req.user.transportista = impersonatedActor;
      } else if (role === 'OPERADOR') {
        req.user.operador = impersonatedActor;
      }
    }

    console.log(`[DEMO] ${req.user.email} actuando como ${role}${impersonatedActor ? ` (${impersonatedActor.razonSocial})` : ''}`);
  } catch (e) {
    console.error('[AUTH] Error parsing demo profile:', e);
  }
}

// Middleware para verificar roles con errores descriptivos
export const hasRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      const error = new AppErrorWithCode(ERROR_CODES.AUTH_TOKEN_MISSING);
      return res.status(error.httpStatus).json(error.toJSON());
    }

    // El Super Administrador (ADMIN) siempre tiene acceso
    if (req.user.rol === 'ADMIN') {
      console.log(`[AUTH] Bypass ADMIN para usuario: ${req.user.email}`);
      return next();
    }

    const effectiveRole = req.user.rol;

    // Verificar si el demo profile está activo
    if (req.demoProfile?.enabled) {
      console.log(`[AUTH] Demo profile activo: ${req.user.email} como ${effectiveRole}`);
    }

    console.log(`[AUTH] Verificando rol. Usuario: ${req.user.email}, Rol: "${effectiveRole}", Requeridos: ${JSON.stringify(roles)}`);

    if (!roles.includes(effectiveRole)) {
      console.log(`[AUTH] 403 Forbidden para ${req.user.email}. Rol "${effectiveRole}" no está en ${JSON.stringify(roles)}`);

      // Crear error descriptivo con contexto
      const error = createRoleMismatchError(
        getRoleName(effectiveRole),
        roles.map(getRoleName),
        getActionNameFromPath(req.path)
      );

      return res.status(error.httpStatus).json(error.toJSON());
    }

    next();
  };
};

/**
 * Obtener nombre de acción legible desde la ruta
 */
function getActionNameFromPath(path: string): string {
  const actionMap: Record<string, string> = {
    'confirmar-recepcion': 'Confirmar Recepción',
    'confirmar-retiro': 'Confirmar Retiro',
    'confirmar-entrega': 'Confirmar Entrega',
    'pesaje': 'Registrar Pesaje',
    'tratamiento': 'Registrar Tratamiento',
    'cerrar': 'Cerrar Manifiesto',
    'firmar': 'Firmar Manifiesto',
    'aprobar': 'Aprobar Manifiesto',
    'rechazar': 'Rechazar Carga',
    'enviar-aprobacion': 'Enviar a Aprobación',
    'revertir': 'Revertir Estado'
  };

  for (const [key, value] of Object.entries(actionMap)) {
    if (path.includes(key)) return value;
  }

  return 'esta acción';
}

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

