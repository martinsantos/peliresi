import { AppError } from '../middlewares/errorHandler';

type ActorScopedUser = {
  rol: string;
  generador?: { id: string } | null;
  transportista?: { id: string } | null;
  operador?: { id: string } | null;
  esInspector?: boolean;
};

type ManifiestoActorScope = {
  generadorId?: string | null;
  transportistaId?: string | null;
  operadorId?: string | null;
};

export function isFullAccess(user: { rol: string; esInspector?: boolean }): boolean {
  return (
    ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'].includes(user.rol) ||
    !!user.esInspector
  );
}

export function applyRoleFilter(
  where: Record<string, unknown>,
  user: ActorScopedUser
): void {
  if (isFullAccess(user)) return;

  if (user.rol === 'GENERADOR' && user.generador) {
    where.generadorId = user.generador.id;
  } else if (user.rol === 'TRANSPORTISTA' && user.transportista) {
    where.transportistaId = user.transportista.id;
  } else if (user.rol === 'OPERADOR' && user.operador) {
    where.operadorId = user.operador.id;
  }
}

export function canAccessManifiesto(user: ActorScopedUser, manifiesto: ManifiestoActorScope): boolean {
  if (!user || !manifiesto) return false;
  if (isFullAccess(user)) return true;

  if (user.rol === 'GENERADOR' && user.generador) {
    return manifiesto.generadorId === user.generador.id;
  }
  if (user.rol === 'TRANSPORTISTA' && user.transportista) {
    return manifiesto.transportistaId === user.transportista.id;
  }
  if (user.rol === 'OPERADOR' && user.operador) {
    return manifiesto.operadorId === user.operador.id;
  }

  return false;
}

export async function assertCanAccessManifiesto(
  prismaClient: {
    manifiesto: {
      findUnique: (args: {
        where: { id: string };
        select: { id: true; generadorId: true; transportistaId: true; operadorId: true };
      }) => Promise<ManifiestoActorScope | null>;
    };
  },
  user: ActorScopedUser,
  manifiestoId: string,
): Promise<void> {
  const manifiesto = await prismaClient.manifiesto.findUnique({
    where: { id: manifiestoId },
    select: { id: true, generadorId: true, transportistaId: true, operadorId: true },
  });

  if (!manifiesto || !canAccessManifiesto(user, manifiesto)) {
    throw new AppError('Manifiesto no encontrado', 404);
  }
}
