import { expect, it } from 'vitest';
import { canUseInspectionOperations, operationSubject, type InspectionOperation } from '../../services/inspectionOperations.service';
const row = (data: Partial<InspectionOperation>) => data as InspectionOperation;
it('identifies external declarations in the agenda without inventing a registered actor', () => {
  expect(operationSubject(row({ antecedentes: [{ actorNombre: 'Empresa declarada', actorId: null }] }))).toBe('Empresa declarada · Declarado sin alta');
  expect(operationSubject(row({}))).toBe('Responsable por identificar');
});
it('shows the verified linked actor ahead of the original external declaration', () => {
  expect(operationSubject(row({ generador: { id: 'g1', razonSocial: 'Generador registrado' }, antecedentes: [{ actorNombre: 'Declaración original', actorId: null }] }))).toBe('Generador registrado');
});
it('grants agenda access to explicitly designated chiefs but not ordinary actors', () => {
  for (const rol of ['GENERADOR', 'OPERADOR', 'TRANSPORTISTA']) {
    expect(canUseInspectionOperations({ rol, esJefeInspecciones: true })).toBe(true);
    expect(canUseInspectionOperations({ rol, esJefeInspecciones: false })).toBe(false);
  }
});
