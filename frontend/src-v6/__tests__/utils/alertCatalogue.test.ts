import { expect, it } from 'vitest';
import { cataloguePath } from '../../utils/alertCatalogue';
import { resolveNotificationPath } from '../../utils/notificationNavigation';
const raw = (value: object) => JSON.stringify({ familia: 'catalogo_verificable', version: 1, ...value });
it('administration opens the inspection but its actor opens the participation surface', () => {
  const data = raw({ tipo: 'requerimiento_inspeccion', inspeccionId: 'own-inspection', destino: 'participacion' });
  expect(cataloguePath(data)).toBe('/inspecciones/own-inspection');
  expect(cataloguePath(data, true)).toBe('/mis-inspecciones/own-inspection');
  expect(resolveNotificationPath({ datos: data } as never, '/app')).toBe('/app/mis-inspecciones/own-inspection');
});
it('operator/transport owners open their own profile, not an admin-only destination', () => {
  expect(cataloguePath(raw({ tipo: 'vencimiento_documental', tipoActor: 'OPERADOR', actorId: 'op', destino: 'perfil' }), true)).toBe('/mi-perfil');
  expect(cataloguePath(raw({ tipo: 'vencimiento_documental', tipoActor: 'TRANSPORTISTA', actorId: 'tr', destino: 'perfil' }), true)).toBe('/admin/actores/transportistas/tr');
  expect(cataloguePath(raw({ tipo: 'vencimiento_documental', tipoActor: 'TRANSPORTISTA', actorId: '../other', destino: 'perfil' }), true)).toBeNull();
  expect(cataloguePath(raw({ tipo: 'vencimiento_documental', tipoActor: 'TRANSPORTISTA', actorId: 'tr' }))).toBe('/admin/actores/transportistas/tr');
});
it.each(['../../admin', 'https://evil.invalid', 'id?token=x', 'id#section'])('does not build destinations from unsafe identifier %s', inspeccionId => {
  expect(cataloguePath(raw({ tipo: 'requerimiento_inspeccion', inspeccionId }))).toBeNull();
});
it('malformed or future-version snapshots have no invented destination', () => {
  expect(cataloguePath('invalid')).toBeNull(); expect(cataloguePath('{"familia":"catalogo_verificable","version":2}')).toBeNull();
});
it('a malformed catalogue notice cannot fall back to an arbitrary URL or authority surface', () => {
  expect(resolveNotificationPath({ datos: raw({ tipo: 'requerimiento_inspeccion', inspeccionId: 'req', url: '/admin/usuarios' }) } as never, '/app')).toBe('/app/notificaciones');
});
