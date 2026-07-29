import { NextFunction, Response } from 'express';
import { Rol } from '@prisma/client';
import prisma from '../lib/prisma';
import { AuthRequest, AuthUser } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';

export type ActorType = 'generador' | 'transportista' | 'operador';
export type ManifestAction = 'read' | 'generador' | 'transportista' | 'operador';

const actorIdField: Record<ActorType, 'generadorId' | 'transportistaId' | 'operadorId'> = {
  generador: 'generadorId',
  transportista: 'transportistaId',
  operador: 'operadorId',
};

const actorRelationField: Record<ActorType, 'generador' | 'transportista' | 'operador'> = {
  generador: 'generador',
  transportista: 'transportista',
  operador: 'operador',
};

const actorAdminRole: Record<ActorType, Rol> = {
  generador: 'ADMIN_GENERADOR',
  transportista: 'ADMIN_TRANSPORTISTA',
  operador: 'ADMIN_OPERADOR',
};

export const NO_ACCESS_WHERE = { id: '__NO_ACCESS__' };

export function isRootAdmin(user?: Pick<AuthUser, 'rol'> | null): boolean {
  return user?.rol === 'ADMIN';
}

export function isReadAllUser(user?: Pick<AuthUser, 'rol' | 'esInspector'> | null): boolean {
  return isRootAdmin(user) || !!user?.esInspector;
}

export function isActorTypeAdmin(user: Pick<AuthUser, 'rol'> | undefined, actorType: ActorType): boolean {
  return !!user && user.rol === actorAdminRole[actorType];
}

export function userActorId(user: AuthUser | undefined, actorType: ActorType): string | null {
  return (user?.[actorRelationField[actorType]]?.id as string | undefined) ?? null;
}

export function canAccessActor(
  user: AuthUser | undefined,
  actorType: ActorType,
  actorId: string,
  mode: 'read' | 'write' = 'read'
): boolean {
  if (!user) return false;
  if (isRootAdmin(user)) return true;
  if (mode === 'read' && user.esInspector) return true;
  if (isActorTypeAdmin(user, actorType)) return true;
  return userActorId(user, actorType) === actorId;
}

export function buildActorWhere(user: AuthUser | undefined, actorType: ActorType): Record<string, unknown> {
  if (!user) return NO_ACCESS_WHERE;
  if (isReadAllUser(user) || isActorTypeAdmin(user, actorType)) return {};
  const id = userActorId(user, actorType);
  return id ? { id } : NO_ACCESS_WHERE;
}

export function buildManifestAccessWhere(user: AuthUser | undefined): Record<string, unknown> {
  if (!user) return NO_ACCESS_WHERE;
  if (isReadAllUser(user)) return {};

  if ((user.rol === 'GENERADOR' || user.rol === 'ADMIN_GENERADOR') && user.generador?.id) {
    return { generadorId: user.generador.id };
  }
  if ((user.rol === 'TRANSPORTISTA' || user.rol === 'ADMIN_TRANSPORTISTA') && user.transportista?.id) {
    return { transportistaId: user.transportista.id };
  }
  if ((user.rol === 'OPERADOR' || user.rol === 'ADMIN_OPERADOR') && user.operador?.id) {
    return { operadorId: user.operador.id };
  }

  return NO_ACCESS_WHERE;
}

export function canAccessManifestRecord(
  user: AuthUser | undefined,
  manifiesto: { generadorId: string; transportistaId: string | null; operadorId: string },
  action: ManifestAction = 'read'
): boolean {
  if (!user) return false;
  if (isRootAdmin(user)) return true;
  if (action === 'read' && user.esInspector) return true;

  const checks: ActorType[] =
    action === 'read'
      ? ['generador', 'transportista', 'operador']
      : [action];

  return checks.some((actorType) => {
    const expected = manifiesto[actorIdField[actorType]];
    return !!expected && userActorId(user, actorType) === expected;
  });
}

function decodeRepeated(value: string): string {
  let decoded = value;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

export function isUnsafePathSegment(value: string | undefined): boolean {
  if (!value) return true;
  const decoded = decodeRepeated(value);
  return decoded.includes('/') || decoded.includes('\\') || decoded.includes('..') || decoded.includes('\0');
}

export const rejectUnsafePathParams = (...paramNames: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const unsafe = paramNames.some((name) => isUnsafePathSegment(req.params[name]));
    if (unsafe) {
      return next(new AppError('Identificador invalido', 400));
    }
    next();
  };
};

export const requireManifestAccess = (
  action: ManifestAction = 'read',
  paramName = 'id'
) => async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const id = req.params[paramName];
    if (isUnsafePathSegment(id)) throw new AppError('Identificador invalido', 400);

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      select: { generadorId: true, transportistaId: true, operadorId: true },
    });

    if (!manifiesto) throw new AppError('Manifiesto no encontrado', 404);
    if (!canAccessManifestRecord(req.user, manifiesto, action)) {
      throw new AppError('No tiene permisos sobre este manifiesto', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireActorAccess = (
  actorType: ActorType,
  paramName = 'id',
  mode: 'read' | 'write' = 'read'
) => async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const id = req.params[paramName];
  if (isUnsafePathSegment(id)) return next(new AppError('Identificador invalido', 400));
  if (!canAccessActor(req.user, actorType, id, mode)) {
    return next(new AppError('No tiene permisos sobre este actor', 403));
  }
  next();
};

export const requireDocumentoAccess = (
  mode: 'read' | 'review' | 'delete' = 'read',
  paramName = 'docId'
) => async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const docId = req.params[paramName];
    if (isUnsafePathSegment(docId)) throw new AppError('Identificador invalido', 400);

    const doc = await prisma.documento.findUnique({
      where: { id: docId },
      select: { generadorId: true, operadorId: true },
    });

    if (!doc) throw new AppError('Documento no encontrado', 404);

    const actorType: ActorType = doc.generadorId ? 'generador' : 'operador';
    const actorId = doc.generadorId ?? doc.operadorId;
    if (!actorId) throw new AppError('Documento sin actor asociado', 403);

    if (mode === 'review') {
      if (!isRootAdmin(req.user) && !isActorTypeAdmin(req.user, actorType)) {
        throw new AppError('No tiene permisos para revisar este documento', 403);
      }
    } else if (!canAccessActor(req.user, actorType, actorId, mode === 'read' ? 'read' : 'write')) {
      throw new AppError('No tiene permisos sobre este documento', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireSolicitudAccess = (
  mode: 'read' | 'write' | 'admin' = 'read',
  paramName = 'id'
) => async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const id = req.params[paramName];
    if (isUnsafePathSegment(id)) throw new AppError('Identificador invalido', 400);

    const solicitud = await prisma.solicitudInscripcion.findUnique({
      where: { id },
      select: { usuarioId: true, tipoActor: true },
    });
    if (!solicitud) throw new AppError('Solicitud no encontrada', 404);

    const user = req.user;
    const adminAllowed =
      isRootAdmin(user) ||
      (solicitud.tipoActor === 'GENERADOR' && user?.rol === 'ADMIN_GENERADOR') ||
      (solicitud.tipoActor === 'TRANSPORTISTA' && user?.rol === 'ADMIN_TRANSPORTISTA') ||
      (solicitud.tipoActor === 'OPERADOR' && user?.rol === 'ADMIN_OPERADOR');

    if (mode === 'admin') {
      if (!adminAllowed) throw new AppError('No tiene permisos para revisar esta solicitud', 403);
    } else if (solicitud.usuarioId !== user?.id && !adminAllowed) {
      throw new AppError('No tiene permisos sobre esta solicitud', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};
