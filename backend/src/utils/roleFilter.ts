import { buildManifestAccessWhere, isReadAllUser } from './authorization';

export function isFullAccess(user: { rol: string; esInspector?: boolean }): boolean {
  return isReadAllUser(user as any);
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
  Object.assign(where, buildManifestAccessWhere(user as any));
}
