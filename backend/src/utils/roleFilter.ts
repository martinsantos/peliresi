export function isFullAccess(user: { rol: string; esInspector?: boolean }): boolean {
  return (
    ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'].includes(user.rol) ||
    !!user.esInspector
  );
}

export function applyRoleFilter(
  where: Record<string, unknown>,
  user: {
    rol: string;
    generador?: { id: string } | null;
    transportista?: { id: string } | null;
    operador?: { id: string } | null;
    esInspector?: boolean;
  }
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
