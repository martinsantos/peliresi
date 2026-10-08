import { describe, expect, it } from 'vitest';
import { prismaConnectionUrl } from '../../lib/prismaConnection';
const base = 'postgresql://qa:synthetic@127.0.0.1:55440/sitrep_night_qa_20260926?schema=public';
describe('bounded Prisma connection pool', () => {
  it('sets twenty connections and a ten-second wait when no pool is declared', () => {
    const result = new URL(prismaConnectionUrl(base));
    expect(result.searchParams.get('connection_limit')).toBe('20');
    expect(result.searchParams.get('pool_timeout')).toBe('10');
  });
  it('preserves smaller explicit QA pools and custom timeouts', () => {
    const result = new URL(prismaConnectionUrl(base + '&connection_limit=3&pool_timeout=7'));
    expect(result.searchParams.get('connection_limit')).toBe('3'); expect(result.searchParams.get('pool_timeout')).toBe('7');
  });
  it('preserves database, credentials, schema and transport options', () => {
    const raw = base + '&sslmode=require'; const result = new URL(prismaConnectionUrl(raw)); const previous = new URL(raw);
    for (const key of ['hostname', 'port', 'username', 'password', 'pathname'] as const) expect(result[key]).toBe(previous[key]);
    expect(result.searchParams.get('schema')).toBe('public'); expect(result.searchParams.get('sslmode')).toBe('require');
  });
  it('refuses invalid pool bounds without exposing the database URL', () => {
    for (const suffix of ['&connection_limit=0', '&connection_limit=-1', '&connection_limit=abc', '&pool_timeout=-3', '&pool_timeout=1.5']) {
      expect(() => prismaConnectionUrl(base + suffix)).toThrow(/pool|connection_limit/);
    }
  });
});
