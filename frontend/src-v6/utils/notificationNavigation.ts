import type { Notificacion } from '../types/models';
import { safeLocalRedirect } from './authRedirect';
import { cataloguePath } from './alertCatalogue';
import type { QueryClient } from '@tanstack/react-query';

/** Keep only inbox presentation filters, tied to the verified account/activity.
 * A return target never comes from an arbitrary URL supplied by a notice. */
export function notificationInboxReturnState(search: string, owner: string) {
  const raw = new URLSearchParams(search), params = new URLSearchParams();
  if (raw.get('avisos') === 'sin-leer') params.set('avisos', 'sin-leer');
  const page = Number(raw.get('pagina'));
  if (Number.isSafeInteger(page) && page > 1) params.set('pagina', String(page));
  return { notificationInboxReturn: { owner, search: params.toString() } };
}
export function notificationInboxReturnPath(state: unknown, owner: string): string {
  const entry = (state as { notificationInboxReturn?: { owner?: string; search?: unknown } } | null)?.notificationInboxReturn;
  const search = owner && entry?.owner === owner && typeof entry.search === 'string'
    ? notificationInboxReturnState(entry.search, owner).notificationInboxReturn.search : '';
  return '/notificaciones' + (search ? '?' + search : '');
}

function parseNotificationData(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function representativeManifestAlert(tipo: string, data: Record<string, unknown>): boolean {
 if (data.destino !== 'representante' || data.version !== 1) return false;
 if (tipo === 'INFO_GENERAL' && data.tipo === 'reversion_manifiesto') return true;
 if (tipo === 'ALERTA_SISTEMA' && ['duracion_transito_configurada', 'alerta_regla_manifiesto'].includes(String(data.tipo))) return true;
 if (tipo === 'VENCIMIENTO_PROXIMO' && data.tipo === 'recordatorio_firma') return true;
 const stateTypes: Record<string, string> = { EN_TRANSITO: 'MANIFIESTO_EN_TRANSITO', ENTREGADO: 'MANIFIESTO_ENTREGADO',
  RECIBIDO: 'MANIFIESTO_RECIBIDO', EN_TRATAMIENTO: 'INFO_GENERAL', TRATADO: 'MANIFIESTO_TRATADO', CANCELADO: 'INFO_GENERAL' };
 if (data.tipo === 'estado_manifiesto' && stateTypes[String(data.estado)] === tipo) return true;
 const eventTypes: Record<string, string> = { INCIDENTE: 'INCIDENTE_REPORTADO', RECHAZO: 'MANIFIESTO_RECHAZADO', DIFERENCIA_PESO: 'ALERTA_SISTEMA', ENTREGA: 'MANIFIESTO_ENTREGADO' };
 return data.tipo === 'alerta_evento_manifiesto' && eventTypes[String(data.evento)] === tipo;
}

export function notificationCompanyAccesses(notice: Pick<Notificacion, 'datos' | 'tipo'>): Array<{empresaId:string;actividadId:string;rol:string;razonSocial:string;actorId?:string;establecimientoId?:string;establecimiento?:string}> {
 const data = parseNotificationData(notice.datos), id = (v: unknown) => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
 const fiscal = data.tipo === 'recordatorio_fiscal' && data.destino === 'representante' && !!notificationFiscalReminder(notice);
 const alertRule = representativeManifestAlert(notice.tipo, data);
 const eventual = notice.tipo === 'INFO_GENERAL' && data.tipo === 'manifiesto_eventual' && data.accesoVersion === 1;
 if ((!fiscal && !alertRule && !eventual && !['certificado_manifiesto','propuesta_partes','adenda_manifiesto'].includes(String(data.tipo))) || data.version !== 1 || !Array.isArray(data.accesosEmpresa)) return [];
 return data.accesosEmpresa.filter(a => a && id(a.empresaId) && id(a.actividadId) && ['GENERADOR','TRANSPORTISTA','OPERADOR'].includes(a.rol)
  && typeof a.razonSocial === 'string' && (!a.establecimientoId || id(a.establecimientoId)) && (!a.establecimiento || typeof a.establecimiento === 'string')
  && (!fiscal || (a.rol === 'GENERADOR' && !a.establecimientoId && !a.establecimiento))
  && (!eventual || (id(a.actorId) && !a.establecimientoId && !a.establecimiento)));
}

/** Only orientation; activity and actor are checked again on the server. */
export function notificationEventualActors(notice: Pick<Notificacion, 'datos' | 'tipo'>): Array<{rol:'GENERADOR'|'TRANSPORTISTA'|'OPERADOR';actorId:string}> {
 const data = parseNotificationData(notice.datos);
 if (notice.tipo !== 'INFO_GENERAL' || data.tipo !== 'manifiesto_eventual' || data.version !== 1 || data.accesoVersion !== 1 || !Array.isArray(data.actividadesPropias)) return [];
 return data.actividadesPropias.filter(a => a && ['GENERADOR','TRANSPORTISTA','OPERADOR'].includes(a.rol)
  && typeof a.actorId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(a.actorId));
}

/** Metadata provides orientation only; the selected actor is confirmed by the API. */
export function notificationEnvironmentalCertificate(notice: Pick<Notificacion, 'datos'>) {
  const data = parseNotificationData(notice.datos);
  const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
  const roles = { generador: 'GENERADOR', transportista: 'TRANSPORTISTA', operador: 'OPERADOR' } as const;
  const role = typeof data.actorTipo === 'string' && Object.prototype.hasOwnProperty.call(roles, data.actorTipo)
    ? roles[data.actorTipo as keyof typeof roles] : null;
  return data.tipo === 'certificado_ambiental' && role && validId(data.actorId) && validId(data.documentoId)
    ? { role, actorId: data.actorId, documentoId: data.documentoId } : null;
}

/** Actor receipt metadata orients the user; the server still checks actor and document access. */
export function notificationActorReceipt(notice: Pick<Notificacion, 'datos'>) {
  const data = parseNotificationData(notice.datos);
  const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
  const roles = { generador: 'GENERADOR', transportista: 'TRANSPORTISTA', operador: 'OPERADOR' } as const;
  const role = typeof data.actorTipo === 'string' && Object.prototype.hasOwnProperty.call(roles, data.actorTipo)
    ? roles[data.actorTipo as keyof typeof roles] : null;
  return data.tipo === 'comprobante_repetido' && !Object.prototype.hasOwnProperty.call(data, 'solicitudId')
    && role && validId(data.actorId) && validId(data.documentoId) ? { role, actorId: data.actorId, documentoId: data.documentoId } : null;
}

export function isActorReceiptNotice(notice: Pick<Notificacion, 'datos'>): boolean {
  const data = parseNotificationData(notice.datos);
  return data.tipo === 'comprobante_repetido' && !Object.prototype.hasOwnProperty.call(data, 'solicitudId');
}

/** A fiscal reminder names the generator and year; it does not grant access. */
export function notificationFiscalReminder(notice: Pick<Notificacion, 'datos'>) {
  const data = parseNotificationData(notice.datos);
  return data.tipo === 'recordatorio_fiscal'
    && typeof data.generadorId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.generadorId)
    && typeof data.fiscalYear === 'number' && Number.isInteger(data.fiscalYear) && data.fiscalYear >= 2000 && data.fiscalYear <= 2100
    ? { role: 'GENERADOR' as const, actorId: data.generadorId, fiscalYear: data.fiscalYear } : null;
}

export function notificationActorRole(notice: Notificacion): 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' | null {
  const data = parseNotificationData(notice.datos);
  const certificate = notificationEnvironmentalCertificate(notice);
  if (certificate) return certificate.role;
  const receipt = notificationActorReceipt(notice);
  if (receipt) return receipt.role;
  if (notificationFiscalReminder(notice)) return 'GENERADOR';
  return ['intercambio_inspeccion', 'agenda_inspeccion'].includes(String(data.tipo)) && data.version === 1
    && data.destino === 'participacion' && ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(String(data.tipoActor))
    ? data.tipoActor as 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' : null;
}

function withBasePath(path: string, basePath: string): string {
  const normalizedPath = safeLocalRedirect(path === '/perfil' ? '/mi-perfil' : path, '/notificaciones').replace(/^\/(?:app|mobile)(?=\/|$)/, '') || '/';
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  if (!normalizedBase || normalizedPath === normalizedBase || normalizedPath.startsWith(`${normalizedBase}/`)) {
    return normalizedPath;
  }
  return `${normalizedBase}${normalizedPath}`;
}

/** Opening a workflow notice must refresh its linked expediente/application. */
export function refreshInspectionNotification(notificacion: Notificacion, queryClient: QueryClient): void {
  const data = parseNotificationData(notificacion.datos);
  const fiscal = notificationFiscalReminder(notificacion);
  const receipt = notificationActorReceipt(notificacion);
  if (receipt) void queryClient.invalidateQueries({ queryKey: [`${receipt.role.toLowerCase()}-documentos`, receipt.actorId] });
  if (fiscal) {
    for (const key of ['generador-pagos', 'generador-ddjj', 'generador-documentos']) {
      void queryClient.invalidateQueries({ queryKey: [key, fiscal.actorId] });
    }
  }
  if (typeof data.renovacionId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.renovacionId)) {
    void queryClient.invalidateQueries({ queryKey: ['renovaciones'] });
  }
  if(data.tipo === 'certificado_manifiesto' && data.version === 1) {
    for(const key of ['manifest-certificates','manifiestos']) void queryClient.invalidateQueries({queryKey:[key]});
  }
  if (['estado_manifiesto', 'reversion_manifiesto'].includes(String(data.tipo)) && data.version === 1) {
    for (const key of ['manifiestos', 'manifest-agenda', 'manifest-proposal']) void queryClient.invalidateQueries({ queryKey: [key] });
  }
  if (data.tipo === 'adenda_manifiesto') void queryClient.invalidateQueries({ queryKey: ['manifiesto-adendas'] });
  if (data.tipo === 'propuesta_partes') {
    for (const key of ['manifiestos','manifest-proposal','training-tasks','manifest-agenda']) void queryClient.invalidateQueries({ queryKey: [key] });
  }
  if (data.tipo === 'manifiesto_eventual' && data.version === 1) void queryClient.invalidateQueries({ queryKey: ['baja-intensidad'] });
  if (data.tipo === 'representacion_empresa' && data.version === 1) {
    for (const key of ['empresas', 'empresa']) void queryClient.invalidateQueries({ queryKey: [key] });
  }
  if (data.tipo === 'antecedente_fiscalizacion' && data.version === 1) void queryClient.invalidateQueries({ queryKey: ['inspection-intakes'] });
  if (typeof data.solicitudId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.solicitudId)) {
    void queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
  }
  if (['intercambio_inspeccion', 'agenda_inspeccion'].includes(String(data.tipo)) && data.version === 1) {
    void queryClient.invalidateQueries({ queryKey: ['inspecciones'] });
  }
}

/** The action describes the resolved destination, including notices without a manifest. */
export function notificationActionLabel(path: string, notice?: Pick<Notificacion, 'datos'>): string {
  const [pathname, query = ''] = path.replace(/^\/(?:app|mobile)(?=\/|$)/, '').split('#')[0].split('?');
  const data = parseNotificationData(notice?.datos || null);
  if (/^\/(?:requerimientos|mis-inspecciones|inspecciones)\//.test(pathname) && data.tipo === 'intercambio_inspeccion' && data.version === 1) {
    if (data.evento === 'CIERRE_CONFORME') return 'Consultar cierre conforme →';
    if (data.evento === 'DERIVACION_LEGALES') return 'Consultar derivación a Legales →';
  }
  if (pathname === '/inspecciones' && new URLSearchParams(query).get('vista') === 'antecedentes') return 'Ver antecedentes en Inspecciones →';
  if (/^\/(?:admin\/solicitudes\/|mi-solicitud$)/.test(pathname)) return 'Abrir solicitud y ver su estado →';
  if (/^\/(?:requerimientos|mis-inspecciones)\//.test(pathname)) return 'Consultar requerimiento y estado →';
  if (/^\/inspecciones\//.test(pathname)) return 'Abrir expediente y ver el intercambio →';
  if (/^\/(?:mis-)?inspecciones$/.test(pathname)) return 'Abrir inspecciones →';
  if (/^\/soporte(?:\/|$)/.test(pathname)) return 'Abrir consulta de soporte →';
  if (pathname === '/empresas') return 'Ver entidad y acceso →';
  if (pathname === '/mi-perfil' && new URLSearchParams(query).has('comprobante')) return 'Revisar comprobante →';
  if (pathname === '/mi-perfil' && new URLSearchParams(query).has('certificadoAmbiental')) return 'Ver certificado ambiental →';
  if (pathname === '/mi-perfil') return 'Abrir mi ficha y documentos →';
  if (/^\/admin\/actores\/generadores\/[^/]+$/.test(pathname) && new URLSearchParams(query).get('tab') === 'fiscal') return 'Ver situación fiscal →';
  if (pathname === '/admin/usuarios') return 'Revisar cuentas de usuarios →';
  if (pathname === '/admin/renovaciones') return 'Revisar renovación →';
  if (/^\/notificaciones\/[^/]+$/.test(pathname) && data.tipo === 'recordatorio_fiscal') return 'Ver aviso fiscal →';
  if (/^\/notificaciones\/[^/]+$/.test(pathname) && data.tipo === 'comprobante_repetido') return 'Ver aviso del comprobante →';
  if (/^\/notificaciones\/[^/]+$/.test(pathname)) return 'Ver aviso y resultado →';
  if (pathname === '/alertas') return 'Revisar alerta →';
  if (/^\/manifiestos\/[^/]+\/adendas$/.test(pathname)) return 'Abrir adenda y revisiones →';
  if (/^\/manifiestos\/[^/]+$/.test(pathname) && new URLSearchParams(query).has('certificado')) return 'Ver certificación y descargar →';
  if (/^\/manifiestos(?:\/|$)/.test(pathname)) return 'Abrir manifiesto y ver qué sigue →';
  return 'Abrir detalle →';
}

export function resolveNotificationPath(notificacion: Notificacion, basePath = '', recipientRole?: string, companyTarget = false): string {
  const data = parseNotificationData(notificacion.datos);
  if (!companyTarget && notificationCompanyAccesses(notificacion).length) return withBasePath('/notificaciones/' + encodeURIComponent(notificacion.id), basePath);
  const safeId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
  // An older generic ruta must not hide the specific application in this notice.
  if (data.tipo === 'comprobante_repetido' && Object.prototype.hasOwnProperty.call(data, 'solicitudId')) {
    if (!safeId(data.solicitudId)) return withBasePath('/notificaciones', basePath);
    if (Object.prototype.hasOwnProperty.call(data, 'documentoId') && !safeId(data.documentoId)) return withBasePath('/notificaciones', basePath);
    const id = encodeURIComponent(data.solicitudId);
    const admin = recipientRole?.startsWith('ADMIN');
    const destination = admin ? `/admin/solicitudes/${id}` : `/mi-solicitud?solicitud=${id}`;
    const document = safeId(data.documentoId) ? `${admin ? '?' : '&'}documento=${encodeURIComponent(data.documentoId)}` : '';
    return withBasePath(destination + document, basePath);
  }
  if (isActorReceiptNotice(notificacion)) {
    const receipt = notificationActorReceipt(notificacion);
    if (!safeId(notificacion.id)) return withBasePath('/notificaciones', basePath);
    return withBasePath(companyTarget ? receipt ? '/mi-perfil?comprobante=' + encodeURIComponent(receipt.documentoId) + '&aviso=' + encodeURIComponent(notificacion.id) + '#comprobante-aviso' : '/notificaciones'
      : '/notificaciones/' + encodeURIComponent(notificacion.id), basePath);
  }
  if (companyTarget && representativeManifestAlert(notificacion.tipo, data)) {
    return withBasePath(safeId(notificacion.manifiestoId) ? '/manifiestos/' + notificacion.manifiestoId : '/notificaciones', basePath);
  }
  if (data.tipo === 'recordatorio_fiscal') {
    const reminder = notificationFiscalReminder(notificacion);
    if (!reminder || !safeId(notificacion.id)) return withBasePath('/notificaciones', basePath);
    return withBasePath(companyTarget
      ? '/admin/actores/generadores/' + encodeURIComponent(reminder.actorId) + '?tab=fiscal&ejercicio=' + reminder.fiscalYear
      : '/notificaciones/' + encodeURIComponent(notificacion.id), basePath);
  }
  if (data.tipo === 'certificado_ambiental') {
    const certificate = notificationEnvironmentalCertificate(notificacion);
    if (!certificate || !safeId(notificacion.id)) return withBasePath('/notificaciones', basePath);
    return withBasePath(companyTarget
      ? '/mi-perfil?certificadoAmbiental=' + encodeURIComponent(certificate.documentoId) + '#certificado-ambiental'
      : '/notificaciones/' + encodeURIComponent(notificacion.id), basePath);
  }
  if (['adenda_manifiesto', 'ADENDA_POST_FACTO'].includes(String(data.tipo)) && safeId(notificacion.manifiestoId) && safeId(data.adendaId)) return withBasePath(`/manifiestos/${notificacion.manifiestoId}/adendas?adenda=${data.adendaId}`, basePath);
  if (data.tipo === 'soporte' && safeId(data.ticketId)) return withBasePath('/soporte/' + data.ticketId, basePath);
  if(data.tipo === 'certificado_manifiesto') {
    const safe=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
    return withBasePath(data.version===1&&safe(notificacion.manifiestoId)&&safe(data.documentoId)&&['PARCIAL','FINAL'].includes(String(data.tipoCertificado)) ? '/manifiestos/'+notificacion.manifiestoId+'?certificado='+data.documentoId+'#certificaciones' : '/notificaciones',basePath);
  }
  if (data.tipo === 'representacion_empresa') {
    return withBasePath(data.version === 1 && typeof data.empresaId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.empresaId) && !String(data.evento).includes('REVOCAD')
      ? '/empresas?empresa=' + encodeURIComponent(data.empresaId) + '&origen=avisos' : '/notificaciones', basePath);
  }
  if (data.tipo === 'manifiesto_eventual') {
    const valid = data.version === 1 && safeId(data.registroId) && safeId(notificacion.id);
    return withBasePath(valid ? companyTarget ? '/manifiestos/baja-intensidad?registro=' + encodeURIComponent(data.registroId as string)
      : '/notificaciones/' + encodeURIComponent(notificacion.id) : '/notificaciones', basePath);
  }
  if (['intercambio_inspeccion', 'agenda_inspeccion'].includes(String(data.tipo))) {
    if (data.version !== 1 || typeof data.inspeccionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(data.inspeccionId)
      || !['participacion', 'inspeccion'].includes(String(data.destino))) return withBasePath('/notificaciones', basePath);
    const role = notificationActorRole(notificacion);
    if (role && recipientRole && role !== recipientRole && safeId(notificacion.id)) return withBasePath(`/notificaciones/${notificacion.id}`, basePath);
    return withBasePath(data.destino === 'participacion' ? `/requerimientos/${data.inspeccionId}` : `/inspecciones/${data.inspeccionId}${data.tipo === 'intercambio_inspeccion' ? '#intercambios' : ''}`, basePath);
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
  if (String(notificacion.tipo) === 'MODIFICACION_SOLICITADA' && safeId(data.renovacionId)) return withBasePath('/admin/renovaciones?anio=&revision=' + data.renovacionId, basePath);
  if (['MODIFICACION_APROBADA', 'MODIFICACION_RECHAZADA'].includes(String(notificacion.tipo)) && safeId(data.renovacionId) && safeId(notificacion.id)) return withBasePath('/notificaciones/' + notificacion.id, basePath);
  if (typeof data.solicitudId === 'string') {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(data.solicitudId)) return withBasePath('/notificaciones', basePath);
    const applicant = ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(recipientRole || '')
      || ['solicitud_observada', 'solicitud_aprobada', 'solicitud_rechazada'].includes(String(data.tipo));
    return withBasePath(applicant ? `/mi-solicitud?solicitud=${data.solicitudId}` : `/admin/solicitudes/${data.solicitudId}`, basePath);
  }
  if (safeId(data.inspeccionId)) return withBasePath(`/${['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(recipientRole || '') ? 'requerimientos' : 'inspecciones'}/${data.inspeccionId}`, basePath);
  if (safeId(notificacion.manifiestoId)) return withBasePath(`/manifiestos/${notificacion.manifiestoId}`, basePath);
  if (typeof data.alertaId === 'string') return withBasePath('/alertas', basePath);
  return withBasePath('/notificaciones', basePath);
}
