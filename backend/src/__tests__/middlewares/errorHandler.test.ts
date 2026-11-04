import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { MulterError } from 'multer';
import { z } from 'zod';

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
    setHeader: vi.fn().mockReturnThis(),
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

  it.each(['INSPECTION_COMMAND_NOT_APPLIED', 'INSPECTION_COMMAND_CONFLICT', 'SUPPORT_ACTION_NOT_APPLIED', 'INSPECTION_SCAN_UNAVAILABLE', 'INSPECTION_SCAN_REJECTED', 'PRIVATE_INTERNAL_CODE'])('exposes only safe recovery codes: %s', code => {
    process.env.NODE_ENV = 'production';
    const { req, res, next } = createMocks();
    const err = new AppError('Revise la presentación', 409);
    err.code = code;
    errorHandler(err, req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: code === 'PRIVATE_INTERNAL_CODE' ? undefined : code,
    }));
  });

  it.each(['test', 'production'])('returns a safe 400 for schema validation in %s', (environment) => {
    process.env.NODE_ENV = environment;
    const { req, res, next } = createMocks();
    const result = z.object({ version: z.number().int().positive('La versión debe ser positiva') }).safeParse({ version: -1 });
    if (result.success) throw new Error('Expected invalid fixture');
    errorHandler(result.error as unknown as AppError, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'La versión debe ser positiva', status: 400, details: undefined,
    }));
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

  it('gives a safe recovery response when a transaction cannot start', () => {
    process.env.NODE_ENV = 'production';
    const { req, res, next } = createMocks();
    const err = new PrismaClientKnownRequestError('Transaction API error', {
      code: 'P2028', clientVersion: '5.22.0',
      meta: { error: 'Unable to start a transaction in the given time.' },
    });
    errorHandler(err as unknown as AppError, req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '5');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'TRANSACTION_BUSY', retryAfterSeconds: 5,
      message: expect.stringContaining('revisá el estado'),
    }));
  });

  it('does not imply a safe retry for another transaction error', () => {
    process.env.NODE_ENV = 'production';
    const { req, res, next } = createMocks();
    const err = new PrismaClientKnownRequestError('Transaction already closed', {
      code: 'P2028', clientVersion: '5.22.0', meta: { error: 'Transaction already closed' },
    });
    errorHandler(err as unknown as AppError, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Error interno del servidor', code: undefined,
    }));
  });

  it('returns 413 with a safe message when an upload exceeds its limit', () => {
    const { req, res, next } = createMocks();
    const err = new MulterError('LIMIT_FILE_SIZE');

    errorHandler(err as unknown as AppError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      status: 413,
      message: 'El archivo supera el tamaño máximo permitido',
    }));
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
