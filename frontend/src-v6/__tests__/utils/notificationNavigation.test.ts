import { describe, expect, it, vi } from 'vitest';
import { resolveNotificationPath, refreshInspectionNotification, notificationActionLabel } from '../../utils/notificationNavigation';
import type { Notificacion } from '../../types/models';
import { QueryClient } from '@tanstack/react-query';

const base: Notificacion = {
  id: 'n-1',
  usuarioId: 'u-1',
  tipo: 'INFO_GENERAL' as Notificacion['tipo'],
  titulo: 'Aviso',
  mensaje: 'Detalle',
  datos: null,
  manifiestoId: null,
  leida: false,
  fechaLeida: null,
  prioridad: 'NORMAL' as Notificacion['prioridad'],
  createdAt: '2026-09-24T12:00:00.000Z',
};

describe('resolveNotificationPath', () => {
  it('opens the exact entity on web and app and refreshes the open company record', () => {
    const notice={...base,datos:JSON.stringify({tipo:'representacion_empresa',version:1,empresaId:'entity-1',evento:'PERSONA_AUTORIZADA',url:'/wrong'})};
    expect(resolveNotificationPath(notice)).toBe('/empresas?empresa=entity-1');
    expect(resolveNotificationPath(notice,'/app')).toBe('/app/empresas?empresa=entity-1');
    expect(notificationActionLabel(resolveNotificationPath(notice))).toBe('Revisar entidad y personas →');
    const invalidateQueries=vi.fn();refreshInspectionNotification(notice,{invalidateQueries} as any);
    expect(invalidateQueries).toHaveBeenCalledWith({queryKey:['empresa']});
    expect(invalidateQueries).toHaveBeenCalledWith({queryKey:['empresas']});
  });
  it.each(['PERSONA_REVOCADA','RESPONSABLE_REVOCADO','INVITACION_REVOCADA'])('keeps %s in the inbox without offering a revoked company context',evento=>{
    const notice={...base,datos:JSON.stringify({tipo:'representacion_empresa',version:1,empresaId:'entity-1',evento})};
    expect(resolveNotificationPath(notice)).toBe('/notificaciones');
    expect(resolveNotificationPath(notice,'/app')).toBe('/app/notificaciones');
  });
  it.each([{version:2},{empresaId:'../outside'}])('does not follow a malformed company link %j',invalid=>{
    const notice={...base,datos:JSON.stringify({tipo:'representacion_empresa',version:1,empresaId:'entity-1',evento:'PERSONA_AUTORIZADA',url:'/wrong',...invalid})};
    expect(resolveNotificationPath(notice)).toBe('/notificaciones');
  });
  it('opens the exact released certificate on both surfaces and refreshes its documents', () => {
    const notice={...base,manifiestoId:'m',datos:JSON.stringify({tipo:'certificado_manifiesto',version:1,documentoId:'d',tipoCertificado:'FINAL',url:'/wrong'})};
    expect(resolveNotificationPath(notice)).toBe('/manifiestos/m?certificado=d#certificaciones');
    expect(resolveNotificationPath(notice,'/app')).toBe('/app/manifiestos/m?certificado=d#certificaciones');
    expect(notificationActionLabel(resolveNotificationPath(notice))).toBe('Ver certificación y descargar →');
    const invalidateQueries=vi.fn();refreshInspectionNotification(notice,{invalidateQueries} as any);
    expect(invalidateQueries).toHaveBeenCalledWith({queryKey:['manifest-certificates']});
    expect(resolveNotificationPath({...notice,manifiestoId:'../bad'})).toBe('/notificaciones');
  });
  it('opening a new intake notice invalidates an already displayed queue without changing its data', () => {
    const client = new QueryClient(), key = ['inspection-intakes', 'admin', 'PENDIENTE'];
    const previous = { items: [{ id: 'old-case' }] }; client.setQueryData(key, previous);
    refreshInspectionNotification({ ...base, datos: '{"tipo":"antecedente_fiscalizacion","version":1,"antecedenteId":"new-case"}' }, client);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryData(key)).toBe(previous);
    client.clear();
  });
  it('opens and refreshes the exact eventual on web and app, ignoring an untrusted URL', () => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'manifiesto_eventual', version: 1, registroId: 'eventual-1', url: '/wrong' }) };
    expect(resolveNotificationPath(notice)).toBe('/manifiestos/baja-intensidad?registro=eventual-1');
    expect(resolveNotificationPath(notice, '/app')).toBe('/app/manifiestos/baja-intensidad?registro=eventual-1');
    const invalidateQueries = vi.fn(); refreshInspectionNotification(notice, { invalidateQueries } as any);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['baja-intensidad'] });
    expect(resolveNotificationPath({ ...notice, datos: JSON.stringify({ tipo: 'manifiesto_eventual', version: 1, registroId: '../other', url: '/wrong' }) }, '/app')).toBe('/app/notificaciones');
  });
  it.each(['participacion', 'inspeccion'])('opens agenda %s and refreshes current operations without trusting a supplied URL', destino => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'agenda_inspeccion', version: 1, inspeccionId: 'case-1', destino, url: '/wrong' }) };
    const path = destino === 'participacion' ? '/mis-inspecciones/case-1' : '/inspecciones/case-1';
    expect(resolveNotificationPath(notice)).toBe(path);
    expect(resolveNotificationPath(notice, '/app')).toBe('/app' + path);
    const invalidateQueries = vi.fn(); refreshInspectionNotification(notice, { invalidateQueries } as any);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['inspecciones'] });
  });
  it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'])('opens an application message in the %s own result, never administration', role => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'solicitud_mensaje', solicitudId: 'own-1' }) };
    expect(resolveNotificationPath(notice, '', role)).toBe('/mi-solicitud?solicitud=own-1');
    expect(resolveNotificationPath(notice, '/app', role)).toBe('/app/mi-solicitud?solicitud=own-1');
  });
  it.each(['solicitud_aprobada', 'solicitud_observada', 'solicitud_rechazada'])('preserves the applicant destination of %s in legacy notices', tipo => {
    expect(resolveNotificationPath({ ...base, datos: JSON.stringify({ tipo, solicitudId: 'own-1' }) }, '/app')).toBe('/app/mi-solicitud?solicitud=own-1');
  });
  it('keeps the reviewer in administration and rejects malformed application IDs', () => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'solicitud_mensaje', solicitudId: 'case-1' }) };
    expect(resolveNotificationPath(notice, '/app', 'ADMIN_OPERADOR')).toBe('/app/admin/solicitudes/case-1');
    expect(resolveNotificationPath({ ...notice, datos: '{"solicitudId":"../other"}' }, '/app', 'GENERADOR')).toBe('/app/notificaciones');
  });
  it('refreshes owned application data when opening a notice on an already open result', () => {
    const invalidateQueries = vi.fn(); refreshInspectionNotification({ ...base, datos: '{"tipo":"solicitud_observada","solicitudId":"own-1"}' }, { invalidateQueries } as any);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['solicitudes'] });
  });
  it('refreshes a PSIP dossier even when its notification opens the current URL', () => {
    const invalidateQueries = vi.fn();
    refreshInspectionNotification({ ...base, datos: '{"tipo":"intercambio_inspeccion","version":1}' }, { invalidateQueries } as any);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['inspecciones'] });
    invalidateQueries.mockClear(); refreshInspectionNotification(base, { invalidateQueries } as any);
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
  it.each(['participacion', 'inspeccion'])('opens a PSIP %s notice in the authorized dossier on web and app', destino => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'intercambio_inspeccion', version: 1, inspeccionId: 'case-1', destino, soloCampana: true, ruta: '/wrong' }) };
    const path = destino === 'participacion' ? '/mis-inspecciones/case-1' : '/inspecciones/case-1#intercambios';
    expect(resolveNotificationPath(notice)).toBe(path);
    expect(resolveNotificationPath(notice, '/app')).toBe('/app' + path);
  });
  it.each([{ destino: 'other' }, { inspeccionId: '../other' }, { version: 2 }, { inspeccionId: null }])('keeps a malformed PSIP link in the inbox: %j', invalid => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'intercambio_inspeccion', version: 1, inspeccionId: 'case-1', destino: 'participacion', ...invalid }) };
    expect(resolveNotificationPath(notice, '/app')).toBe('/app/notificaciones');
  });
  it.each([['generador', 'generadores'], ['operador', 'operadores'], ['transportista', 'transportistas']])('opens the %s official certificate record on web and app', (actorTipo, plural) => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'certificado_ambiental', actorTipo, actorId: 'owner' }) };
    expect(resolveNotificationPath(notice)).toBe('/mi-perfil');
    expect(resolveNotificationPath(notice, '/app')).toBe('/app/mi-perfil');
  });
  it('opens native support in the current surface with exactly one base path', () => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'soporte', ticketId: 'ticket-1', ruta: '/soporte/ticket-1' }) };
    expect(resolveNotificationPath(notice)).toBe('/soporte/ticket-1');
    expect(resolveNotificationPath(notice, '/mobile')).toBe('/mobile/soporte/ticket-1');
  });
  it('opens the exact manifiesto in the mobile app', () => {
    expect(resolveNotificationPath({ ...base, manifiestoId: 'm-1' }, '/app')).toBe('/app/manifiestos/m-1');
  });

  it('opens inspection and registration targets from structured data', () => {
    expect(resolveNotificationPath({ ...base, datos: JSON.stringify({ inspeccionId: 'i-1' }) })).toBe('/inspecciones/i-1');
    expect(resolveNotificationPath({ ...base, datos: JSON.stringify({ tipo: 'nuevo_registro' }) })).toBe('/admin/usuarios');
  });

  it('keeps an already-prefixed explicit app path stable', () => {
    expect(resolveNotificationPath({ ...base, datos: JSON.stringify({ url: '/app/manifiestos/m-2' }) }, '/app')).toBe('/app/manifiestos/m-2');
  });

  it('falls back to the notifications inbox, never to unrelated alerts', () => {
    expect(resolveNotificationPath(base, '/app')).toBe('/app/notificaciones');
  });
});

it('refreshes adendas when a notice arrives and describes the web/app destination', () => {
  const client = new QueryClient(), key = ['manifiesto-adendas', 'actor', 'manifest', 1];
  const previous = { version: 0 }; client.setQueryData(key, previous);
  const notice = { ...base, datos: JSON.stringify({ tipo: 'adenda_manifiesto', adendaId: 'one', url: '/manifiestos/manifest/adendas' }) };
  refreshInspectionNotification(notice, client); expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  expect(client.getQueryData(key)).toBe(previous);
  for (const prefix of ['', '/app']) {
    const target = resolveNotificationPath(notice, prefix);
    expect(target).toBe(prefix + '/manifiestos/manifest/adendas');
    expect(notificationActionLabel(target)).toBe('Abrir adenda y revisiones →');
  }
  client.clear();
});
