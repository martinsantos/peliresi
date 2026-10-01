import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({ usuario: { findMany: vi.fn(), count: vi.fn() } }));
vi.mock('../../lib/prisma', () => ({ default: db }));
vi.mock('../../jobs/vencimiento.job', () => ({ verificarVencimientos: vi.fn() }));
vi.mock('../../services/email.service', () => ({ emailService: {} }));
vi.mock('../../controllers/auth.controller', () => ({ generateTokens: vi.fn() }));
import { getUsuarios } from '../../controllers/admin.controller';

describe('admin user list: complete server-side filtering', () => {
  beforeEach(() => { vi.clearAllMocks(); db.usuario.findMany.mockResolvedValue([]); db.usuario.count.mockResolvedValue(23); });
  it('uses identical filters for the result and total, including grouped roles and pending activation', async () => {
    const json = vi.fn();
    const next = vi.fn();
    await getUsuarios({ query: { page: '2', limit: '10', roles: 'ADMIN_GENERADOR,ADMIN_OPERADOR', activo: 'false', emailVerified: 'true', search: 'María' } } as never, { json } as never, next);
    const request = db.usuario.findMany.mock.calls[0][0];
    expect(request.skip).toBe(10);
    expect(request.take).toBe(10);
    expect(request.where).toMatchObject({ rol: { in: ['ADMIN_GENERADOR', 'ADMIN_OPERADOR'] }, activo: false, emailVerified: true });
    expect(db.usuario.count).toHaveBeenCalledWith({ where: request.where });
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pagination: { page: 2, limit: 10, total: 23, pages: 3 } }) }));
    expect(next).not.toHaveBeenCalled();
  });
  it('rejects unknown roles without querying Prisma', async () => {
    const next = vi.fn();
    await getUsuarios({ query: { roles: 'ADMIN,NONSENSE' } } as never, { json: vi.fn() } as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(db.usuario.findMany).not.toHaveBeenCalled();
  });
  it('searches each name word across nombre and apellido instead of missing a full name', async () => {
    const next = vi.fn();
    await getUsuarios({ query: { search: '  María   Ardengo  ' } } as never, { json: vi.fn() } as never, next);
    const where = db.usuario.findMany.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0].OR).toContainEqual({ nombre: { contains: 'María', mode: 'insensitive' } });
    expect(where.AND[1].OR).toContainEqual({ apellido: { contains: 'Ardengo', mode: 'insensitive' } });
    expect(db.usuario.count).toHaveBeenCalledWith({ where });
    expect(next).not.toHaveBeenCalled();
  });
  it('rejects malformed verification filters without returning a different population', async () => {
    const next = vi.fn();
    await getUsuarios({ query: { emailVerified: 'maybe' } } as never, { json: vi.fn() } as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(db.usuario.findMany).not.toHaveBeenCalled();
  });
  it('treats a whitespace-only search as an empty search', async () => {
    await getUsuarios({ query: { search: '   ' } } as never, { json: vi.fn() } as never, vi.fn());
    expect(db.usuario.findMany.mock.calls[0][0].where).toEqual({});
  });
  it('rejects a non-text search before querying Prisma', async () => {
    const next = vi.fn();
    await getUsuarios({ query: { search: ['María', 'Ardengo'] } } as never, { json: vi.fn() } as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(db.usuario.findMany).not.toHaveBeenCalled();
  });
});
