import { describe, expect, it } from 'vitest';
import { parseInspectionTraceUrl, parseQrPayload } from '../../pages/escaner/qrParser';

describe('QR payload parser', () => {
  it('accepts the canonical inspection verification URL', () => {
    const parsed = parseInspectionTraceUrl(
      'https://rptrazar.mendoza.gov.ar/verificar/inspecciones/eyJpZCI6IjEyMyJ9.signature',
    );

    expect(parsed?.token).toBe('eyJpZCI6IjEyMyJ9.signature');
    expect(parseQrPayload(parsed!.url)).toEqual({
      kind: 'inspection',
      token: parsed!.token,
      url: parsed!.url,
    });
  });

  it('rejects an inspection URL hosted outside SITREP', () => {
    expect(parseInspectionTraceUrl(
      'https://evil.example/verificar/inspecciones/eyJpZCI6IjEyMyJ9.signature',
    )).toBeNull();
  });

  it('rejects invalid QR text', () => {
    expect(parseQrPayload('esto no es un QR de SITREP')).toBeNull();
  });

  it('keeps manifest QR compatibility', () => {
    expect(parseQrPayload('M-2025-0089')).toEqual({ kind: 'manifiesto', id: 'M-2025-0089' });
    expect(parseQrPayload('https://rptrazar.mendoza.gov.ar/manifiestos/verificar/M-2025-0089'))
      .toEqual({ kind: 'manifiesto', id: 'M-2025-0089' });
  });
});
