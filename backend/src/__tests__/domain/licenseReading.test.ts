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
  it('supports the provincial document/name caption below its values, without a license number', () => {
    expect(licenseFields('LICENCIA DE CONDUCIR\nD.U. 90012345\nPEREZ, ANA QA\nDOCUMENTO, APELLIDO Y NOMBRE\n31-12-2027\nVENCIMIENTO\nN° DE SELLO 12345\nN° DE CONTROL 87654')).toEqual({
      dni: '90012345', apellido: 'PEREZ', nombre: 'ANA QA', vencimiento: '2027-12-31',
    });
  });
  it('associates three calendar dates only with the corresponding explicit three-date caption', () => {
    expect(licenseFields('01-03-1990 07-02-2023 07-02-2028\nNACIMIENTO EXPEDICION V.H.F. VENCIMIENTO')).toEqual({ vencimiento: '2028-02-07' });
    expect(licenseFields('01-03-1990 07-02-2023\nNACIMIENTO EXPEDICION\nVENCIMIENTO')).toEqual({});
  });
  it('does not guess a provincial number or name from an unlabelled reverse, seal or control', () => {
    expect(licenseFields('MINISTERIO DE SEGURIDAD\nQA MUNICIPIO 123\nN° DE CONTROL 87654321\nEN EMERGENCIA AVISAR A 123456\nB-1 AUTOS HASTA 3500 KGS')).toEqual({});
    expect(licenseFields('PEREZ, ANA QA\n31-12-2027')).toEqual({});
  });
  it('accepts a leading OCR punctuation mark on the caption, not on the name value', () => {
    expect(licenseFields('DU 90012345\nPEREZ, ANA QA\n¿ DOCUMENTO, APELLIDO Y NOMBRE')).toEqual({ dni: '90012345', apellido: 'PEREZ', nombre: 'ANA QA' });
  });
  it('omits conflicting provincial/standard fields and impossible expiry dates', () => {
    expect(licenseFields('DNI: 90012345\nD.U. 90054321\nApellido: GOMEZ\nPEREZ, ANA QA\nDOCUMENTO, APELLIDO Y NOMBRE\n31-02-2027\nVENCIMIENTO')).toEqual({ nombre: 'ANA QA' });
  });
});
