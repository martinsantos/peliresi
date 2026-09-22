import { describe, expect, it } from 'vitest';
import {
  canReviewRenovacion,
  canSubmitRenovacion,
  createRenovacionSchema,
  reviewerActorFilter,
  sanitizeActorChanges,
} from '../../domain/renovacionPolicy';

describe('renovacion policy', () => {
  it('prevents an actor from filing a change for another actor', () => {
    expect(canSubmitRenovacion({ rol: 'GENERADOR', generador: { id: 'gen-1' } }, 'GENERADOR', 'gen-1')).toBe(true);
    expect(canSubmitRenovacion({ rol: 'GENERADOR', generador: { id: 'gen-1' } }, 'GENERADOR', 'gen-2')).toBe(false);
    expect(canSubmitRenovacion({ rol: 'GENERADOR', generador: { id: 'gen-1' } }, 'OPERADOR', 'op-1')).toBe(false);
  });

  it('scopes sector reviewers to their actor type', () => {
    expect(canReviewRenovacion('ADMIN_GENERADOR', 'GENERADOR')).toBe(true);
    expect(canReviewRenovacion('ADMIN_GENERADOR', 'OPERADOR')).toBe(false);
    expect(canReviewRenovacion('ADMIN', 'OPERADOR')).toBe(true);
    expect(reviewerActorFilter('ADMIN_OPERADOR')).toBe('OPERADOR');
  });

  it('removes identity, ownership and status fields from proposed changes', () => {
    expect(sanitizeActorChanges('GENERADOR', {
      id: 'replacement', usuarioId: 'other-user', activo: false, cuit: 'changed',
      domicilio: '  Nuevo domicilio  ', telefono: '2610000000',
    })).toEqual({ domicilio: 'Nuevo domicilio', telefono: '2610000000' });
  });

  it('rejects inconsistent and empty requests', () => {
    expect(createRenovacionSchema.safeParse({
      anio: 2026, tipoActor: 'GENERADOR', operadorId: 'op-1', modalidad: 'CON_CAMBIOS', datosNuevos: {},
    }).success).toBe(false);
    expect(createRenovacionSchema.safeParse({
      anio: 2026, tipoActor: 'OPERADOR', operadorId: 'op-1', modalidad: 'SIN_CAMBIOS',
    }).success).toBe(true);
  });
});
