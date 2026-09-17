import {
  atmFingerprintHmac,
  normalizeAtmReference,
  normalizeCuitDigits,
  normalizeDni,
  normalizePlate,
  sha256Buffer,
} from '../../utils/documentNormalization';

describe('document normalization and fingerprints', () => {
  it('normalizes identifiers without changing their semantic value', () => {
    expect(normalizePlate(' ab-123-cd ')).toBe('AB123CD');
    expect(normalizeDni('20.123.456')).toBe('20123456');
    expect(normalizeCuitDigits('30-12345678-9')).toBe('30123456789');
    expect(normalizeAtmReference(' atm / 2026-0001 ')).toBe('ATM20260001');
  });

  it('hashes exact bytes and is stable for the same ATM semantic tuple', () => {
    expect(sha256Buffer(Buffer.from('SITREP'))).toBe('fead5a86830440d33bddb09e44cf4155c21fa129de2fdf870cc48cde9292789d');
    const input = { issuer: 'ATM', reference: 'A-01', cuit: '30-12345678-9', amountCents: 12345n, period: '2026/08', paidAt: '2026-08-13' };
    expect(atmFingerprintHmac(input, 'secret')).toBe(atmFingerprintHmac({ ...input, issuer: ' atm ' , reference: 'a 01', cuit: '30 12345678 9', period: '2026-08' }, 'secret'));
    expect(atmFingerprintHmac(input, 'secret')).not.toBe(atmFingerprintHmac(input, 'other-secret'));
  });
});
