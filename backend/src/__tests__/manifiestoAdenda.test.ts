import { describe, expect, it } from 'vitest';
import { addendumCreateSchema, addendumReviewSchema, canRecordAddendum, addendumStageAllowed } from '../domain/manifiestoAdenda';

const manifest = { transportistaId: 't', operadorId: 'o' };
describe('ordinary manifest addenda contract', () => {
  it('allows assigned carrier/operator, never unrelated actors or admin by role alone', () => {
    expect(canRecordAddendum({ rol: 'TRANSPORTISTA', transportista: { id: 't' } }, manifest)).toBe(true);
    expect(canRecordAddendum({ rol: 'OPERADOR', operador: { id: 'o' } }, manifest)).toBe(true);
    for (const user of [{ rol: 'ADMIN' }, { rol: 'GENERADOR' }, { rol: 'OPERADOR', operador: { id: 'other' } }]) {
      expect(canRecordAddendum(user, manifest)).toBe(false);
    }
  });
  it('records facts through treatment, without requiring prior approval of the adenda', () => {
    for (const stage of ['APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO', 'RECHAZADO']) expect(addendumStageAllowed(stage)).toBe(true);
    for (const stage of ['BORRADOR', 'PENDIENTE_APROBACION', 'CANCELADO', 'unknown']) expect(addendumStageAllowed(stage)).toBe(false);
  });
  it('rejects forged original declaration, number, state and empty or invalid observed load', () => {
    const input = { id: '00000000-0000-4000-8000-000000000001', motivo: 'Carga observada distinta', residuos: [{ corriente: 'Y1', cantidad: 12, unidad: 'kg' }] };
    expect(addendumCreateSchema.safeParse(input).success).toBe(true);
    for (const extra of [{ numero: 'FAKE' }, { declaracion: [] }, { estado: 'TRATADO' }, { residuos: [] }, { residuos: [{ corriente: 'Y1', cantidad: -1, unidad: 'kg' }] }]) {
      expect(addendumCreateSchema.safeParse({ ...input, ...extra }).success).toBe(false);
    }
  });
  it('requires a reason and version for every resolution; does not accept implicit approval', () => {
    const input = { id: '00000000-0000-4000-8000-000000000002', version: 0, nota: 'Evidencia revisada', decision: 'OBSERVADA' };
    expect(addendumReviewSchema.safeParse(input).success).toBe(true);
    for (const extra of [{ nota: '' }, { decision: 'SILENCIO' }, { version: -1 }, { estadoManifiesto: 'TRATADO' }]) expect(addendumReviewSchema.safeParse({ ...input, ...extra }).success).toBe(false);
  });
});
