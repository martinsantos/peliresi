import { describe, it, expect } from 'vitest';
import { isFullAccess, applyRoleFilter, canAccessManifiesto } from '../../utils/roleFilter';

describe('isFullAccess', () => {
  it('returns true for ADMIN', () => {
    expect(isFullAccess({ rol: 'ADMIN' })).toBe(true);
  });

  it('returns true for ADMIN_GENERADOR', () => {
    expect(isFullAccess({ rol: 'ADMIN_GENERADOR' })).toBe(true);
  });

  it('returns true for ADMIN_TRANSPORTISTA', () => {
    expect(isFullAccess({ rol: 'ADMIN_TRANSPORTISTA' })).toBe(true);
  });

  it('returns true for ADMIN_OPERADOR', () => {
    expect(isFullAccess({ rol: 'ADMIN_OPERADOR' })).toBe(true);
  });

  it('returns true for inspector regardless of role', () => {
    expect(isFullAccess({ rol: 'GENERADOR', esInspector: true })).toBe(true);
    expect(isFullAccess({ rol: 'TRANSPORTISTA', esInspector: true })).toBe(true);
    expect(isFullAccess({ rol: 'OPERADOR', esInspector: true })).toBe(true);
  });

  it('returns false for regular GENERADOR', () => {
    expect(isFullAccess({ rol: 'GENERADOR' })).toBe(false);
  });

  it('returns false for regular TRANSPORTISTA', () => {
    expect(isFullAccess({ rol: 'TRANSPORTISTA' })).toBe(false);
  });

  it('returns false for regular OPERADOR', () => {
    expect(isFullAccess({ rol: 'OPERADOR' })).toBe(false);
  });

  it('returns false when esInspector is explicitly false', () => {
    expect(isFullAccess({ rol: 'GENERADOR', esInspector: false })).toBe(false);
  });
});

describe('canAccessManifiesto', () => {
  const manifiesto = {
    generadorId: 'gen-1',
    transportistaId: 'trans-1',
    operadorId: 'oper-1',
  };

  it('allows full access roles', () => {
    expect(canAccessManifiesto({ rol: 'ADMIN' }, manifiesto)).toBe(true);
    expect(canAccessManifiesto({ rol: 'ADMIN_GENERADOR' }, manifiesto)).toBe(true);
    expect(canAccessManifiesto({ rol: 'GENERADOR', esInspector: true }, manifiesto)).toBe(true);
  });

  it('allows actor owners', () => {
    expect(canAccessManifiesto({
      rol: 'GENERADOR',
      generador: { id: 'gen-1' },
      transportista: null,
      operador: null,
    }, manifiesto)).toBe(true);
    expect(canAccessManifiesto({
      rol: 'TRANSPORTISTA',
      generador: null,
      transportista: { id: 'trans-1' },
      operador: null,
    }, manifiesto)).toBe(true);
    expect(canAccessManifiesto({
      rol: 'OPERADOR',
      generador: null,
      transportista: null,
      operador: { id: 'oper-1' },
    }, manifiesto)).toBe(true);
  });

  it('denies non-owner actors', () => {
    expect(canAccessManifiesto({
      rol: 'GENERADOR',
      generador: { id: 'gen-2' },
      transportista: null,
      operador: null,
    }, manifiesto)).toBe(false);
    expect(canAccessManifiesto({
      rol: 'TRANSPORTISTA',
      generador: null,
      transportista: { id: 'trans-2' },
      operador: null,
    }, manifiesto)).toBe(false);
    expect(canAccessManifiesto({
      rol: 'OPERADOR',
      generador: null,
      transportista: null,
      operador: { id: 'oper-2' },
    }, manifiesto)).toBe(false);
  });

  it('denies users without an actor association', () => {
    expect(canAccessManifiesto({
      rol: 'GENERADOR',
      generador: null,
      transportista: null,
      operador: null,
    }, manifiesto)).toBe(false);
  });
});

describe('applyRoleFilter', () => {
  it('does not modify where clause for ADMIN', () => {
    const where: Record<string, unknown> = {};
    applyRoleFilter(where, {
      rol: 'ADMIN',
      generador: null,
      transportista: null,
      operador: null,
    });
    expect(where).toEqual({});
  });

  it('does not modify where clause for inspector', () => {
    const where: Record<string, unknown> = {};
    applyRoleFilter(where, {
      rol: 'GENERADOR',
      esInspector: true,
      generador: { id: 'gen-1' },
      transportista: null,
      operador: null,
    });
    expect(where).toEqual({});
  });

  it('filters by generadorId for GENERADOR role', () => {
    const where: Record<string, unknown> = {};
    applyRoleFilter(where, {
      rol: 'GENERADOR',
      generador: { id: 'gen-1' },
      transportista: null,
      operador: null,
    });
    expect(where).toEqual({ generadorId: 'gen-1' });
  });

  it('filters by transportistaId for TRANSPORTISTA role', () => {
    const where: Record<string, unknown> = {};
    applyRoleFilter(where, {
      rol: 'TRANSPORTISTA',
      generador: null,
      transportista: { id: 'trans-1' },
      operador: null,
    });
    expect(where).toEqual({ transportistaId: 'trans-1' });
  });

  it('filters by operadorId for OPERADOR role', () => {
    const where: Record<string, unknown> = {};
    applyRoleFilter(where, {
      rol: 'OPERADOR',
      generador: null,
      transportista: null,
      operador: { id: 'oper-1' },
    });
    expect(where).toEqual({ operadorId: 'oper-1' });
  });

  it('does not add filter when GENERADOR has no associated generador', () => {
    const where: Record<string, unknown> = {};
    applyRoleFilter(where, {
      rol: 'GENERADOR',
      generador: null,
      transportista: null,
      operador: null,
    });
    expect(where).toEqual({});
  });

  it('preserves existing where conditions', () => {
    const where: Record<string, unknown> = { estado: 'APROBADO' };
    applyRoleFilter(where, {
      rol: 'TRANSPORTISTA',
      generador: null,
      transportista: { id: 'trans-1' },
      operador: null,
    });
    expect(where).toEqual({ estado: 'APROBADO', transportistaId: 'trans-1' });
  });

  it('does not modify where for ADMIN_GENERADOR sub-admin', () => {
    const where: Record<string, unknown> = {};
    applyRoleFilter(where, {
      rol: 'ADMIN_GENERADOR',
      generador: null,
      transportista: null,
      operador: null,
    });
    expect(where).toEqual({});
  });
});
