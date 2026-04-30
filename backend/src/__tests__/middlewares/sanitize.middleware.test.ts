import { describe, it, expect, vi } from 'vitest';
import { sanitizeBody } from '../../middlewares/sanitize.middleware';
import { Request, Response, NextFunction } from 'express';

function createMocks(body: unknown) {
  const req = { body } as Request;
  const res = {} as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('sanitizeBody middleware', () => {
  it('strips HTML tags from strings', () => {
    const { req, res, next } = createMocks({ name: '<script>alert(1)</script>' });
    sanitizeBody(req, res, next);
    expect(req.body.name).toBe('alert(1)');
    expect(next).toHaveBeenCalled();
  });

  it('removes javascript: protocol', () => {
    const { req, res, next } = createMocks({ url: 'javascript:alert(1)' });
    sanitizeBody(req, res, next);
    expect(req.body.url).not.toContain('javascript:');
    expect(next).toHaveBeenCalled();
  });

  it('removes event handler attributes', () => {
    const { req, res, next } = createMocks({ msg: 'click me onerror=alert(1)' });
    sanitizeBody(req, res, next);
    expect(req.body.msg).not.toContain('onerror=');
    expect(next).toHaveBeenCalled();
  });

  it('handles nested objects recursively', () => {
    const { req, res, next } = createMocks({
      user: {
        name: '<b>John</b>',
        bio: '<script>evil()</script>',
        address: { city: 'Mendoza<script>' },
      },
    });
    sanitizeBody(req, res, next);
    expect(req.body.user.name).toBe('John');
    expect(req.body.user.bio).toBe('evil()');
    expect(req.body.user.address.city).toBe('Mendoza');
    expect(next).toHaveBeenCalled();
  });

  it('handles arrays recursively', () => {
    const { req, res, next } = createMocks({
      tags: ['<p>one</p>', '<script>two</script>', 'three'],
    });
    sanitizeBody(req, res, next);
    expect(req.body.tags).toEqual(['one', 'two', 'three']);
    expect(next).toHaveBeenCalled();
  });

  it('preserves non-string values', () => {
    const { req, res, next } = createMocks({
      count: 42,
      active: true,
      data: null,
      items: [{ id: 1 }, { id: 2 }],
    });
    sanitizeBody(req, res, next);
    expect(req.body.count).toBe(42);
    expect(req.body.active).toBe(true);
    expect(req.body.data).toBeNull();
    expect(req.body.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(next).toHaveBeenCalled();
  });

  it('handles empty body gracefully', () => {
    const { req, res, next } = createMocks({});
    sanitizeBody(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('handles null body gracefully', () => {
    const { req, res, next } = createMocks(null);
    sanitizeBody(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
