import { describe, expect, it } from 'vitest';
import { licenseFields } from '../../domain/licenseReading';

describe('license OCR proposes labelled facts, never legal validity', () => {
  it('reads labelled Argentine license fields and a calendar date', () => {
    expect(licenseFields('LICENCIA NACIONAL DE CONDUCIR\n1. APELLIDO: PEREZ\n2. NOMBRE: JUAN CARLOS\nDNI: 28.345.678\nNRO LICENCIA: L-12345\nVENCIMIENTO: 31/12/2027')).toEqual({ apellido: 'PEREZ', nombre: 'JUAN CARLOS', dni: '28345678', licencia: 'L-12345', vencimiento: '2027-12-31' });
  });
  it('supports labels followed by a value on the next line', () => {
    expect(licenseFields('Apellido\nGOMEZ\nNombre\nANA\nDNI\n30123456\nVence\n2027-08-10')).toMatchObject({ apellido: 'GOMEZ', nombre: 'ANA', dni: '30123456', vencimiento: '2027-08-10' });
  });
  it('never substitutes issue or birth date for expiry, nor DNI for license number', () => {
    expect(licenseFields('DNI 30123456\nFecha nacimiento: 01/01/1990\nEmisión: 10/10/2026')).toEqual({ dni: '30123456' });
  });
  it('does not invent fields from an unlabelled or illegible card', () => {
    expect(licenseFields('QA 12345 31/12/2028 Juan Perez')).toEqual({});
    expect(licenseFields('')).toEqual({});
  });
  it('does not propose impossible dates or mix another label into a name', () => {
    expect(licenseFields('Nombre:\nDNI: 30123456\nVencimiento 31/02/2027')).toEqual({ dni: '30123456' });
  });
});
