import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Rol } from '@prisma/client';
import { config } from '../config/config';
import { AppError } from './errorHandler';
import prisma from '../lib/prisma';
import { isFullAccess } from '../utils/roleFilter';
import { verifiedImpersonator } from '../services/impersonationIdentity.service';
import { accountActivities } from '../services/actorActivities.service';
import { isActorActivity } from '../domain/actorActivities';
import { resolveCompanyContext } from '../services/empresa.service';
import { TRAINING_LOGINS, validateDirectTrainingClaim } from '../lib/trainingDirectLogin';
import { isTrainingSession, TRAINING_REALM } from '../lib/trainingScope';

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
  impersonatedBy?: { id: string; nombre: string };
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
    const decoded = jwt.verify(token, config.JWT_SECRET as string) as jwt.JwtPayload & { id: string; restricted?: boolean; registrationDraft?: string; impersonatedBy?: unknown };

    if (decoded.trainingDirect !== undefined) validateDirectTrainingClaim(decoded);
    if (decoded.realm !== undefined && (!isTrainingSession() || decoded.realm !== TRAINING_REALM)) {
      throw new AppError('Ámbito de capacitación requerido', 401);
    }

    // Before email verification this token may only operate on its own draft.
    // Do not grant access to another actor, inspection or admin endpoint.
    if (decoded.registrationDraft) {
      const draftPath = `/api/solicitudes/${decoded.registrationDraft}`;
      if (!decoded.restricted || (req.originalUrl !== draftPath && !req.originalUrl.startsWith(`${draftPath}/`))) {
        throw new AppError('La sesión de alta sólo permite editar su propia solicitud', 403);
      }
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
        motivoInactividad: true,
        emailVerified: true,
        esInspector: true,
        generador: true,
        transportista: true,
        operador: true,
      },
    });

    if (!user) {
      throw new AppError('Usuario no autorizado', 401);
    }

    if (decoded.trainingDirect !== undefined) {
      validateDirectTrainingClaim(decoded);
      const account = TRAINING_LOGINS.find(item => item.id === user.id);
      if (!isTrainingSession() || !account || user.email !== account.id + '@capacitacion.invalid'
        || user.rol !== account.rol || !user.activo || !user.emailVerified) throw new AppError('Sesión de capacitación inválida', 401);
    }

    // Block inactive users UNLESS they have a restricted token
    if (!user.activo && (!decoded.restricted || user.motivoInactividad === 'SUSPENDIDA')) {
      throw new AppError('Usuario no autorizado o inactivo', 401);
    }

    // Adjuntar el usuario al objeto de solicitud (with restricted flag)
    const impersonatedBy = await verifiedImpersonator(decoded.impersonatedBy, user.id, decoded.restricted);
    req.user = { ...user, restricted: decoded.restricted || false, ...(impersonatedBy ? { impersonatedBy } : {}) };
    const enterprise = await resolveCompanyContext(req.user, req.headers);
    if (enterprise) {
      if(req.headers['x-sitrep-activity']!==undefined)throw new AppError('Elegí actividad personal o empresa, no ambas',400);
      req.user = { ...req.user, rolBase:user.rol, rol:enterprise.context.rol, esInspector:false,
        generador:null,transportista:null,operador:null,[enterprise.key]:enterprise.actor,empresaContexto:enterprise.context };
      // These legacy sections lack a per-establishment historical contract.
      // Restricted delegates cannot inherit company-wide records through them.
      if(!enterprise.context.todasSedes&&!/^\/api\/(?:auth\/profile|manifiestos|pdf|catalogos|notificaciones|soporte)(?:[/?]|$)/.test(req.originalUrl)) {
        throw new AppError('Esta sección requiere autorización para todos los establecimientos de la empresa',403);
      }
    }
    // Per-request activity, not a mutation of Usuario.rol or another tab's JWT.
    const activity = req.headers['x-sitrep-activity'];
    if (activity !== undefined && !enterprise) {
      if (process.env.ACTOR_MULTIROLE_ENABLED !== 'true' || decoded.restricted || impersonatedBy
        || !user.activo || !isActorActivity(user.rol) || !isActorActivity(activity)
        || !(await accountActivities(user)).includes(activity)) {
        throw new AppError('Actividad no aprobada para esta cuenta', 403);
      }
      req.user.rolBase = user.rol;
      req.user.rol = activity;
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

export type ActorRecordType = 'generador' | 'transportista' | 'operador';
type ActorRecordUser = Pick<AuthUser, 'rol' | 'restricted' | 'esInspector' | 'generador' | 'transportista' | 'operador'>;

// An actor ID is not permission. Cross-sector administration and inspection
// grant consultation only; mutation routes keep their separate sector guards.
export function canReadActorRecord(user: ActorRecordUser | undefined, type: ActorRecordType, actorId: string): boolean {
  if (!user || user.restricted || !actorId) return false;
  return isFullAccess(user) || (user.rol === type.toUpperCase() && user[type]?.id === actorId);
}

export const requireActorRead = (type: ActorRecordType) =>
  (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!canReadActorRecord(req.user, type, req.params.id)) {
      return next(new AppError('No tiene permisos para consultar esta ficha', 403));
    }
    next();
  };

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
