import { describe, expect, it } from 'vitest';
import { monitorReturnPath } from '../../utils/monitorReturnPath';
describe('monitor close uses the router basename exactly once', () => {
  it.each(['/monitor', '/app/monitor', '/app/monitor/'])('returns a router path from %s', path => {
    expect(monitorReturnPath(path)).toBe('/centro-control');
  });
  it('preserves the distinct web /mobile route without confusing app basename', () => {
    expect(monitorReturnPath('/mobile/monitor')).toBe('/mobile/centro-control');
  });
});
