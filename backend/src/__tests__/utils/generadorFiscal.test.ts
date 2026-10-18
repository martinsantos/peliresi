import { describe, expect, it } from 'vitest';
import {
  buildFiscalWhere,
  deriveSituacionFiscal,
  parseFiscalStatus,
  parseFiscalYear,
} from '../../utils/generadorFiscal';

describe('generadorFiscal', () => {
  it('uses records from the requested exercise only', () => {
    const result = deriveSituacionFiscal(
      [
        { anio: 2025, fechaPago: new Date('2025-01-01'), habilitado: true },
        { anio: 2026, fechaPago: null, habilitado: false },
      ],
      [
        { anio: 2025, presentada: true },
        { anio: 2026, presentada: false },
      ],
      2026,
    );

    expect(result).toMatchObject({
      anio: 2026,
      tef: 'SIN_PAGO',
      ddjj: 'PENDIENTE',
      habilitacion: 'NO_HABILITADO',
      resumen: 'REQUIERE_REVISION',
    });
    expect(result.pendientes).toEqual(['TEF sin pago', 'DDJJ pendiente', 'No habilitado']);
  });

  it('does not describe missing records as debt', () => {
    expect(deriveSituacionFiscal([], [], 2026)).toEqual({
      anio: 2026,
      tef: 'SIN_REGISTRO',
      ddjj: 'SIN_REGISTRO',
      habilitacion: 'SIN_DATO',
      resumen: 'SIN_DATOS',
      pendientes: ['TEF sin registro', 'DDJJ sin registro'],
    });
  });

  it('builds explicit same-year filters', () => {
    expect(buildFiscalWhere('TEF_SIN_PAGO', 2026)).toEqual({
      pagos: { some: { anio: 2026, fechaPago: null } },
    });
    expect(buildFiscalWhere('DDJJ_SIN_REGISTRO', 2026)).toEqual({
      ddjj: { none: { anio: 2026 } },
    });
  });

  it('normalizes supported inputs and rejects invalid years/statuses', () => {
    expect(parseFiscalStatus('tef_sin_pago')).toBe('TEF_SIN_PAGO');
    expect(parseFiscalStatus('deuda')).toBeUndefined();
    expect(parseFiscalYear('2026', 2025)).toBe(2026);
    expect(parseFiscalYear('99', 2025)).toBe(2025);
  });
});
