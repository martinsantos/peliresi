import { expect, it } from 'vitest';
import { openingValues } from '../../pages/inspecciones/inspectionOpeningValues';
import { readInspectionOpening, writeInspectionOpening } from '../../services/inspectionOpeningDraft';
import type { InspectionIntake } from '../../types/inspectionIntake';
const row = { id: 'a'.repeat(64), origen: 'PARTICIPANTE_EVENTUAL', referencia: 'BI-prueba', tipoActor: 'GENERADOR', actorId: null,
  actorNombre: 'Generador declarado', evidencia: { participante: { nombre: 'Generador declarado', identificacion: 'QA-123', domicilio: 'Domicilio de práctica 123' } } } as InspectionIntake;
it('carries declared identity and address through close/reopen, without inventing a registry actor', () => {
  const values = openingValues('GENERADOR', '', '', row);
  expect(values).toMatchObject({ withoutActor: true, actorId: '', inspectionType: 'ESPONTANEA', ubicacion: 'Domicilio de práctica 123' });
  expect(values.description).toContain('Identificación declarada: QA-123');
  writeInspectionOpening('chief', { version: 1, owner: 'chief', values });
  expect(readInspectionOpening('chief')?.values).toEqual(values);
  expect(readInspectionOpening('another')).toBeNull();
});
it('preserves external handoff CUIT, driver and plate without treating the declaration as verified', () => {
  const values = openingValues('GENERADOR', '', '', { ...row, tipoActor: 'TRANSPORTISTA', evidencia: { participante: { empresa: 'Relevo declarado', cuit: 'QA-555', patente: 'QA-123', chofer: 'Chofer de práctica' } } });
  expect(values.description).toContain('Identificación declarada: QA-555');
  expect(values.description).toContain('Patente declarada: QA-123');
  expect(values.description).toContain('Chofer declarado: Chofer de práctica');
  expect(values.description).toContain('identidad por verificar');
  expect(values.ubicacion).toBe('');
});
it('keeps registered finding linked to the original actor and does not synthesize external identity', () => {
  const values = openingValues('ADMIN', '', '', { ...row, actorId: 'g1', evidencia: { motivo: 'Diferencias en destino' } });
  expect(values).toMatchObject({ withoutActor: false, actorId: 'g1', inspectionType: 'GENERADOR' });
  expect(values.description).not.toContain('Sin alta');
});
