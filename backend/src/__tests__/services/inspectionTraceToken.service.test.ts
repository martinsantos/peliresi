import { describe, expect, it } from 'vitest';
import {
  buildInspectionTracePresentation,
  buildInspectionTraceUrl,
  createInspectionTraceToken,
  verifyInspectionTraceToken,
} from '../../services/inspectionTraceToken.service';

describe('inspection trace QR token', () => {
  it('round-trips a signed token and builds the canonical URL', () => {
    const fingerprint = 'a'.repeat(64);
    const token = createInspectionTraceToken('inspeccion-1', 'I-2026-000001', 3, fingerprint);
    expect(verifyInspectionTraceToken(token)).toEqual({
      aud: 'sitrep-inspection-trace',
      inspectionId: 'inspeccion-1',
      numero: 'I-2026-000001',
      recordVersion: 3,
      fingerprint,
      v: 1,
    });
    expect(buildInspectionTraceUrl(token)).toContain(`/verificar/inspecciones/${token}`);
    expect(buildInspectionTracePresentation({ id: 'inspeccion-1', numero: 'I-2026-000001', version: 3, fingerprint })).toEqual({ token, url: buildInspectionTraceUrl(token) });
  });

  it('rejects altered payloads and signatures', () => {
    const token = createInspectionTraceToken('inspeccion-1', 'I-2026-000001', 1, 'b'.repeat(64));
    const [payload, signature] = token.split('.');
    const alteredPayload = Buffer.from(JSON.stringify({ aud: 'sitrep-inspection-trace', inspectionId: 'other', numero: 'I-2026-000001', recordVersion: 1, fingerprint: 'b'.repeat(64), v: 1 })).toString('base64url');
    expect(verifyInspectionTraceToken(`${alteredPayload}.${signature}`)).toBeNull();
    expect(verifyInspectionTraceToken(`${payload}.${'0'.repeat(signature.length)}`)).toBeNull();
    expect(verifyInspectionTraceToken('not-a-token')).toBeNull();
    expect(verifyInspectionTraceToken(`${token}.extra`)).toBeNull();
    expect(verifyInspectionTraceToken(`${payload}=.${signature}`)).toBeNull();
  });

  it('preserves the emitted version and fingerprint when the record later changes', () => {
    const token = createInspectionTraceToken('inspeccion-1', 'I-2026-000001', 4, 'c'.repeat(64));
    expect(verifyInspectionTraceToken(token)).toMatchObject({ recordVersion: 4, fingerprint: 'c'.repeat(64) });
  });
});
