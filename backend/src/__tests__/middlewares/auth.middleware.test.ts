import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../../middlewares/errorHandler';

// Mock logger
vi.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Mock config — must be before importing the middleware
vi.mock('../../config/config', () => ({
  config: {
    JWT_SECRET: 'test-secret-key',
    NODE_ENV: 'test',
  },
}));

// Mock prisma
const mockFindUnique = vi.fn();
const mockRefreshFindFirst = vi.fn();
vi.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    usuario: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    refreshToken: {
      findFirst: (...args: unknown[]) => mockRefreshFindFirst(...args),
    },
  },
}));

import { isAuthenticated, hasRole, requireFullAccess, canAuditorAccessRequest, AuthRequest } from '../../middlewares/auth.middleware';

function createMocks(authHeader?: string, method = 'GET', originalUrl = '/api/manifiestos') {
  const req = {
    method,
    originalUrl,
    headers: {
      authorization: authHeader,
    },
    user: undefined,
  } as unknown as AuthRequest;
  const res = {} as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

const TEST_SECRET = 'test-secret-key';

function createToken(payload: object): string {
  return jwt.sign(payload, TEST_SECRET);
}

describe('isAuthenticated middleware', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockRefreshFindFirst.mockReset();
    mockRefreshFindFirst.mockResolvedValue(null);
  });

  it('calls next with 401 error when no authorization header', async () => {
    const { req, res, next } = createMocks();

    await isAuthenticated(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Token no proporcionado'),
        statusCode: 401,
      })
    );
  });

  it('calls next with 401 error when header does not start with Bearer', async () => {
    const { req, res, next } = createMocks('Basic abc123');

    await isAuthenticated(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
      })
    );
  });

  it('calls next with 401 error for invalid token', async () => {
    const { req, res, next } = createMocks('Bearer invalid.token.here');

    await isAuthenticated(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Token inválido'),
        statusCode: 401,
      })
    );
  });

  it('calls next with 401 error when user not found in DB', async () => {
    const token = createToken({ id: 'user-123' });
    mockFindUnique.mockResolvedValue(null);
    const { req, res, next } = createMocks(`Bearer ${token}`);

    await isAuthenticated(req, res, next);

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-123' },
      })
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Usuario no autorizado',
        statusCode: 401,
      })
    );
  });

  it('calls next with 401 when user is inactive and token is not restricted', async () => {
    const token = createToken({ id: 'user-123' });
    mockFindUnique.mockResolvedValue({
      id: 'user-123',
      email: 'test@test.com',
      nombre: 'Test',
      rol: 'GENERADOR',
      activo: false,
      esInspector: false,
      generador: null,
      transportista: null,
      operador: null,
    });
    const { req, res, next } = createMocks(`Bearer ${token}`);

    await isAuthenticated(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('inactivo'),
        statusCode: 401,
      })
    );
  });

  it('sets req.user and calls next() on valid token with active user', async () => {
    const token = createToken({ id: 'user-123' });
    const dbUser = {
      id: 'user-123',
      email: 'admin@test.com',
      nombre: 'Admin',
      rol: 'ADMIN',
      activo: true,
      esInspector: false,
      generador: null,
      transportista: null,
      operador: null,
    };
    mockFindUnique.mockResolvedValue(dbUser);
    const { req, res, next } = createMocks(`Bearer ${token}`);

    await isAuthenticated(req, res, next);

    expect(next).toHaveBeenCalledWith(); // no error argument
    expect(req.user).toEqual(expect.objectContaining({
      id: 'user-123',
      email: 'admin@test.com',
      rol: 'ADMIN',
      restricted: false,
    }));
  });

  it('allows inactive user with restricted token', async () => {
    const token = createToken({ id: 'user-456', restricted: true });
    const dbUser = {
      id: 'user-456',
      email: 'candidate@test.com',
      nombre: 'Candidate',
      rol: 'GENERADOR',
      activo: false,
      esInspector: false,
      generador: null,
      transportista: null,
      operador: null,
    };
    mockFindUnique.mockResolvedValue(dbUser);
    const { req, res, next } = createMocks(`Bearer ${token}`);

    await isAuthenticated(req, res, next);

    expect(next).toHaveBeenCalledWith(); // no error
    expect(req.user).toEqual(expect.objectContaining({
      id: 'user-456',
      restricted: true,
    }));
  });

  it('blocks AUDITOR mutations at the authentication boundary', async () => {
    const token = createToken({ id: 'auditor-1' });
    mockFindUnique.mockResolvedValue({
      id: 'auditor-1', email: 'auditor@test.com', nombre: 'Auditor', rol: 'AUDITOR',
      activo: true, esInspector: false, generador: null, transportista: null, operador: null,
    });
    const { req, res, next } = createMocks(`Bearer ${token}`, 'POST', '/api/manifiestos');

    await isAuthenticated(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 403,
      message: expect.stringContaining('solo lectura'),
    }));
  });

  it('preserves legitimate ADMIN mutations', async () => {
    const token = createToken({ id: 'admin-1' });
    mockFindUnique.mockResolvedValue({
      id: 'admin-1', email: 'admin@test.com', nombre: 'Admin', rol: 'ADMIN',
      activo: true, esInspector: false, generador: null, transportista: null, operador: null,
    });
    const { req, res, next } = createMocks(`Bearer ${token}`, 'POST', '/api/admin/usuarios');

    await isAuthenticated(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('AUDITOR read-only request policy', () => {
  it('allows safe reads and account-security actions only', () => {
    expect(canAuditorAccessRequest('GET', '/api/reportes/manifiestos')).toBe(true);
    expect(canAuditorAccessRequest('POST', '/api/auth/logout')).toBe(true);
    expect(canAuditorAccessRequest('POST', '/api/auth/change-password')).toBe(true);
    expect(canAuditorAccessRequest('POST', '/api/admin/usuarios')).toBe(false);
    expect(canAuditorAccessRequest('PUT', '/api/alertas/id/resolver')).toBe(false);
    expect(canAuditorAccessRequest('DELETE', '/api/manifiestos/id')).toBe(false);
  });
});

describe('hasRole middleware', () => {
  it('calls next with 401 if req.user is not set', () => {
    const middleware = hasRole('ADMIN');
    const { req, res, next } = createMocks();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'No autorizado',
        statusCode: 401,
      })
    );
  });

  it('calls next with 403 if user role does not match', () => {
    const middleware = hasRole('ADMIN');
    const { req, res, next } = createMocks();
    req.user = { id: '1', rol: 'GENERADOR' };

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('permisos'),
        statusCode: 403,
      })
    );
  });

  it('calls next() without error when role matches', () => {
    const middleware = hasRole('ADMIN', 'OPERADOR');
    const { req, res, next } = createMocks();
    req.user = { id: '1', rol: 'OPERADOR' };

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(); // no error
  });

  it('accepts multiple roles', () => {
    const middleware = hasRole('ADMIN', 'TRANSPORTISTA', 'GENERADOR');
    const { req, res, next } = createMocks();
    req.user = { id: '1', rol: 'TRANSPORTISTA' };

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(); // no error
  });
});

describe('requireFullAccess middleware', () => {
  it('requires a password change before protected routes', () => {
    const { req, res, next } = createMocks();
    req.user = { id: '1', rol: 'GENERADOR', forcePasswordChange: true, restricted: false };

    requireFullAccess(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, message: expect.stringContaining('cambiar tu contraseña') }));
  });

  it('allows normal users through', () => {
    const { req, res, next } = createMocks();
    req.user = { id: '1', rol: 'GENERADOR', forcePasswordChange: false, restricted: false };

    requireFullAccess(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
