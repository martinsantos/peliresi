import { describe, expect, it } from 'vitest';
import { parseManifiestoQr, parseSitrepQr } from '../../utils/qr';

describe('parseManifiestoQr', () => {
  it('parses production numbers and verification URLs', () => {
    expect(parseManifiestoQr('2026-000001')).toEqual({ numero: '2026-000001' });
    expect(parseManifiestoQr('https://rptrazar.mendoza.gov.ar/manifiestos/verificar/2026-000001'))
      .toEqual({ numero: '2026-000001' });
  });

  it('parses legacy JSON without turning the internal id into a route', () => {
    expect(parseManifiestoQr(JSON.stringify({ numero: '2026-000001', id: 'cm123abc' })))
      .toEqual({ numero: '2026-000001', id: 'cm123abc' });
  });

  it('rejects arbitrary text and unrelated URLs', () => {
    expect(parseManifiestoQr('not-a-manifest')).toBeNull();
    expect(parseManifiestoQr('https://example.com/help')).toBeNull();
    expect(parseManifiestoQr('https://example.com/2026-000001')).toBeNull();
  });
});

describe('parseSitrepQr', () => {
  const signedToken = `${'a'.repeat(32)}.${'b'.repeat(64)}`;

  it('unifies manifest and signed-certificate QR routes', () => {
    expect(parseSitrepQr('2026-000001')).toEqual({ kind: 'manifiesto', numero: '2026-000001' });
    expect(parseSitrepQr(`https://sitrep.ultimamilla.com.ar/certificados/verificar/${signedToken}`))
      .toEqual({ kind: 'certificado', token: signedToken });
  });

  it('extracts the token but never follows an embedded foreign host', () => {
    expect(parseSitrepQr(`https://untrusted.example/certificados/verificar/${signedToken}`))
      .toEqual({ kind: 'certificado', token: signedToken });
  });

  it('rejects malformed certificate tokens and unrelated paths', () => {
    expect(parseSitrepQr('https://sitrep.ultimamilla.com.ar/certificados/verificar/not-signed')).toBeNull();
    expect(parseSitrepQr(`https://sitrep.ultimamilla.com.ar/otra-ruta/${signedToken}`)).toBeNull();
  });
});
