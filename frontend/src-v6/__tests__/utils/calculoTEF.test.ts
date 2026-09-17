import { describe, expect, it } from 'vitest';
import {
  calcularC,
  calcularTEF,
  DEFAULT_A,
  isoFactor,
  type CoeficientesA,
} from '../../utils/calculoTEF';

describe('calculo TEF', () => {
  it('normaliza corrientes Y escritas en minusculas', () => {
    expect(calcularC([' y8 '])).toBe(1.3);
  });

  it('usa el mayor coeficiente entre corrientes soportadas', () => {
    expect(calcularC(['Y8', 'y12', 'Y48'])).toBe(2);
  });

  it('mantiene en cero una corriente sin coeficiente configurado', () => {
    expect(calcularC(['Y1'])).toBe(0);
  });

  it('calcula una estimacion determinista con todos los factores', () => {
    const coeficientesA: CoeficientesA = {
      ...DEFAULT_A,
      a1_stock: 0.5,
      a2_almacenamiento: 0.25,
      a3_peligrosidad: 0.25,
    };

    expect(calcularTEF({
      zona: 'zona_rural',
      coeficientesA,
      personal: 10,
      potenciaHP: 20,
      superficieM2: 100,
      corrientesY: ['y8'],
      tieneISO: false,
    })).toMatchObject({
      A: 1,
      D: 5,
      C: 1.3,
      R: 9.75,
      MxR: 1579.5,
      TEF: 1579.5,
    });
  });

  it('no inventa un ajuste monetario por ISO sin regla oficial versionada', () => {
    expect(isoFactor(false)).toBe(1);
    expect(isoFactor(true)).toBe(1);
  });
});
