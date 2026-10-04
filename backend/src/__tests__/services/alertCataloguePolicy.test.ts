import { expect, it } from 'vitest';
import { catalogueCondition, validateCatalogueRule, requirementSituation, expirySituation } from '../../services/alertCataloguePolicy.service';
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
