import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthRequest } from '../../middlewares/auth.middleware';

const mock = vi.hoisted(() => ({
  find: vi.fn(), list: vi.fn(), update: vi.fn(), remove: vi.fn(),
  exists: vi.fn(), stream: vi.fn(), pipe: vi.fn(), unlink: vi.fn(),
}));
vi.mock('../../lib/prisma', () => ({
  default: { documento: { findUnique: mock.find, findMany: mock.list, update: mock.update, delete: mock.remove } },
}));
vi.mock('../../config/config', () => ({
  config: { JWT_SECRET: 'unit-only-no-provider', NODE_ENV: 'test' },
}));
vi.mock('../../utils/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('fs', async original => {
  const actual = await original<typeof import('fs')>();
  return { ...actual, default: { ...actual, existsSync: mock.exists, createReadStream: mock.stream, unlinkSync: mock.unlink } };
});

import { requireFullAccess } from '../../middlewares/auth.middleware';
import { downloadDocumento, getDocumentos, revisarDocumento, deleteDocumento } from '../../controllers/documento.controller';

const stored = { id: 'virtual-doc', generadorId: 'gen-1', operadorId: null,
  nombre: 'virtual.pdf', path: '/unit-virtual/no-real-file.pdf', mimeType: 'application/pdf' };
const owner = { id: 'owner', rol: 'GENERADOR', restricted: false, generador: { id: 'gen-1' } };
const foreign = { ...owner, generador: { id: 'gen-2' } };
async function invoke(handler: typeof downloadDocumento, user: Record<string, unknown>, operator = false) {
  const req = { params: { docId: stored.id, id: operator ? 'op-1' : 'gen-1' }, user,
    originalUrl: `/api/actores/${operator ? 'operadores' : 'generadores'}/actor/documentos`,
    body: { estado: 'APROBADO' } } as unknown as AuthRequest;
  const res = { setHeader: vi.fn(), json: vi.fn() } as unknown as Response;
  const gate = vi.fn(), next = vi.fn();
  requireFullAccess(req, res, gate);
  const gateError = gate.mock.calls[0]?.[0];
  if (!gateError) await handler(req, res, next);
  return { res, error: gateError || next.mock.calls[0]?.[0] };
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.find.mockResolvedValue(stored); mock.list.mockResolvedValue([stored]);
  mock.update.mockResolvedValue(stored); mock.remove.mockResolvedValue(stored);
  mock.exists.mockReturnValue(true); mock.stream.mockReturnValue({ pipe: mock.pipe });
});
describe('actor documents: ownership and sector boundaries before side effects', () => {
  it('keeps the owner download available', async () => {
    const result = await invoke(downloadDocumento, owner);
    expect(result.error).toBeUndefined(); expect(mock.pipe).toHaveBeenCalledWith(result.res);
  });
  it.each([foreign, { id: 'unlinked', rol: 'GENERADOR' }, { id: 'operator', rol: 'OPERADOR', operador: { id: 'op-1' } }])
    ('rejects foreign/unlinked reads before filesystem access: $rol', async user => {
      const result = await invoke(downloadDocumento, user);
      expect(result.error).toMatchObject({ statusCode: 403 });
      expect(mock.exists).not.toHaveBeenCalled(); expect(mock.stream).not.toHaveBeenCalled();
    });
  it('rejects metadata disclosure to another generator before querying documents', async () => {
    const result = await invoke(getDocumentos, foreign);
    expect(result.error).toMatchObject({ statusCode: 403 }); expect(mock.list).not.toHaveBeenCalled();
  });
  it.each(['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'])
    ('preserves cross-sector read-only access for %s', async rol => {
      const user = { id: 'admin', rol };
      expect((await invoke(downloadDocumento, user)).error).toBeUndefined();
      expect((await invoke(getDocumentos, user)).error).toBeUndefined();
    });
  it('preserves inspector reading without granting document moderation', async () => {
    const user = { ...foreign, esInspector: true };
    expect((await invoke(downloadDocumento, user)).error).toBeUndefined();
    expect((await invoke(revisarDocumento, user)).error).toMatchObject({ statusCode: 403 });
    expect(mock.update).not.toHaveBeenCalled();
  });
  it.each([revisarDocumento, deleteDocumento])('blocks generator-sector moderation of an operator document', async handler => {
    mock.find.mockResolvedValue({ ...stored, generadorId: null, operadorId: 'op-1' });
    const result = await invoke(handler, { id: 'gen-admin', rol: 'ADMIN_GENERADOR' }, true);
    expect(result.error).toMatchObject({ statusCode: 403 });
    expect(mock.update).not.toHaveBeenCalled(); expect(mock.remove).not.toHaveBeenCalled(); expect(mock.unlink).not.toHaveBeenCalled();
  });
  it.each([revisarDocumento, deleteDocumento])('preserves operator-sector moderation of its sector', async handler => {
    mock.find.mockResolvedValue({ ...stored, generadorId: null, operadorId: 'op-1' });
    expect((await invoke(handler, { id: 'op-admin', rol: 'ADMIN_OPERADOR' }, true)).error).toBeUndefined();
  });
  it('never upgrades a restricted admin into a document reader', async () => {
    expect((await invoke(downloadDocumento, { id: 'restricted', rol: 'ADMIN', restricted: true })).error).toMatchObject({ statusCode: 403 });
    expect(mock.find).not.toHaveBeenCalled(); expect(mock.stream).not.toHaveBeenCalled();
  });
  it('returns not found without reading the filesystem for a missing document', async () => {
    mock.find.mockResolvedValue(null);
    expect((await invoke(downloadDocumento, owner)).error).toMatchObject({ statusCode: 404 });
    expect(mock.exists).not.toHaveBeenCalled();
  });
  it.each([{ generadorId: null, operadorId: null }, { generadorId: 'gen-1', operadorId: 'op-1' }])
    ('rejects missing or ambiguous document ownership before reads or moderation: %j', async parents => {
      mock.find.mockResolvedValue({ ...stored, ...parents });
      for (const handler of [downloadDocumento, revisarDocumento, deleteDocumento]) {
        expect((await invoke(handler, { id: 'admin', rol: 'ADMIN' })).error).toMatchObject({ statusCode: 403 });
      }
      expect(mock.exists).not.toHaveBeenCalled(); expect(mock.stream).not.toHaveBeenCalled();
      expect(mock.update).not.toHaveBeenCalled(); expect(mock.remove).not.toHaveBeenCalled(); expect(mock.unlink).not.toHaveBeenCalled();
    });
});
