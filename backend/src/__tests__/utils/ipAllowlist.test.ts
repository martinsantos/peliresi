import { describe, expect, it } from 'vitest';
import { ipMatchesAllowlist, ipMatchesAllowlistRule } from '../../utils/ipAllowlist';

describe('demo IP allowlist', () => {
  it('matches exact and IPv4-mapped addresses', () => {
    expect(ipMatchesAllowlistRule('127.0.0.1', '127.0.0.1')).toBe(true);
    expect(ipMatchesAllowlistRule('::ffff:127.0.0.1', '127.0.0.1')).toBe(true);
    expect(ipMatchesAllowlistRule('127.0.0.2', '127.0.0.1')).toBe(false);
  });

  it('matches CIDR boundaries and rejects outside addresses', () => {
    expect(ipMatchesAllowlistRule('172.30.64.1', '172.30.64.0/24')).toBe(true);
    expect(ipMatchesAllowlistRule('172.30.64.255', '172.30.64.0/24')).toBe(true);
    expect(ipMatchesAllowlistRule('172.30.65.1', '172.30.64.0/24')).toBe(false);
    expect(ipMatchesAllowlistRule('10.0.0.1', '10.0.0.0/33')).toBe(false);
  });

  it('fails closed for malformed rules and supports wildcard explicitly', () => {
    expect(ipMatchesAllowlistRule('10.0.0.1', '10.0.0.0/not-a-prefix')).toBe(false);
    expect(ipMatchesAllowlist('10.0.0.1', ['192.168.1.0/24', '10.0.0.0/24'])).toBe(true);
    expect(ipMatchesAllowlist('10.0.0.1', ['*'])).toBe(true);
  });
});
