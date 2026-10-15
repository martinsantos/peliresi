import { describe, expect, it } from 'vitest';
import { advanceExceptional, exceptionalCreateSchema, exceptionalEventSchema, exceptionalPending, type ExceptionalEvent } from '../domain/manifiestoExcepcional';
const id = '00000000-0000-4000-8000-000000000001';
const difference = '00000000-0000-4000-8000-000000000002';
const base = { id: difference, version: 0, nota: 'Carga recibida diferente' };
describe('baja intensidad: hechos separados de conformidad', () => {
  it.each(['RETIRADO', 'RECIBIDO', 'TRATADO'] as const)('permite %s con original pendiente', etapa => {
    const previous = { RETIRADO: 'REGISTRADO', RECIBIDO: 'RETIRADO', TRATADO: 'RECIBIDO' } as const;
    expect(advanceExceptional(id, previous[etapa], [], { ...base, tipo: 'AVANCE', etapa }, false)).toBe(etapa);
    expect(exceptionalPending(id, [])).toEqual([{ objetivo: id, estado: 'PENDIENTE', solicitada: false }]);
  });
  it('no permite saltar etapas ni fingir conformidad por avance', () => {
    expect(() => advanceExceptional(id, 'REGISTRADO', [], { ...base, tipo: 'AVANCE', etapa: 'TRATADO' }, false)).toThrow();
  });
  it('la diferencia tiene revisión propia, no hereda la del original', () => {
    const events = [
      { ...base, tipo: 'RESOLVER', objetivo: id, decision: 'APROBADA' },
      { ...base, tipo: 'DIFERENCIA', residuos: [{ corriente: 'Y2', cantidad: 5, unidad: 'kg' }] },
    ] as ExceptionalEvent[];
    expect(exceptionalPending(id, events).map(p => p.estado)).toEqual(['APROBADA', 'PENDIENTE']);
    expect(advanceExceptional(id, 'RECIBIDO', events, { ...base, tipo: 'AVANCE', etapa: 'TRATADO' }, false)).toBe('TRATADO');
  });
  it('observación posterior conserva la operación y requiere revisión explícita', () => {
    const events = [{ ...base, tipo: 'SOLICITAR_REVISION', objetivo: id }] as ExceptionalEvent[];
    expect(advanceExceptional(id, 'TRATADO', events, { ...base, tipo: 'RESOLVER', objetivo: id, decision: 'OBSERVADA' }, true)).toBe('TRATADO');
    expect(advanceExceptional(id, 'TRATADO', events, { ...base, tipo: 'RESOLVER', objetivo: id, decision: 'RECHAZADA' }, true)).toBe('TRATADO');
    expect(() => advanceExceptional(id, 'TRATADO', events, { ...base, tipo: 'RESOLVER', objetivo: id, decision: 'APROBADA' }, false)).toThrow();
    expect(() => advanceExceptional(id, 'TRATADO', [], { ...base, tipo: 'RESOLVER', objetivo: id, decision: 'APROBADA' }, true)).toThrow();
  });
  it('no acepta objetivo inexistente ni diferencia vacía', () => {
    expect(() => advanceExceptional(id, 'RECIBIDO', [], { ...base, tipo: 'SOLICITAR_REVISION', objetivo: difference }, false)).toThrow();
    expect(() => advanceExceptional(id, 'RECIBIDO', [], { ...base, tipo: 'DIFERENCIA' }, false)).toThrow();
  });
  it('valida identidad, cantidades y rechaza campos que finjan aprobación o número', () => {
    const actor = { nombre: 'QA externo', identificacion: 'Declarado QA', domicilio: 'Calle sintética 1' };
    const input = { id, generador: actor, transportista: actor, patente: 'QA001', motivo: 'Sin alta', residuos: [{ corriente: 'Y1', cantidad: 2, unidad: 'kg' }] };
    expect(exceptionalCreateSchema.safeParse(input).success).toBe(true);
    expect(exceptionalCreateSchema.safeParse({ ...input, numero: 'OFICIAL' }).success).toBe(false);
    expect(exceptionalCreateSchema.safeParse({ ...input, generador: { ...actor, nombre: ' ' } }).success).toBe(false);
    expect(exceptionalEventSchema.safeParse({ ...base, tipo: 'DIFERENCIA', residuos: [{ corriente: 'Y1', cantidad: -1, unidad: 'kg' }] }).success).toBe(false);
    expect(exceptionalEventSchema.safeParse({ ...base, tipo: 'AVANCE', etapa: 'RETIRADO', decision: 'APROBADA' }).success).toBe(false);
    expect(exceptionalEventSchema.safeParse({ ...base, tipo: 'DIFERENCIA' }).success).toBe(false);
    expect(exceptionalEventSchema.safeParse({ ...base, nota: '', tipo: 'AVANCE', etapa: 'RETIRADO' }).success).toBe(true);
    expect(exceptionalEventSchema.safeParse({ ...base, nota: '', tipo: 'RESOLVER', objetivo: id, decision: 'APROBADA' }).success).toBe(false);
  });
});
