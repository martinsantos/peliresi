import { describe, expect, it } from 'vitest';
import { resolveListenHost } from '../../config/listenHost';

describe('backend listener', () => {
  it('keeps a production API private when no host is configured', () => {
    expect(resolveListenHost(undefined, 'production')).toBe('127.0.0.1');
    expect(resolveListenHost('  ', 'production')).toBe('127.0.0.1');
  });

  it('respects the host explicitly configured by the deployment', () => {
    expect(resolveListenHost(' 127.0.0.1 ', 'production')).toBe('127.0.0.1');
    expect(resolveListenHost('0.0.0.0', 'production')).toBe('0.0.0.0');
  });

  it('preserves the existing default outside production', () => {
    expect(resolveListenHost(undefined, 'test')).toBeUndefined();
  });
});
