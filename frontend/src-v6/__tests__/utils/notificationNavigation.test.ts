import { describe, expect, it, vi } from 'vitest';
import { resolveNotificationPath, refreshInspectionNotification, notificationActionLabel, notificationInboxReturnState, notificationInboxReturnPath, notificationCompanyAccesses, needsPersonalManifestChoice } from '../../utils/notificationNavigation';
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
  it.each(['', '/app'])('routes a multirole manifest reminder to its owned notice on %s', prefix => {
    const n = { ...base, tipo: 'ALERTA_SISTEMA' as Notificacion['tipo'], manifiestoId: 'm', datos: JSON.stringify({ tipo: 'recordatorio_operacion', version: 1 }) };
    expect(needsPersonalManifestChoice({ rol: 'GENERADOR', actividades: ['GENERADOR', 'OPERADOR'] })).toBe(true);
    expect(resolveNotificationPath(n, prefix, 'GENERADOR', false, true)).toBe(prefix + '/notificaciones/n-1');
    expect(resolveNotificationPath(n, prefix, 'GENERADOR', true, true)).toBe(prefix + '/manifiestos/m');
    expect(resolveNotificationPath(n, prefix, 'GENERADOR')).toBe(prefix + '/manifiestos/m');
  });
  it('preserves a registered handoff destination even for a multirole account', () => {
    const n = { ...base, manifiestoId: 'm', datos: JSON.stringify({ tipo: 'relevo_transporte', ruta: '/transporte/perfil' }) };
    expect(resolveNotificationPath(n, '', 'TRANSPORTISTA', false, true)).toBe('/transporte/perfil');
  });
  it.each(['', '/app'])('preserves the addendum from an owned notice in %s', prefix => {
    const n = { ...base, manifiestoId: 'm', datos: JSON.stringify({ tipo: 'adenda_manifiesto', adendaId: 'a' }) };
    expect(resolveNotificationPath(n, prefix, 'GENERADOR', false, true)).toBe(prefix + '/notificaciones/n-1');
    expect(resolveNotificationPath(n, prefix, 'GENERADOR', true, true)).toBe(prefix + '/manifiestos/m/adendas?adenda=a');
    expect(resolveNotificationPath({ ...n, datos: JSON.stringify({ tipo: 'adenda_manifiesto' }) }, prefix, 'GENERADOR', true)).toBe(prefix + '/manifiestos/m/adendas');
    expect(resolveNotificationPath({ ...n, datos: JSON.stringify({ tipo: 'adenda_manifiesto', adendaId: '../bad' }) }, prefix, 'GENERADOR', true)).toBe(prefix + '/notificaciones');
  });
  it.each(['', '/app'])('opens an operation reminder through the representative context on %s', prefix => {
    const access = { empresaId: 'co', actividadId: 'a', rol: 'GENERADOR', razonSocial: 'QA Empresa' };
    const notice = { ...base, tipo: 'ALERTA_SISTEMA' as Notificacion['tipo'], manifiestoId: 'm',
      datos: JSON.stringify({ tipo: 'recordatorio_operacion', version: 1, modalidad: 'IN_SITU', fechaDia: '31/10/2026', destino: 'representante', accesosEmpresa: [access] }) };
    expect(notificationCompanyAccesses(notice)).toEqual([access]);
    expect(resolveNotificationPath(notice, prefix, 'OPERADOR')).toBe(prefix + '/notificaciones/n-1');
    expect(resolveNotificationPath(notice, prefix, 'OPERADOR', true)).toBe(prefix + '/manifiestos/m');
  });
  it.each(['', '/app'])('opens a representative signature reminder in its authorized context on %s', prefix => {
    const access = { empresaId: 'co', actividadId: 'a', rol: 'GENERADOR', razonSocial: 'QA Empresa', establecimientoId: 'site', establecimiento: 'Norte' };
    const notice = { ...base, tipo: 'VENCIMIENTO_PROXIMO' as Notificacion['tipo'], manifiestoId: 'm',
      datos: JSON.stringify({ tipo: 'recordatorio_firma', version: 1, fase: 'SEMANA', destino: 'representante', accesosEmpresa: [access] }) };
    expect(notificationCompanyAccesses(notice)).toEqual([access]);
    expect(resolveNotificationPath(notice, prefix, 'OPERADOR')).toBe(prefix + '/notificaciones/n-1');
    expect(resolveNotificationPath(notice, prefix, 'OPERADOR', true)).toBe(prefix + '/manifiestos/m');
  });
  it.each(['', '/app', '/mobile'])('routes fiscal reminders via the owned notice in %s and ignores the obsolete profile path', prefix => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'recordatorio_fiscal', generadorId: 'g-1', fiscalYear: 2026, url: '/perfil' }) };
    expect(resolveNotificationPath(notice, prefix, 'OPERADOR')).toBe(prefix + '/notificaciones/n-1');
    expect(notificationActionLabel(prefix + '/notificaciones/n-1', notice)).toBe('Ver aviso fiscal →');
    const target = resolveNotificationPath(notice, prefix, 'GENERADOR', true);
    expect(target).toBe(prefix + '/admin/actores/generadores/g-1?tab=fiscal&ejercicio=2026');
    expect(notificationActionLabel(target, notice)).toBe('Ver situación fiscal →');
    const invalidateQueries = vi.fn(); refreshInspectionNotification(notice, { invalidateQueries } as any);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['generador-pagos', 'g-1'] });
  });
  it.each([{ generadorId: '../otro' }, { fiscalYear: 1999 }, { fiscalYear: '2026' }, { fiscalYear: 2101 }])('keeps malformed fiscal reminders in the inbox: %j', invalid => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'recordatorio_fiscal', generadorId: 'g-1', fiscalYear: 2026, url: '/perfil', ...invalid }) };
    expect(resolveNotificationPath(notice, '/app')).toBe('/app/notificaciones');
  });
  it.each(['', '/app', '/mobile'])('describes recorded decisions without offering a response on %s', prefix => {
    for (const [evento, label] of [['CIERRE_CONFORME', 'Consultar cierre conforme →'], ['DERIVACION_LEGALES', 'Consultar derivación a Legales →']]) {
      const notice = { ...base, datos: JSON.stringify({ tipo: 'intercambio_inspeccion', version: 1, inspeccionId: 'case-1', destino: 'participacion', tipoActor: 'OPERADOR', evento }) };
      expect(notificationActionLabel(resolveNotificationPath(notice, prefix, 'OPERADOR'), notice)).toBe(label);
      expect(notificationActionLabel(resolveNotificationPath(notice, prefix, 'GENERADOR'), notice)).toBe('Ver aviso y resultado →');
    }
    expect(notificationActionLabel(prefix + '/requerimientos/case-1')).toBe('Consultar requerimiento y estado →');
  });
  it.each(['', '/app', '/mobile'])('routes a requirement through its role explanation when another activity is active in %s', prefix => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'intercambio_inspeccion', version: 1, inspeccionId: 'case-1', destino: 'participacion', tipoActor: 'OPERADOR' }) };
    expect(resolveNotificationPath(notice, prefix, 'GENERADOR')).toBe(prefix + '/notificaciones/n-1');
    expect(resolveNotificationPath(notice, prefix, 'OPERADOR')).toBe(prefix + '/requerimientos/case-1');
  });
  it.each(['', '/app', '/mobile'])('opens renewal decisions as an exact owned notice in %s', prefix => {
    for (const tipo of ['MODIFICACION_APROBADA', 'MODIFICACION_RECHAZADA']) {
      const n = { ...base, tipo: tipo as Notificacion['tipo'], datos: '{"renovacionId":"renewal-qa"}' };
      expect(resolveNotificationPath(n, prefix)).toBe(prefix + '/notificaciones/n-1');
      expect(notificationActionLabel(resolveNotificationPath(n, prefix))).toBe('Ver aviso y resultado →');
    }
  });
  it.each(['', '/app', '/mobile'])('opens the exact renewal and refreshes its state on %s', prefix => {
    const n = { ...base, tipo: 'MODIFICACION_SOLICITADA' as Notificacion['tipo'], datos: JSON.stringify({ renovacionId: 'renewal-qa' }) };
    expect(resolveNotificationPath(n, prefix)).toBe(prefix + '/admin/renovaciones?anio=&revision=renewal-qa');
    expect(notificationActionLabel(resolveNotificationPath(n, prefix))).toBe('Revisar renovación →');
    const invalidateQueries = vi.fn();
    refreshInspectionNotification(n, { invalidateQueries } as any);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['renovaciones'] });
  });
  it.each(['', '/app', '/mobile'])('names the Inspecciones section consistently for %s notices', prefix => {
    expect(notificationActionLabel(prefix + '/inspecciones?vista=antecedentes')).toBe('Ver antecedentes en Inspecciones →');
  });
  it('opens the exact entity on web and app and refreshes the open company record', () => {
    const notice={...base,datos:JSON.stringify({tipo:'representacion_empresa',version:1,empresaId:'entity-1',evento:'PERSONA_AUTORIZADA',url:'/wrong'})};
    expect(resolveNotificationPath(notice)).toBe('/empresas?empresa=entity-1&origen=avisos');
    expect(resolveNotificationPath(notice,'/app')).toBe('/app/empresas?empresa=entity-1&origen=avisos');
    expect(notificationActionLabel(resolveNotificationPath(notice))).toBe('Ver entidad y acceso →');
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
    expect(resolveNotificationPath(notice)).toBe('/notificaciones/' + notice.id);
    expect(resolveNotificationPath(notice, '/app')).toBe('/app/notificaciones/' + notice.id);
    expect(resolveNotificationPath(notice, '/app', undefined, true)).toBe('/app/manifiestos/baja-intensidad?registro=eventual-1');
    const invalidateQueries = vi.fn(); refreshInspectionNotification(notice, { invalidateQueries } as any);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['baja-intensidad'] });
    expect(resolveNotificationPath({ ...notice, datos: JSON.stringify({ tipo: 'manifiesto_eventual', version: 1, registroId: '../other', url: '/wrong' }) }, '/app')).toBe('/app/notificaciones');
  });
  it.each(['participacion', 'inspeccion'])('opens agenda %s and refreshes current operations without trusting a supplied URL', destino => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'agenda_inspeccion', version: 1, inspeccionId: 'case-1', destino, url: '/wrong' }) };
    const path = destino === 'participacion' ? '/requerimientos/case-1' : '/inspecciones/case-1';
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
  it.each(['', '/app', '/mobile'])('opens the exact application for a repeated-receipt notice in %s', prefix => {
    const notice = { ...base, tipo: 'ALERTA_SISTEMA' as Notificacion['tipo'], datos: JSON.stringify({
      tipo: 'comprobante_repetido', solicitudId: 'operador-2', documentoId: 'doc-2', ruta: '/mi-solicitud',
    }) };
    for (const role of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) {
      expect(resolveNotificationPath(notice, prefix, role)).toBe(prefix + '/mi-solicitud?solicitud=operador-2&documento=doc-2');
    }
    expect(resolveNotificationPath(notice, prefix, 'ADMIN_OPERADOR')).toBe(prefix + '/admin/solicitudes/operador-2?documento=doc-2');
    expect(notificationActionLabel(resolveNotificationPath(notice, prefix, 'OPERADOR'), notice)).toBe('Abrir solicitud y ver su estado →');
  });
  it('does not follow a malformed repeated-receipt application identifier or an unrelated supplied route', () => {
    for (const solicitudId of ['../otra', '', null]) {
      const notice = { ...base, datos: JSON.stringify({ tipo: 'comprobante_repetido', solicitudId, ruta: '/mi-solicitud' }) };
      expect(resolveNotificationPath(notice, '/app', 'GENERADOR')).toBe('/app/notificaciones');
    }
    const actorReceipt = { ...base, datos: JSON.stringify({ tipo: 'comprobante_repetido', actorTipo: 'operador', actorId: 'o-1', ruta: '/mi-perfil' }) };
    expect(resolveNotificationPath(actorReceipt, '/app', 'OPERADOR')).toBe('/app/notificaciones/n-1');
    const historical = { ...base, datos: JSON.stringify({ tipo: 'comprobante_repetido', solicitudId: 'own-1', ruta: '/mi-solicitud' }) };
    expect(resolveNotificationPath(historical, '/app', 'GENERADOR')).toBe('/app/mi-solicitud?solicitud=own-1');
    const invalidDocument = { ...base, datos: JSON.stringify({ tipo: 'comprobante_repetido', solicitudId: 'own-1', documentoId: '../otro', ruta: '/mi-solicitud' }) };
    expect(resolveNotificationPath(invalidDocument, '/app', 'GENERADOR')).toBe('/app/notificaciones');
  });
  it.each(['', '/app', '/mobile'])('routes an actor receipt through the owned notice and its exact document on %s', prefix => {
    for (const [actorTipo, role] of [['generador','GENERADOR'],['transportista','TRANSPORTISTA'],['operador','OPERADOR']]) {
      const notice = { ...base, tipo: 'ALERTA_SISTEMA' as Notificacion['tipo'], datos: JSON.stringify({ tipo:'comprobante_repetido', actorTipo, actorId:'actor-1', documentoId:'doc-1', ruta:'/mi-perfil' }) };
      expect(resolveNotificationPath(notice, prefix, 'GENERADOR')).toBe(prefix + '/notificaciones/n-1');
      const target = resolveNotificationPath(notice, prefix, role, true);
      expect(target).toBe(prefix + '/mi-perfil?comprobante=doc-1&aviso=n-1#comprobante-aviso');
      expect(notificationActionLabel(target, notice)).toBe('Revisar comprobante →');
      const invalidateQueries = vi.fn(); refreshInspectionNotification(notice, { invalidateQueries } as any);
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: [`${actorTipo}-documentos`, 'actor-1'] });
    }
  });
  it.each([{ actorTipo:'otro' }, { actorId:'../otro' }, { documentoId:'../otro' }, { documentoId:null }])('never follows an incomplete actor receipt target: %j', fields => {
    const notice = { ...base, datos: JSON.stringify({ tipo:'comprobante_repetido', actorTipo:'operador', actorId:'actor-1', documentoId:'doc-1', ruta:'/mi-perfil', ...fields }) };
    expect(resolveNotificationPath(notice, '/app', 'GENERADOR')).toBe('/app/notificaciones/n-1');
    expect(resolveNotificationPath(notice, '/app', 'OPERADOR', true)).toBe('/app/notificaciones');
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
    const path = destino === 'participacion' ? '/requerimientos/case-1' : '/inspecciones/case-1#intercambios';
    expect(resolveNotificationPath(notice)).toBe(path);
    expect(resolveNotificationPath(notice, '/app')).toBe('/app' + path);
  });
  it.each([{ destino: 'other' }, { inspeccionId: '../other' }, { version: 2 }, { inspeccionId: null }])('keeps a malformed PSIP link in the inbox: %j', invalid => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'intercambio_inspeccion', version: 1, inspeccionId: 'case-1', destino: 'participacion', ...invalid }) };
    expect(resolveNotificationPath(notice, '/app')).toBe('/app/notificaciones');
  });
  it.each(['generador', 'operador', 'transportista'])('opens the %s environmental certificate through its owned notice on web and app', actorTipo => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'certificado_ambiental', actorTipo, actorId: 'owner', documentoId: 'doc-1', url: '/wrong' }) };
    expect(resolveNotificationPath(notice)).toBe('/notificaciones/n-1');
    expect(resolveNotificationPath(notice, '/app')).toBe('/app/notificaciones/n-1');
    expect(resolveNotificationPath(notice, '', actorTipo.toUpperCase(), true)).toBe('/mi-perfil?certificadoAmbiental=doc-1#certificado-ambiental');
  });
  it.each([{ documentoId: '../bad' }, { actorId: '../bad' }, { actorTipo: 'otro' }, { actorTipo: '__proto__' }])('does not follow invalid environmental certificate metadata %j', invalid => {
    const notice = { ...base, datos: JSON.stringify({ tipo: 'certificado_ambiental', actorTipo: 'generador', actorId: 'owner', documentoId: 'doc-1', url: '/wrong', ...invalid }) };
    expect(resolveNotificationPath(notice, '/app')).toBe('/app/notificaciones');
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

it.each(['//other.invalid', '/\\other.invalid', '/x/%2f../other', '/\nother'])('rejects unsafe legacy notice link %s', url => {
  expect(resolveNotificationPath({ ...base, datos: JSON.stringify({url}) })).toBe('/notificaciones');
});
it('selects the exact addendum even when the legacy URL omits it',()=>{
  expect(resolveNotificationPath({...base,manifiestoId:'m',datos:'{"tipo":"adenda_manifiesto","adendaId":"a","url":"/manifiestos/m/adendas"}'},'/app')).toBe('/app/manifiestos/m/adendas?adenda=a');
});

describe('return to the notification inbox',()=>{
 it('preserves only valid filters for the same account/activity',()=>{
  const state=notificationInboxReturnState('?avisos=sin-leer&pagina=3&returnTo=https://bad.invalid','owner-G');
  expect(notificationInboxReturnPath(state,'owner-G')).toBe('/notificaciones?avisos=sin-leer&pagina=3');
  expect(notificationInboxReturnPath(state,'owner-O')).toBe('/notificaciones');
  expect(notificationInboxReturnPath(state,'other-G')).toBe('/notificaciones');
 });
 it.each([null,{}, {notificationInboxReturn:{owner:'o',search:'avisos=invalid&pagina=-1'}}, {notificationInboxReturn:{owner:'o',search:'pagina=NaN'}}, {notificationInboxReturn:{owner:'o',search:'https://bad.invalid'}}])('never interprets a return payload as a redirect: %j',state=>{
  expect(notificationInboxReturnPath(state,'o')).toBe('/notificaciones');
 });
});
