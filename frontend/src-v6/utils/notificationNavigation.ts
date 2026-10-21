import type { Notificacion } from '../types/models';
import { cataloguePath } from './alertCatalogue';
import type { QueryClient } from '@tanstack/react-query';

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

/** Opening a workflow notice must refresh its linked expediente/application. */
export function refreshInspectionNotification(notificacion: Notificacion, queryClient: QueryClient): void {
  const data = parseNotificationData(notificacion.datos);
  if (data.tipo === 'adenda_manifiesto') void queryClient.invalidateQueries({ queryKey: ['manifiesto-adendas'] });
  if (data.tipo === 'propuesta_partes') {
    for (const key of ['manifiestos','manifest-proposal','training-tasks','manifest-agenda']) void queryClient.invalidateQueries({ queryKey: [key] });
  }
  if (data.tipo === 'manifiesto_eventual' && data.version === 1) void queryClient.invalidateQueries({ queryKey: ['baja-intensidad'] });
  if (data.tipo === 'antecedente_fiscalizacion' && data.version === 1) void queryClient.invalidateQueries({ queryKey: ['inspection-intakes'] });
  if (typeof data.solicitudId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.solicitudId)) {
    void queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
  }
  if (['intercambio_inspeccion', 'agenda_inspeccion'].includes(String(data.tipo)) && data.version === 1) {
    void queryClient.invalidateQueries({ queryKey: ['inspecciones'] });
  }
}

/** The action describes the resolved destination, including notices without a manifest. */
export function notificationActionLabel(path: string): string {
  const [pathname, query = ''] = path.replace(/^\/app(?=\/|$)/, '').split('#')[0].split('?');
  if (pathname === '/inspecciones' && new URLSearchParams(query).get('vista') === 'antecedentes') return 'Abrir cola de revisión →';
  if (/^\/(?:admin\/solicitudes\/|mi-solicitud$)/.test(pathname)) return 'Abrir solicitud y ver su estado →';
  if (/^\/(?:mis-)?inspecciones\//.test(pathname)) return 'Abrir expediente y ver el intercambio →';
  if (/^\/(?:mis-)?inspecciones$/.test(pathname)) return 'Abrir inspecciones →';
  if (/^\/soporte(?:\/|$)/.test(pathname)) return 'Abrir consulta de soporte →';
  if (pathname === '/mi-perfil') return 'Abrir mi ficha y documentos →';
  if (pathname === '/admin/usuarios') return 'Revisar cuentas de usuarios →';
  if (pathname === '/admin/renovaciones') return 'Revisar solicitud de cambio →';
  if (pathname === '/alertas') return 'Revisar alerta →';
  if (/^\/manifiestos\/[^/]+\/adendas$/.test(pathname)) return 'Abrir adenda y revisiones →';
  if (/^\/manifiestos(?:\/|$)/.test(pathname)) return 'Abrir manifiesto y ver qué sigue →';
  return 'Abrir detalle →';
}

export function resolveNotificationPath(notificacion: Notificacion, basePath = '', recipientRole?: string): string {
  const data = parseNotificationData(notificacion.datos);
  if (data.tipo === 'manifiesto_eventual') {
    return withBasePath(data.version === 1 && typeof data.registroId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.registroId)
      ? '/manifiestos/baja-intensidad?registro=' + encodeURIComponent(data.registroId) : '/notificaciones', basePath);
  }
  if (['intercambio_inspeccion', 'agenda_inspeccion'].includes(String(data.tipo))) {
    if (data.version !== 1 || typeof data.inspeccionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(data.inspeccionId)
      || !['participacion', 'inspeccion'].includes(String(data.destino))) return withBasePath('/notificaciones', basePath);
    return withBasePath(data.destino === 'participacion' ? `/mis-inspecciones/${data.inspeccionId}` : `/inspecciones/${data.inspeccionId}${data.tipo === 'intercambio_inspeccion' ? '#intercambios' : ''}`, basePath);
  }
  const target = cataloguePath(notificacion.datos, true);
  if (data.familia === 'catalogo_verificable') return withBasePath(target || '/notificaciones', basePath);
  const explicitPath = typeof data.url === 'string'
    ? data.url
    : typeof data.ruta === 'string'
      ? data.ruta
      : undefined;

  if (explicitPath?.startsWith('/')) return withBasePath(explicitPath, basePath);
  if (data.tipo === 'nuevo_registro') return withBasePath('/admin/usuarios', basePath);
  if (String(notificacion.tipo) === 'MODIFICACION_SOLICITADA' && typeof data.renovacionId === 'string') return withBasePath('/admin/renovaciones', basePath);
  if (data.tipo === 'certificado_ambiental' && typeof data.actorId === 'string' && data.actorId && ['generador', 'operador', 'transportista'].includes(String(data.actorTipo))) {
    return withBasePath('/mi-perfil', basePath);
  }
  if (typeof data.solicitudId === 'string') {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(data.solicitudId)) return withBasePath('/notificaciones', basePath);
    const applicant = ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(recipientRole || '')
      || ['solicitud_observada', 'solicitud_aprobada', 'solicitud_rechazada'].includes(String(data.tipo));
    return withBasePath(applicant ? `/mi-solicitud?solicitud=${data.solicitudId}` : `/admin/solicitudes/${data.solicitudId}`, basePath);
  }
  if (typeof data.inspeccionId === 'string') return withBasePath(`/inspecciones/${data.inspeccionId}`, basePath);
  if (notificacion.manifiestoId) return withBasePath(`/manifiestos/${notificacion.manifiestoId}`, basePath);
  if (typeof data.alertaId === 'string') return withBasePath('/alertas', basePath);
  return withBasePath('/notificaciones', basePath);
}
