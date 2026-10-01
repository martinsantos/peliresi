import { describe, expect, it } from 'vitest';
import { resolveNotificationPath } from '../../utils/notificationNavigation';
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
