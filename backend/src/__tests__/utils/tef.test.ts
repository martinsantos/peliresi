import { describe, expect, it } from 'vitest';
import { calculateFinalTef, sanitizeTefInputs } from '../../utils/tef';

describe('server-side deferred TEF', () => {
  it('calculates from sanitized declared inputs and a fixed M', () => {
    const inputs = sanitizeTefInputs({ zona: 'zona_industrial', coefA: { a1_stock: 0.5 }, personal: 10, potenciaHP: 20, superficieM2: 100 });
    const result = calculateFinalTef(inputs || {}, 'Y8, Y12');
    expect(result.M).toBe(162);
    expect(result.Z).toBe(1);
    expect(result.A).toBe(0.5);
    expect(result.C).toBe(2);
    expect(result.MxR).toBeGreaterThan(0);
  });

  it('does not accept a client-provided amount or coefficient', () => {
    const inputs = sanitizeTefInputs({ zona: 'zona_industrial', coefA: { a1_stock: 0.5 }, personal: 10, potenciaHP: 20, superficieM2: 100, factorR: 0, montoMxR: 0, M: 1 });
    const result = calculateFinalTef(inputs || {}, 'Y8');
    expect(result.M).toBe(162);
    expect(result.MxR).toBeGreaterThan(0);
    expect(inputs).not.toHaveProperty('factorR');
    expect(inputs).not.toHaveProperty('montoMxR');
  });
});
