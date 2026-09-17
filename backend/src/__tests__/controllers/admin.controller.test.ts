import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

const {
  mockFindUnique,
  mockAuditCreate,
  mockGenerateTokens,
  mockStoreRefreshToken,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockAuditCreate: vi.fn(),
  mockGenerateTokens: vi.fn(),
  mockStoreRefreshToken: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    usuario: { findUnique: mockFindUnique },
    auditoria: { create: mockAuditCreate },
  },
}));

vi.mock('../../controllers/auth.controller', () => ({
  generateTokens: mockGenerateTokens,
  storeRefreshToken: mockStoreRefreshToken,
}));

vi.mock('../../jobs/vencimiento.job', () => ({ verificarVencimientos: vi.fn() }));
vi.mock('../../services/email.service', () => ({ emailService: {} }));
vi.mock('../../utils/dateRange', () => ({ parseDateRange: vi.fn() }));

import { impersonateUsuario } from '../../controllers/admin.controller';

function createResponse() {
  return {
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    params: { userId: 'target-user' },
    headers: { 'user-agent': 'Vitest' },
    ip: '192.168.1.10',
    user: {
      id: 'root-admin',
      email: 'admin@dgfa.mendoza.gov.ar',
      nombre: 'Administrador DGFA',
      rol: 'ADMIN',
    },
    ...overrides,
  } as any;
}

function activeTarget(overrides: Record<string, unknown> = {}) {
  return {
    id: 'target-user',
    email: 'sectorial@dgfa.mendoza.gov.ar',
    rol: 'ADMIN_OPERADOR',
    nombre: 'Admin Operador',
    apellido: 'Demo',
    empresa: 'Planta Demo',
    activo: true,
    esDemo: true,
    generador: null,
    transportista: null,
    operador: { id: 'operador-1', razonSocial: 'Planta Demo' },
    ...overrides,
  };
}

describe('impersonateUsuario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateTokens.mockReturnValue({ accessToken: 'access-target', refreshToken: 'refresh-target' });
    mockStoreRefreshToken.mockResolvedValue(undefined);
    mockAuditCreate.mockResolvedValue({ id: 'audit-1' });
  });

  it('allows root ADMIN to impersonate any active role and persists the refresh token', async () => {
    mockFindUnique.mockResolvedValue(activeTarget());
    const res = createResponse();

    await impersonateUsuario(createRequest(), res, vi.fn());

    expect(mockGenerateTokens).toHaveBeenCalledWith('target-user');
    expect(mockStoreRefreshToken).toHaveBeenCalledWith('refresh-target', 'target-user');
    expect(mockAuditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        usuarioId: 'root-admin',
        accion: 'IMPERSONATION',
        modulo: 'AUTH',
      }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        user: expect.objectContaining({ id: 'target-user', rol: 'ADMIN_OPERADOR', esDemo: true }),
        tokens: { accessToken: 'access-target', refreshToken: 'refresh-target' },
        impersonatedBy: expect.objectContaining({ id: 'root-admin' }),
      }),
    }));
  });

  it('rejects non-root admins before loading the target', async () => {
    const next = vi.fn();
    const res = createResponse();

    await impersonateUsuario(createRequest({ user: { id: 'sub-admin', rol: 'ADMIN_OPERADOR' } }), res, next);

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('rejects inactive targets and self impersonation', async () => {
    const nextInactive = vi.fn();
    mockFindUnique.mockResolvedValue(activeTarget({ activo: false }));
    await impersonateUsuario(createRequest(), createResponse(), nextInactive);
    expect(nextInactive).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));

    const nextSelf = vi.fn();
    mockFindUnique.mockResolvedValue(activeTarget({ id: 'root-admin' }));
    await impersonateUsuario(createRequest(), createResponse(), nextSelf);
    expect(nextSelf).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });
});
