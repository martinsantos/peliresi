import { expect, it } from 'vitest';
import { arcaReading } from '../../domain/arcaReading';

it('reads the labelled CUIT and name from a certificate', () => {
  expect(arcaReading('CUIT: 30-00000000-7\nRazón social: Ensayo SA')).toEqual({ cuit: '30000000007', razonSocial: 'Ensayo SA' });
});
it('reports missing, invalid and contradictory fields', () => {
  expect(arcaReading('CUIT: 30-00000000-1\nRazón social: A\nRazón social: B')).toEqual({ cuit: null, razonSocial: null });
});
