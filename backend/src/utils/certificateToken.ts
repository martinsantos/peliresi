import crypto from 'crypto';

export interface CertificateTokenPayload {
  v: 1;
  serial: string;
  credentialId: string;
  subjectHash: string;
  validFrom: string;
  validUntil: string;
  policyVersion: string;
}

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

export function certificateSubjectHash(snapshot: unknown): string {
  return crypto.createHash('sha256').update(stableJson(snapshot)).digest('hex');
}

/** Deterministic JSON prevents property insertion order from changing a
 * certificate hash when the same immutable snapshot is reconstructed. */
function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

export function signCertificateToken(payload: CertificateTokenPayload, privateKey: string): string {
  const encoded = base64url(JSON.stringify(payload));
  const signature = crypto.sign(null, Buffer.from(encoded), privateKey);
  return `${encoded}.${base64url(signature)}`;
}

export function verifyCertificateToken(token: string, publicKey: string): CertificateTokenPayload | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  try {
    const valid = crypto.verify(null, Buffer.from(encoded), publicKey, Buffer.from(signature, 'base64url'));
    if (!valid) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as CertificateTokenPayload;
    if (payload.v !== 1 || !payload.serial || !payload.credentialId || !payload.subjectHash) return null;
    return payload;
  } catch {
    return null;
  }
}
