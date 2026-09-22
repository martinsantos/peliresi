import crypto from 'crypto';
import { config } from '../config/config';

const PURPOSE = 'sitrep-inspection-trace';
const VERSION = 1;

export type InspectionTraceClaims = {
  aud: typeof PURPOSE;
  inspectionId: string;
  numero: string;
  recordVersion: number;
  fingerprint: string;
  v: typeof VERSION;
};

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(encodedPayload: string): Buffer {
  return crypto.createHmac('sha256', config.INSPECTION_TRACE_SECRET).update(encodedPayload).digest();
}

function isCanonicalBase64Url(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value) && Buffer.from(value, 'base64url').toString('base64url') === value;
}

export function createInspectionTraceToken(inspectionId: string, numero: string, recordVersion: number, fingerprint: string): string {
  const payload: InspectionTraceClaims = { aud: PURPOSE, inspectionId, numero, recordVersion, fingerprint, v: VERSION };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload).toString('base64url')}`;
}

export function verifyInspectionTraceToken(token: string): InspectionTraceClaims | null {
  try {
    const segments = token.split('.');
    if (segments.length !== 2) return null;
    const [encodedPayload, encodedSignature] = segments;
    if (!encodedPayload || !encodedSignature || token.length > 1024 || !isCanonicalBase64Url(encodedPayload) || !isCanonicalBase64Url(encodedSignature)) return null;
    const expected = sign(encodedPayload);
    const actual = Buffer.from(encodedSignature, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<InspectionTraceClaims>;
    if (claims.aud !== PURPOSE || claims.v !== VERSION || typeof claims.inspectionId !== 'string' || !claims.inspectionId || typeof claims.numero !== 'string' || !claims.numero || typeof claims.recordVersion !== 'number' || !Number.isInteger(claims.recordVersion) || claims.recordVersion < 1 || typeof claims.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(claims.fingerprint)) return null;
    return claims as InspectionTraceClaims;
  } catch {
    return null;
  }
}

export function buildInspectionTraceUrl(token: string): string {
  return `${config.FRONTEND_URL}/verificar/inspecciones/${token}`;
}

export function buildInspectionTracePresentation(input: { id: string; numero: string; version: number; fingerprint: string }): {
  token: string;
  url: string;
} {
  const token = createInspectionTraceToken(input.id, input.numero, input.version, input.fingerprint);
  return { token, url: buildInspectionTraceUrl(token) };
}

export function inspectionTraceUrl(inspectionId: string, numero: string, version: number, fingerprint: string): string {
  return buildInspectionTracePresentation({ id: inspectionId, numero, version, fingerprint }).url;
}
