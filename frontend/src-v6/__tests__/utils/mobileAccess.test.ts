import { describe, expect, it } from 'vitest';
import type { User, UserRole } from '../../contexts/AuthContext';
import { canAccessMobilePath } from '../../utils/mobileAccess';

function user(rol: UserRole, esInspector = false): User {
  return {
    id: rol,
    nombre: rol,
    email: `${rol.toLowerCase()}@example.test`,
    rol,
    sector: '',
    avatar: '',
    telefono: '',
    ubicacion: '',
    permisos: [],
    esInspector,
  };
}

describe('canAccessMobilePath', () => {
  it('keeps ordinary authenticated routes available', () => {
    expect(canAccessMobilePath(user('GENERADOR'), '/dashboard')).toBe(true);
    expect(canAccessMobilePath(user('TRANSPORTISTA'), '/manifiestos')).toBe(true);
  });

  it('only exposes inspections to inspectors and administrators', () => {
    expect(canAccessMobilePath(user('GENERADOR'), '/inspecciones')).toBe(false);
    expect(canAccessMobilePath(user('GENERADOR', true), '/inspecciones/abc')).toBe(true);
    expect(canAccessMobilePath(user('ADMIN_OPERADOR'), '/inspecciones')).toBe(true);
  });

  it('exposes the contradiction portal only to inspected actor roles', () => {
    expect(canAccessMobilePath(user('GENERADOR'), '/mis-inspecciones')).toBe(true);
    expect(canAccessMobilePath(user('TRANSPORTISTA'), '/mis-inspecciones/case-1')).toBe(true);
    expect(canAccessMobilePath(user('OPERADOR'), '/mis-inspecciones')).toBe(true);
    expect(canAccessMobilePath(user('ADMIN'), '/mis-inspecciones')).toBe(false);
    expect(canAccessMobilePath(user('ADMIN_GENERADOR'), '/mis-inspecciones')).toBe(false);
  });

  it('mirrors sector-admin boundaries from the web router', () => {
    expect(canAccessMobilePath(user('ADMIN_GENERADOR'), '/admin/actores/generadores')).toBe(true);
    expect(canAccessMobilePath(user('ADMIN_GENERADOR'), '/admin/actores/operadores')).toBe(false);
    expect(canAccessMobilePath(user('ADMIN_OPERADOR'), '/admin/tratamientos')).toBe(true);
    expect(canAccessMobilePath(user('ADMIN_TRANSPORTISTA'), '/admin/vehiculos')).toBe(true);
  });

  it('allows a transportista to open a detail but not the admin list/editor', () => {
    expect(canAccessMobilePath(user('TRANSPORTISTA'), '/admin/actores/transportistas/t-1')).toBe(true);
    expect(canAccessMobilePath(user('TRANSPORTISTA'), '/admin/actores/transportistas')).toBe(false);
    expect(canAccessMobilePath(user('TRANSPORTISTA'), '/admin/actores/transportistas/nuevo')).toBe(false);
    expect(canAccessMobilePath(user('TRANSPORTISTA'), '/admin/actores/transportistas/t-1/editar')).toBe(false);
  });

  it('reserves global administration for the super admin', () => {
    expect(canAccessMobilePath(user('ADMIN'), '/admin/usuarios')).toBe(true);
    expect(canAccessMobilePath(user('ADMIN_GENERADOR'), '/admin/usuarios')).toBe(false);
    expect(canAccessMobilePath(user('GENERADOR'), '/admin/unknown')).toBe(false);
  });
});
