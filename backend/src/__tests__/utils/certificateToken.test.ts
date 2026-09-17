import crypto from 'crypto';
import { certificateSubjectHash, signCertificateToken, verifyCertificateToken, type CertificateTokenPayload } from '../../utils/certificateToken';

describe('signed certificate tokens', () => {
  const keys = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const payload: CertificateTokenPayload = {
    v: 1,
    serial: 'SITREP-2026-TEST',
    credentialId: 'cred-1',
    subjectHash: certificateSubjectHash({ actor: { id: 'actor-1' } }),
    validFrom: '2026-08-13T00:00:00.000Z',
    validUntil: '2027-08-13T00:00:00.000Z',
    policyVersion: '1',
  };

  it('round-trips a payload with Ed25519', () => {
    const token = signCertificateToken(payload, keys.privateKey);
    expect(verifyCertificateToken(token, keys.publicKey)).toEqual(payload);
  });

  it('rejects tampering and malformed tokens', () => {
    const token = signCertificateToken(payload, keys.privateKey);
    const [encoded, signature] = token.split('.');
    expect(verifyCertificateToken(`${encoded}x.${signature}`, keys.publicKey)).toBeNull();
    expect(verifyCertificateToken('not-a-token', keys.publicKey)).toBeNull();
  });
});
