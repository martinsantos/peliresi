import { expect, it } from 'vitest';
import { catalogueCondition, validateCatalogueRule, requirementSituation, expirySituation, expiryHorizonEnd, formatDocumentExpiry } from '../../services/alertCataloguePolicy.service';
it('recognizes only explicit supported families, not general event criteria', () => {
  expect(catalogueCondition('{}')).toBeNull();
  expect(catalogueCondition('{"tipo":"requerimiento_inspeccion"}')).toEqual({ tipo: 'requerimiento_inspeccion' });
});
it.each([-1, 1.5, 366, '30'])('rejects invalid anticipation %s', days => {
  expect(() => catalogueCondition(JSON.stringify({ tipo: 'vencimiento_documental', anticipacionDias: days, entidades: ['OPERADOR'] }))).toThrow();
});
it('does not silently ignore unknown fields or unsupported sources', () => {
  expect(() => catalogueCondition('{"tipo":"requerimiento_inspeccion","dias":1}')).toThrow();
  expect(() => catalogueCondition('{"tipo":"vencimiento_documental","anticipacionDias":30,"entidades":["DDJJ"]}')).toThrow();
});
it('requires internal exact-recipient tokens and the matching event', () => {
  validateCatalogueRule('TIEMPO_EXCESIVO', '{"tipo":"requerimiento_inspeccion"}', '["INSPECCIONADO","INSPECTOR_ASIGNADO","ADMIN_GENERADOR"]');
  expect(() => validateCatalogueRule('VENCIMIENTO', '{"tipo":"requerimiento_inspeccion"}', '["ADMIN"]')).toThrow();
  expect(() => validateCatalogueRule('TIEMPO_EXCESIVO', '{"tipo":"requerimiento_inspeccion"}', '["email:test@example.com"]')).toThrow();
});
const due = new Date('2026-10-01T12:00:00Z');
const now = new Date('2026-10-04T12:00:00Z');
const request = { tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', destinatario: 'INSPECCIONADO', plazoRespuestaAt: due, inspeccion: { estado: 'NOTIFICADA' }, respuestas: [] };
it('uses the actual request deadline, with no inferred deadline or premature expiry', () => {
  expect(requirementSituation(request, now)).toBe('PENDIENTE');
  expect(requirementSituation(request, due)).toBe('FUERA_DE_ALCANCE');
  expect(requirementSituation({ ...request, plazoRespuestaAt: null }, now)).toBe('FUERA_DE_ALCANCE');
});
it('reading or an authority response is not an actor response', () => {
  expect(requirementSituation({ ...request, respuestas: [{ parte: 'AUTORIDAD', tipo: 'RESPUESTA' }] }, now)).toBe('PENDIENTE');
});
it.each(['RESPUESTA', 'DESCARGO', 'SUBSANACION'])('a linked %s ends absence, without accepting the substance', tipo => {
  expect(requirementSituation({ ...request, respuestas: [{ parte: 'INSPECCIONADO', tipo }] }, now)).toBe('RESPONDIDO');
});
it.each(['BORRADOR', 'EN_CAMPO', 'CERRADA_CONFORME', 'DERIVADA_LEGALES', 'CANCELADA'])('does not continue requests in %s', estado => {
  expect(requirementSituation({ ...request, inspeccion: { estado } }, now)).toBe('FUERA_DE_ALCANCE');
});
it('explicit expiry includes overdue dates and the inclusive anticipation boundary', () => {
  expect(expirySituation(due, true, 30, now)).toBe('VENCIDO');
  expect(expirySituation(new Date(now.getTime() + 30 * 86400000), true, 30, now)).toBe('PROXIMO');
  expect(expirySituation(new Date(now.getTime() + 31 * 86400000), true, 30, now)).toBe('FUERA_DE_ALCANCE');
  expect(expirySituation(null, true, 30, now)).toBe('FUERA_DE_ALCANCE');
  expect(expirySituation(due, false, 30, now)).toBe('FUERA_DE_ALCANCE');
});
it.each([
  ['2026-10-10T02:59:59.999Z', 'PROXIMO'], // still 09/10 in Mendoza
  ['2026-10-10T03:00:00.000Z', 'PROXIMO'],
  ['2026-10-11T02:59:59.999Z', 'PROXIMO'], // final millisecond of 10/10
  ['2026-10-11T03:00:00.000Z', 'VENCIDO'],
])('date-only 10/10 remains valid through its entire Mendoza day at %s', (instant, expected) => {
  expect(expirySituation(new Date('2026-10-10T00:00:00Z'), true, 1, new Date(instant))).toBe(expected);
});
it('zero anticipation includes today, not tomorrow or early expiry', () => {
  const evening = new Date('2026-10-11T02:00:00Z'); // 10/10 23:00 Mendoza
  expect(expirySituation(new Date('2026-10-10T00:00:00Z'), true, 0, evening)).toBe('PROXIMO');
  expect(expirySituation(new Date('2026-10-11T00:00:00Z'), true, 0, evening)).toBe('FUERA_DE_ALCANCE');
  expect(expiryHorizonEnd(evening, 0).toISOString()).toBe('2026-10-11T00:00:00.000Z');
});
it('calendar horizon includes the last selected date and crosses year end', () => {
  expect(expiryHorizonEnd(new Date('2027-01-01T02:00:00Z'), 1).toISOString()).toBe('2027-01-02T00:00:00.000Z');
  expect(expiryHorizonEnd(new Date('2028-02-28T12:00:00Z'), 1).toISOString()).toBe('2028-03-01T00:00:00.000Z');
});
it('document date display preserves the selected calendar day, never the previous evening', () => {
  expect(formatDocumentExpiry(new Date('2026-10-10T00:00:00Z'))).toBe('10/10/2026');
  expect(expirySituation(new Date('invalid'), true, 30, now)).toBe('FUERA_DE_ALCANCE');
});
