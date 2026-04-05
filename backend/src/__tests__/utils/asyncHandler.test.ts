import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';

function createMocks() {
  const req = {} as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('asyncHandler', () => {
  it('calls the wrapped async function with req, res, next', async () => {
    const { req, res, next } = createMocks();
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);

    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
  });

  it('does not call next when the async function resolves successfully', async () => {
    const { req, res, next } = createMocks();
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);

    await wrapped(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('calls next with error when the async function throws', async () => {
    const { req, res, next } = createMocks();
    const error = new Error('Database failed');
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);

    await wrapped(req, res, next);

    // Allow microtask queue to flush
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(next).toHaveBeenCalledWith(error);
  });

  it('calls next with error when sync error is thrown inside async handler', async () => {
    const { req, res, next } = createMocks();
    const error = new Error('Sync throw inside async');
    const handler = vi.fn().mockImplementation(async () => {
      throw error;
    });
    const wrapped = asyncHandler(handler);

    await wrapped(req, res, next);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(next).toHaveBeenCalledWith(error);
  });

  it('returns a function (middleware signature)', () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);
    expect(typeof wrapped).toBe('function');
    expect(wrapped.length).toBe(3); // req, res, next
  });
});
