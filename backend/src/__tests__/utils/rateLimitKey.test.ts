import { describe, expect, it } from 'vitest';
import {
  buildAuthRateLimitKey,
  createAuthRateLimiter,
} from '../../middlewares/authRateLimit.middleware';

describe('buildAuthRateLimitKey', () => {
  it('normalizes the email without merging different accounts behind one VPN IP', () => {
    const ivana = buildAuthRateLimitKey({
      ip: '192.168.204.228',
      body: { email: ' IPINTOS@MENDOZA.GOV.AR ' },
    });
    const marcia = buildAuthRateLimitKey({
      ip: '192.168.204.228',
      body: { email: 'mardengo@mendoza.gov.ar' },
    });

    expect(ivana).toBe('192.168.204.228:ipintos@mendoza.gov.ar');
    expect(marcia).toBe('192.168.204.228:mardengo@mendoza.gov.ar');
    expect(ivana).not.toBe(marcia);
  });

  it('uses a stable anonymous bucket when the request has no usable email', () => {
    expect(buildAuthRateLimitKey({ ip: undefined, body: undefined })).toBe('0.0.0.0:anonymous');
    expect(buildAuthRateLimitKey({ ip: '10.0.0.1', body: { email: '  ' } }))
      .toBe('10.0.0.1:anonymous');
  });

  it('normalizes IPv6 sources through express-rate-limit semantics', () => {
    expect(buildAuthRateLimitKey({
      ip: '2001:db8:abcd:1234::1',
      body: { email: 'user@example.com' },
    }))
      .toBe('2001:db8:abcd:1200::/56:user@example.com');
  });

  it('passes express-rate-limit IPv6 key validation at middleware construction', () => {
    expect(() => createAuthRateLimiter()).not.toThrow();
  });
});
