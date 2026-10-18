import { expect, it } from 'vitest';
import { followupDays, validateFollowupRule, alertResolution } from '../../services/alertFollowupPolicy.service';

it('uses a configured operational threshold, never a fabricated legal deadline', () => {
  expect(followupDays('{"tipo":"seguimiento_cierre","diasRecepcion":{"gte":3}}')).toBe(3);
  expect(followupDays('{"horasTransito":{"gte":24}}')).toBeNull();
});
it.each([-1, 1.5, 366, '3'])('rejects invalid day threshold %s', days => {
  expect(() => validateFollowupRule('TIEMPO_EXCESIVO', JSON.stringify({ tipo: 'seguimiento_cierre', diasRecepcion: { gte: days } }), '["OPERADOR"]')).toThrow();
});
it('rejects unsupported events, fields and external or unrelated recipients', () => {
  const condition = '{"tipo":"seguimiento_cierre","diasRecepcion":{"gte":0}}';
  expect(() => validateFollowupRule('VENCIMIENTO', condition, '["OPERADOR"]')).toThrow();
  expect(() => validateFollowupRule('TIEMPO_EXCESIVO', condition, '["email:x@y.com"]')).toThrow();
  expect(() => validateFollowupRule('TIEMPO_EXCESIVO', condition, '["GENERADOR"]')).toThrow();
  expect(() => followupDays('{"tipo":"seguimiento_cierre","diasRecepcion":{"gt":3}}')).toThrow();
  expect(() => followupDays('{"tipo":"seguimiento_cierre","campoDesconocido":true}')).toThrow();
});
it('requires explicit resolution and a reason, not a read acknowledgement', () => {
  expect(() => alertResolution(undefined, 'Marcada como leída', 'admin')).toThrow();
  expect(() => alertResolution('RESUELTA', '', 'admin')).toThrow();
  expect(() => alertResolution('DESCONOCIDO', 'motivo', 'admin')).toThrow();
  expect(alertResolution('RESUELTA', ' Comprobado en el expediente ', 'admin', new Date(0))).toEqual({ estado: 'RESUELTA', notas: 'Comprobado en el expediente', resueltaPor: 'admin', fechaResolucion: new Date(0) });
});
it('reviewing or reopening a case clears the terminal resolution attribution', () => {
  expect(alertResolution('EN_REVISION', 'Revisar evidencia', 'admin')).toMatchObject({ resueltaPor: null, fechaResolucion: null });
  expect(alertResolution('PENDIENTE', 'Reabierto por nueva evidencia', 'admin')).toMatchObject({ estado: 'PENDIENTE', resueltaPor: null, fechaResolucion: null });
});
