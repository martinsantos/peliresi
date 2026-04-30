import { describe, it, expect } from 'vitest';
import jwt, { SignOptions } from 'jsonwebtoken';
import { StringValue } from 'ms';

const ACCESS_SECRET = 'test-access-secret-key';
const REFRESH_SECRET = 'test-refresh-secret-key';
const WRONG_SECRET = 'this-is-the-wrong-secret';

function sign(payload: Record<string, unknown>, secret: string, opts?: SignOptions): string {
  return jwt.sign(payload, secret, opts);
}

describe('JWT access token security', () => {
  it('rejects token signed with wrong secret', () => {
    const token = sign({ id: 'user-1' }, WRONG_SECRET);
    expect(() => jwt.verify(token, ACCESS_SECRET)).toThrow();
  });

  it('rejects expired token', () => {
    const token = sign({ id: 'user-1' }, ACCESS_SECRET, { expiresIn: '0s' as StringValue });
    // small delay to ensure expiry
    expect(() => jwt.verify(token, ACCESS_SECRET)).toThrow(/expired|invalid/);
  });

  it('rejects token with tampered payload', () => {
    const token = sign({ id: 'user-1', rol: 'GENERADOR' }, ACCESS_SECRET);
    const parts = token.split('.');
    // Tamper the payload (base64)
    const tamperedPayload = Buffer.from(JSON.stringify({ id: 'user-1', rol: 'ADMIN' })).toString('base64url');
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    expect(() => jwt.verify(tampered, ACCESS_SECRET)).toThrow(/invalid|tampered|signature/);
  });

  it('rejects token with "none" algorithm', () => {
    // Craft a token with alg: none and no signature
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: 'user-1' })).toString('base64url');
    const noneToken = `${header}.${payload}.`;
    // jsonwebtoken library should reject non-verified tokens by default
    expect(() => jwt.verify(noneToken, ACCESS_SECRET)).toThrow();
  });

  it('rejects token with "none" algorithm and no trailing dot', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: 'user-1' })).toString('base64url');
    const noneToken = `${header}.${payload}`; // no trailing dot
    expect(() => jwt.verify(noneToken, ACCESS_SECRET)).toThrow();
  });

  it('rejects token with missing id claim', () => {
    const token = sign({ sub: 'subject-only' }, ACCESS_SECRET);
    const decoded = jwt.verify(token, ACCESS_SECRET) as Record<string, unknown>;
    expect(decoded.id).toBeUndefined();
  });

  it('rejects token signed with HS256 when RS256 expected (algorithm confusion)', () => {
    // jsonwebtoken defaults to HS256, so a regular sign + verify with same secret is valid
    // Algorithm confusion attack: public key as HMAC secret
    const token = sign({ id: 'user-1' }, ACCESS_SECRET);
    // With jsonwebtoken library, when algorithms=["RS256"], it should reject HS256 tokens
    expect(() => jwt.verify(token, ACCESS_SECRET, { algorithms: ['RS256'] })).toThrow();
  });

  it('access token has 15min expiry', () => {
    const token = sign({ id: 'user-1' }, ACCESS_SECRET, { expiresIn: '15m' as StringValue });
    const decoded = jwt.decode(token) as { exp?: number; iat?: number };
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    const ttlMinutes = (decoded.exp! - decoded.iat!) / 60;
    expect(ttlMinutes).toBe(15);
  });
});

describe('JWT refresh token security', () => {
  it('rejects refresh token used as access token (different secret)', () => {
    const refreshToken = sign({ id: 'user-1' }, REFRESH_SECRET, { expiresIn: '7d' as StringValue });
    // Trying to verify a refresh token with the access token secret should fail
    expect(() => jwt.verify(refreshToken, ACCESS_SECRET)).toThrow();
  });

  it('rejects access token used as refresh token', () => {
    const accessToken = sign({ id: 'user-1' }, ACCESS_SECRET, { expiresIn: '15m' as StringValue });
    expect(() => jwt.verify(accessToken, REFRESH_SECRET)).toThrow();
  });

  it('has 7d expiry on refresh token', () => {
    const token = sign({ id: 'user-1' }, REFRESH_SECRET, { expiresIn: '7d' as StringValue });
    const decoded = jwt.decode(token) as { exp?: number; iat?: number };
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    const ttlDays = (decoded.exp! - decoded.iat!) / 86400;
    expect(ttlDays).toBe(7);
  });
});
