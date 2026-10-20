import { describe, expect, it, vi } from 'vitest';
import { resolveNotificationPath, refreshInspectionNotification } from '../../utils/notificationNavigation';
import type { Notificacion } from '../../types/models';

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
