import { describe, expect, it } from 'vitest';
import { canVisitRoute } from '../../utils/routeAccess';
import type { UserRole } from '../../contexts/AuthContext';

describe('shared web/PWA route access', () => {
  const roles: UserRole[] = [
    'ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR',
    'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR', 'AUDITOR',
  ];

  const routeMatrix: Array<{ path: string; allowed: UserRole[] }> = [
    { path: '/dashboard', allowed: roles },
    { path: '/manifiestos', allowed: roles },
    { path: '/manifiestos/nuevo', allowed: ['ADMIN', 'GENERADOR', 'ADMIN_GENERADOR'] },
    { path: '/manifiestos/manifest-1/editar', allowed: ['ADMIN', 'GENERADOR', 'ADMIN_GENERADOR'] },
    { path: '/switch-user', allowed: ['ADMIN'] },
    { path: '/admin/usuarios', allowed: ['ADMIN'] },
    { path: '/admin/auditoria', allowed: ['ADMIN', 'AUDITOR'] },
    { path: '/admin/actores/generadores', allowed: ['ADMIN', 'ADMIN_GENERADOR'] },
    { path: '/admin/residuos', allowed: ['ADMIN', 'ADMIN_GENERADOR'] },
    { path: '/admin/actores/transportistas', allowed: ['ADMIN', 'ADMIN_TRANSPORTISTA'] },
    { path: '/admin/vehiculos', allowed: ['ADMIN', 'ADMIN_TRANSPORTISTA', 'TRANSPORTISTA'] },
    { path: '/admin/actores/operadores', allowed: ['ADMIN', 'ADMIN_OPERADOR'] },
    { path: '/admin/tratamientos', allowed: ['ADMIN', 'ADMIN_OPERADOR'] },
    { path: '/admin/renovaciones', allowed: ['ADMIN', 'ADMIN_OPERADOR'] },
    {
      path: '/admin/solicitudes',
      allowed: ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'],
    },
    {
      path: '/admin/blockchain',
      allowed: ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'],
    },
    {
      path: '/admin/carga-masiva',
      allowed: ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'],
    },
  ];

  it.each(['', '/app', '/mobile'])('enforces the complete role/route matrix under %s', prefix => {
    for (const entry of routeMatrix) {
      for (const role of roles) {
        expect(
          canVisitRoute(role, `${prefix}${entry.path}`),
          `${role} at ${prefix}${entry.path}`,
        ).toBe(entry.allowed.includes(role));
      }
    }
  });

  it.each(['', '/app', '/mobile'])('applies sector boundaries under %s', prefix => {
    expect(canVisitRoute('ADMIN_GENERADOR', `${prefix}/admin/actores/generadores/nuevo`)).toBe(true);
    expect(canVisitRoute('ADMIN_GENERADOR', `${prefix}/admin/actores/operadores/nuevo`)).toBe(false);
    expect(canVisitRoute('ADMIN_OPERADOR', `${prefix}/admin/operadores/qa/editar`)).toBe(true);
    expect(canVisitRoute('ADMIN_OPERADOR', `${prefix}/admin/usuarios`)).toBe(false);
    expect(canVisitRoute('ADMIN_TRANSPORTISTA', `${prefix}/admin/actores/transportistas/nuevo`)).toBe(true);
    expect(canVisitRoute('ADMIN_TRANSPORTISTA', `${prefix}/switch-user`)).toBe(false);
    expect(canVisitRoute('TRANSPORTISTA', `${prefix}/admin/actores/transportistas/own-id`)).toBe(true);
    expect(canVisitRoute('TRANSPORTISTA', `${prefix}/admin/actores/transportistas/nuevo`)).toBe(false);
    expect(canVisitRoute('TRANSPORTISTA', `${prefix}/admin/actores/transportistas/own-id/editar`)).toBe(false);
    expect(canVisitRoute('AUDITOR', `${prefix}/admin/auditoria`)).toBe(true);
  });
  it.each(['OPERADOR', 'TRANSPORTISTA', 'AUDITOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA'] as UserRole[])('blocks create and edit for %s', role => {
    expect(canVisitRoute(role, '/manifiestos/nuevo')).toBe(false);
    expect(canVisitRoute(role, '/manifiestos/qa/editar')).toBe(false);
    expect(canVisitRoute(role, '/manifiestos/qa')).toBe(true);
  });
  it('keeps root administration and blocks unknown admin routes for other roles', () => {
    expect(canVisitRoute('ADMIN', '/admin/usuarios')).toBe(true);
    expect(canVisitRoute('GENERADOR', '/admin/new-future-feature')).toBe(false);
  });
});
