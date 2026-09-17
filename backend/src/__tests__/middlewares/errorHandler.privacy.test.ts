import { describe, expect, it, vi } from 'vitest';
const log = vi.hoisted(() => vi.fn());
vi.mock('../../utils/logger', () => ({ default: { error: log } }));
import { errorHandler } from '../../middlewares/errorHandler';

describe('error privacy', () => {
  it('does not expose database query contents in response or logs', () => {
    const secret = 'private-document-and-password';
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    errorHandler(new Error(secret), { method: 'POST', path: '/private/token', route: { path: '/:id' } } as any, response as any, vi.fn());
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
    expect(JSON.stringify(response.json.mock.calls)).not.toContain(secret);
    expect(response.status).toHaveBeenCalledWith(500);
  });
});
