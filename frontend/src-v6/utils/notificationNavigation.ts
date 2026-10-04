import type { Notificacion } from '../types/models';
import { cataloguePath } from './alertCatalogue';

function parseNotificationData(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function withBasePath(path: string, basePath: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  if (!normalizedBase || normalizedPath === normalizedBase || normalizedPath.startsWith(`${normalizedBase}/`)) {
    return normalizedPath;
  }
  return `${normalizedBase}${normalizedPath}`;
}

export function resolveNotificationPath(notificacion: Notificacion, basePath = ''): string {
  const data = parseNotificationData(notificacion.datos);
  const target = cataloguePath(notificacion.datos, true);
  if (target) return withBasePath(target, basePath);
  const explicitPath = typeof data.url === 'string'
    ? data.url
    : typeof data.ruta === 'string'
      ? data.ruta
      : undefined;

  if (explicitPath?.startsWith('/')) return withBasePath(explicitPath, basePath);
  if (data.tipo === 'nuevo_registro') return withBasePath('/admin/usuarios', basePath);
  if (typeof data.solicitudId === 'string') return withBasePath(`/admin/solicitudes/${data.solicitudId}`, basePath);
  if (typeof data.inspeccionId === 'string') return withBasePath(`/inspecciones/${data.inspeccionId}`, basePath);
  if (notificacion.manifiestoId) return withBasePath(`/manifiestos/${notificacion.manifiestoId}`, basePath);
  if (typeof data.alertaId === 'string') return withBasePath('/alertas', basePath);
  return withBasePath('/notificaciones', basePath);
}
