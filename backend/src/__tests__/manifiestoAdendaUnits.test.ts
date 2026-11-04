import { expect, it } from 'vitest';
import { addendumCreateSchema } from '../domain/manifiestoAdenda';

it.each(['kg', 'lt', 'tn', 'un', 'l', 't', 'm3'])('preserves the observed unit %s without converting its quantity', unidad => {
  const command = { id: '00000000-0000-4000-8000-000000000001', motivo: 'Diferencia observada',
    residuos: [{ corriente: 'Y1', cantidad: 12.5, unidad }] };
  expect(addendumCreateSchema.parse(command)).toEqual(command);
});
it('rejects an unknown unit instead of silently replacing it with kg', () => {
  expect(addendumCreateSchema.safeParse({ id: '00000000-0000-4000-8000-000000000001', motivo: 'Diferencia',
    residuos: [{ corriente: 'Y1', cantidad: 12.5, unidad: 'desconocida' }] }).success).toBe(false);
});
