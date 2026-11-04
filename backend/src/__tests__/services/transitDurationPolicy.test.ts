import { describe, expect, it } from 'vitest';
import { hasConfiguredTransitThreshold } from '../../services/alertRuleCondition.service';
import { transitRuleNeedsThreshold } from '../../services/transitDurationPolicy.service';

describe('explicit transit monitoring thresholds', () => {
  it.each([
    [{ horasTransito: { gte: 24 } }],
    [{ horasTransito: { gt: '48' } }],
    [{ horasTransito: { gte: 0 } }],
    [{ all: [{ numero: 'QA-1' }, { horasTransito: { gte: 12 } }] }],
    [{ any: [{ horasTransito: { gt: 10 } }, { horasTransito: { gte: 20 } }] }],
    [{ horasTransito: { gte: 8 }, any: [{ numero: 'A' }, { numero: 'B' }] }],
  ])('recognizes a lower bound that applies to every matching branch', condition => {
    expect(hasConfiguredTransitThreshold(condition)).toBe(true);
  });

  it.each([
    [{}], [{ tipo: 'seguimiento_cierre', diasRecepcion: { gte: 7 } }],
    [{ horasTransito: { lt: 24 } }], [{ horasTransito: { gte: -1 } }], [{ horasTransito: { gte: 'no-numérico' } }],
    [{ any: [{ horasTransito: { gte: 24 } }, { numero: 'QA-1' }] }],
    [{ all: [{ numero: 'QA-1' }, { any: [{ horasTransito: { gt: 24 } }, { estado: 'EN_TRANSITO' }] }] }],
  ])('does not infer an implicit transit deadline from another condition', condition => {
    expect(hasConfiguredTransitThreshold(condition)).toBe(false);
  });

  it('does not confuse reserved follow-up and inspection rules with transit monitoring', () => {
    expect(transitRuleNeedsThreshold('TIEMPO_EXCESIVO', '{"tipo":"seguimiento_cierre","diasRecepcion":{"gte":7}}')).toBe(false);
    expect(transitRuleNeedsThreshold('TIEMPO_EXCESIVO', '{"tipo":"requerimiento_inspeccion"}')).toBe(false);
    expect(transitRuleNeedsThreshold('TIEMPO_EXCESIVO', '{}')).toBe(true);
    expect(transitRuleNeedsThreshold('CAMBIO_ESTADO', '{}')).toBe(false);
  });
});
