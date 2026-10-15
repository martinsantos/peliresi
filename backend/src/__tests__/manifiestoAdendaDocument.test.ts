import { expect, it } from 'vitest';
import { addendumDocument, documentaryStatus } from '../domain/manifiestoAdendaDocument';
const record = { id: 'adenda-qa', manifiestoId: 'manifest-qa', creadoPorId: 'carrier-qa', impersonadoPorId: null,
  createdAt: new Date('2026-10-15T08:00:00Z'), motivo: 'Diferencia', rectificaId: null, version: 2,
  declaracion: { numero: 'QA-1', residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }] },
  residuos: [{ corriente: 'Y2', cantidad: 12, unidad: 'kg' }],
  revisiones: [
    { id: 'r1', version: 0, decision: 'APROBADA', nota: 'Revisada', autorId: 'reviewer', fecha: '2026-10-15T09:00:00Z' },
    { id: 'r2', version: 1, decision: 'RECHAZADA', nota: 'Nueva evidencia', autorId: 'reviewer', fecha: '2026-10-15T10:00:00Z' },
  ] };
it('version zero preserves the declaration and does not borrow later approvals', () => {
  const before = JSON.stringify(record), result = addendumDocument(record, 0);
  expect(result.estado).toBe('PENDIENTE'); expect(result.revisiones).toEqual([]);
  expect(result.declaracion).toEqual(record.declaracion);
  expect(result.residuos).toEqual(record.residuos); expect(JSON.stringify(record)).toBe(before);
});
it('historic revision remains identical after later decisions', () => {
  expect(addendumDocument(record, 1)).toEqual(addendumDocument({ ...record, version: 1, revisiones: record.revisiones.slice(0, 1) }, 1));
  expect(addendumDocument(record, 1).estado).toBe('APROBADA'); expect(addendumDocument(record, 2).estado).toBe('RECHAZADA');
});
it.each([-1, 0.5, 3, NaN, Infinity])('rejects unavailable version %s', version => {
  expect(() => addendumDocument(record, version)).toThrow();
});
it('never calls reviewed addenda an official documentary closure', () => {
  expect(documentaryStatus({ total: 0, pendientes: 0, observadas: 0, rechazadas: 0 })).toBe('SIN_ADENDAS');
  expect(documentaryStatus({ total: 2, pendientes: 1, observadas: 0, rechazadas: 0 })).toBe('PENDIENTE');
  expect(documentaryStatus({ total: 2, pendientes: 0, observadas: 1, rechazadas: 0 })).toBe('OBSERVADA');
  expect(documentaryStatus({ total: 2, pendientes: 1, observadas: 0, rechazadas: 1 })).toBe('RECHAZADA');
  expect(documentaryStatus({ total: 2, pendientes: 0, observadas: 0, rechazadas: 0 })).toBe('ADENDAS_REVISADAS');
});
