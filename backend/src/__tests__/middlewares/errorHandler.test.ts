import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// Mock the logger to avoid pino output during tests
vi.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { AppError, errorHandler } from '../../middlewares/errorHandler';

// Helper to create mock Express objects
function createMocks() {
  const req = { method: 'GET', path: '/test' } as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('AppError', () => {
  it('creates an error with message and statusCode', () => {
    const err = new AppError('Not found', 404);
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('AppError');
  });

  it('creates an error without statusCode', () => {
    const err = new AppError('Something went wrong');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBeUndefined();
  });

  it('is an instance of Error', () => {
    const err = new AppError('test', 400);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('errorHandler middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('sends correct status code for AppError', () => {
    const { req, res, next } = createMocks();
    const err = new AppError('Bad request', 400);

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        status: 400,
        message: 'Bad request',
      })
    );
  });

  it('defaults to 500 for errors without statusCode', () => {
    const { req, res, next } = createMocks();
    const err = new AppError('Unknown error');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('handles Prisma P2002 (unique constraint) as 409', () => {
    const { req, res, next } = createMocks();
    const err = new PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
      meta: { target: ['email'] },
    });

    errorHandler(err as unknown as AppError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        status: 409,
        message: 'El registro ya existe',
      })
    );
  });

  it('handles Prisma P2025 (not found) as 404', () => {
    const { req, res, next } = createMocks();
    const err = new PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });

    errorHandler(err as unknown as AppError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        status: 404,
        message: 'Recurso no encontrado',
      })
    );
  });

  it('hides internal details in production for 500 errors', () => {
    process.env.NODE_ENV = 'production';
    const { req, res, next } = createMocks();
    const err = new AppError('Database connection failed');
    err.details = { internal: 'sensitive info' };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        status: 500,
        message: 'Error interno del servidor',
        details: undefined,
      })
    );
  });

  it('shows details in development for 500 errors', () => {
    process.env.NODE_ENV = 'development';
    const { req, res, next } = createMocks();
    const err = new AppError('Database connection failed');
    err.details = { table: 'users' };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: { table: 'users' },
      })
    );
  });

  it('does not hide message for non-500 errors in production', () => {
    process.env.NODE_ENV = 'production';
    const { req, res, next } = createMocks();
    const err = new AppError('Manifiesto not found', 404);

    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Manifiesto not found',
      })
    );
  });
});
