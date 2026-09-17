import { describe, expect, it } from 'vitest';
import { parseQrPayload } from '../../utils/qrPayload';

describe('parseQrPayload', () => {
  it('accepts the canonical number and public verification URL', () => {
    expect(parseQrPayload('2026-000001')).toEqual({ numero: '2026-000001' });
    expect(parseQrPayload('https://rptrazar.mendoza.gov.ar/manifiestos/verificar/2026-000001'))
      .toEqual({ numero: '2026-000001' });
  });

  it('accepts legacy JSON with both identities', () => {
    expect(parseQrPayload(JSON.stringify({ numero: '2026-000001', id: 'cm123abc' })))
      .toEqual({ numero: '2026-000001', id: 'cm123abc' });
  });

  it('rejects unrelated values', () => {
    expect(parseQrPayload('hello')).toBeNull();
    expect(parseQrPayload('https://example.com/help')).toBeNull();
  });
});
