import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ actor: vi.fn(), save: vi.fn(), audit: vi.fn(), transaction: vi.fn(), exists: vi.fn(), read: vi.fn(), unlink: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  generador: { findUnique: mock.actor }, operador: { findUnique: mock.actor }, transportista: { findUnique: mock.actor }, $transaction: mock.transaction,
} }));
vi.mock('../../utils/logger', () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('fs', async original => {
  const actual = await original<typeof import('fs')>();
  return { ...actual, default: { ...actual, existsSync: mock.exists, readFileSync: mock.read, unlinkSync: mock.unlink } };
});
import { uploadDocumento } from '../../controllers/documento.controller';

describe('original CAA publication belongs to DGFA and retains its actor and year', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.actor.mockResolvedValue({ id: 'actor' }); mock.exists.mockReturnValue(true); mock.read.mockReturnValue(Buffer.from('%PDF-1.4\nOriginal bytes'));
    mock.save.mockImplementation(async ({ data }) => ({ ...data, id: 'certificate' })); mock.audit.mockResolvedValue({ id: 'audit' });
    mock.transaction.mockImplementation(callback => callback({ documento: { create: mock.save }, auditoria: { create: mock.audit } }));
  });
  for (const [kind, route] of [['GENERADOR', 'generadores'], ['OPERADOR', 'operadores'], ['TRANSPORTISTA', 'transportistas']] as const) {
    const invoke = async (rol: string, year: string | undefined = '2026', mimeType = 'application/pdf') => {
      const req = { originalUrl: `/api/actores/${route}/actor/documentos`, params: { id: 'actor' }, user: { id: 'staff', rol, restricted: false }, headers: {},
        body: { tipo: 'CERTIFICADO_AMBIENTAL', anio: year }, file: { path: '/virtual/caa.pdf', originalname: 'original.pdf', mimetype: mimeType, size: 99 } };
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }, next = vi.fn();
      await uploadDocumento(req as never, res as never, next); return { res, next };
    };
    it(`${kind}: publishes the exact file reference and audit under its own administrative sector`, async () => {
      const { next } = await invoke(`ADMIN_${kind}`); expect(next).not.toHaveBeenCalled();
      expect(mock.save).toHaveBeenCalledWith({ data: expect.objectContaining({ [kind.toLowerCase() + 'Id']: 'actor', nombre: 'original.pdf', path: '/virtual/caa.pdf', anio: 2026, estado: 'APROBADO', subidoPor: 'staff', revisadoPor: 'staff' }) });
      expect(mock.audit).toHaveBeenCalled(); expect(mock.unlink).not.toHaveBeenCalled();
    });
    it(`${kind}: rejects actor self-publication and deletes only the rejected temporary upload`, async () => {
      const { next } = await invoke(kind); expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
      expect(mock.save).not.toHaveBeenCalled(); expect(mock.unlink).toHaveBeenCalledWith('/virtual/caa.pdf');
    });
    it(`${kind}: rejects a missing year or non-PDF without publishing`, async () => {
      expect((await invoke('ADMIN', '')).next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
      expect((await invoke('ADMIN', '2026', 'image/png')).next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
      expect(mock.save).not.toHaveBeenCalled();
    });
  }
});
