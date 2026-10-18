import { describe, expect, it } from 'vitest';
import { matchesAlertCondition, normalizeAlertCondition, parseAlertCondition } from '../../services/alertRuleCondition.service';

describe('alert rule conditions', () => {
  it('matches numeric thresholds and exact fields', () => {
    expect(matchesAlertCondition('{"horasTransito":{"gte":24}}', { horasTransito: 25 })).toBe(true);
    expect(matchesAlertCondition({ estadoNuevo: 'RECHAZADO' }, { estadoNuevo: 'TRATADO' })).toBe(false);
  });

  it('supports explicit all/any groups without evaluating code', () => {
    expect(matchesAlertCondition({ all: [{ severidad: { in: ['ALTA', 'CRITICA'] } }, { tipoAnomalia: 'GPS_PERDIDO' }] }, { severidad: 'ALTA', tipoAnomalia: 'GPS_PERDIDO' })).toBe(true);
  });

  it('normalizes valid JSON and rejects unknown operators or fields', () => {
    expect(normalizeAlertCondition(' { "distanciaKm": { "gt": 50 } } ')).toBe('{"distanciaKm":{"gt":50}}');
    expect(() => parseAlertCondition({ distanciaKm: { eval: 'process.exit()' } })).toThrow('Operador no permitido');
    expect(() => parseAlertCondition({ '__proto__.x': 1 })).toThrow('Campo de condición no permitido');
  });
});
