import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  find: vi.fn(), listDocs: vi.fn(), saveDoc: vi.fn(), removeDocs: vi.fn(), update: vi.fn(),
  transaction: vi.fn(), query: vi.fn(), notices: vi.fn(), read: vi.fn(), exists: vi.fn(), unlink: vi.fn(),
  findDoc: vi.fn(), deleteDoc: vi.fn(),
}));
vi.mock('../../lib/prisma', () => ({ default: {
  solicitudInscripcion: { findUnique: mock.find, update: mock.update },
  documentoSolicitud: { findMany: mock.listDocs, findFirst: vi.fn(), findUnique: mock.findDoc, delete: mock.deleteDoc, create: mock.saveDoc },
  usuario: { findMany: vi.fn().mockResolvedValue([]) }, notificacion: { create: mock.notices },
  $transaction: mock.transaction,
} }));
vi.mock('../../utils/logger', () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('../../services/email.service', () => ({ emailService: { sendEmailVerification: vi.fn() } }));
vi.mock('../../controllers/auth.controller', () => ({ generateTokens: vi.fn() }));
vi.mock('fs', async original => {
  const actual = await original<typeof import('fs')>();
  return { ...actual, default: { ...actual, existsSync: mock.exists, mkdirSync: vi.fn(),
    readFileSync: mock.read, unlinkSync: mock.unlink } };
});

import { uploadDocumento, updateSolicitud, deleteDocumento } from '../../controllers/solicitud.controller';

const pdf = Buffer.from('%PDF-1.4\nQA document, not an official certificate\n%%EOF');
const draft = { id: 'draft', usuarioId: 'owner', tipoActor: 'GENERADOR', estado: 'BORRADOR', updatedAt: new Date('2026-10-09T10:00:00.000Z') };
async function call(handler: typeof uploadDocumento, body: object, mime = 'application/pdf') {
  const req = { params: { id: 'draft', docId: 'doc' }, user: { id: 'owner', rol: 'GENERADOR', restricted: true }, body,
    file: { originalname: 'QA.pdf', path: '/unit-virtual/QA.pdf', mimetype: mime, size: pdf.length } };
  const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }, next = vi.fn();
  await handler(req as never, res as never, next);
  return { res, error: next.mock.calls[0]?.[0] };
}

beforeEach(() => {
  vi.clearAllMocks(); mock.find.mockResolvedValue(draft); mock.listDocs.mockResolvedValue([]);
  mock.exists.mockReturnValue(true); mock.read.mockReturnValue(pdf);
  mock.saveDoc.mockImplementation(async ({ data }) => ({ id: 'doc', ...data }));
  mock.update.mockImplementation(async ({ data }) => ({ ...draft, ...data }));
  mock.query.mockResolvedValue([]);
  mock.findDoc.mockResolvedValue({ id: 'doc', solicitudId: 'draft', path: '/unit-virtual/original.pdf' });
  mock.deleteDoc.mockResolvedValue({ id: 'doc', solicitudId: 'draft', path: '/unit-virtual/original.pdf' });
  mock.transaction.mockImplementation(callback => callback({
    $queryRaw: mock.query, solicitudInscripcion: { findUnique: mock.find, update: mock.update },
    documentoSolicitud: { findMany: mock.listDocs, findFirst: vi.fn().mockResolvedValue(null), findUnique: mock.findDoc, delete: mock.deleteDoc, deleteMany: mock.removeDocs, create: mock.saveDoc },
    documento: { findFirst: vi.fn().mockResolvedValue(null) },
    huellaRecibo: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
    usuario: { findMany: vi.fn().mockResolvedValue([]) }, notificacion: { create: mock.notices },
  }));
});

describe('registration documents preserve genuine bytes and safe data', () => {
  it('does not destroy the original attachment when its database deletion fails', async () => {
    mock.deleteDoc.mockRejectedValue(new Error('Database unavailable'));
    expect((await call(deleteDocumento, {})).error).toBeDefined();
    expect(mock.unlink).not.toHaveBeenCalled();
  });
  it('rechecks the submitted state under lock before deleting a document', async () => {
    mock.find.mockResolvedValueOnce(draft).mockResolvedValue({ ...draft, estado: 'ENVIADA' });
    expect((await call(deleteDocumento, {})).error).toMatchObject({ statusCode: 409 });
    expect(mock.deleteDoc).not.toHaveBeenCalled(); expect(mock.unlink).not.toHaveBeenCalled();
  });
  it('records the digest of the bytes stored, independently of filename', async () => {
    expect((await call(uploadDocumento, { tipo: 'CONSTANCIA_AFIP' })).error).toBeUndefined();
    expect(mock.saveDoc).toHaveBeenCalledWith({ data: expect.objectContaining({ sha256: createHash('sha256').update(pdf).digest('hex') }) });
  });
  it('rejects an image MIME that contains PDF bytes before replacement', async () => {
    expect((await call(uploadDocumento, { tipo: 'CONSTANCIA_AFIP' }, 'image/png')).error).toMatchObject({ statusCode: 400 });
    expect(mock.saveDoc).not.toHaveBeenCalled(); expect(mock.removeDocs).not.toHaveBeenCalled();
  });
  it('does not delete stored documents when the new upload is empty', async () => {
    mock.read.mockReturnValue(Buffer.alloc(0));
    expect((await call(uploadDocumento, { tipo: 'CONSTANCIA_AFIP' })).error).toMatchObject({ statusCode: 400 });
    expect(mock.removeDocs).not.toHaveBeenCalled();
  });
  it('permits a receipt as optional documentation without approving payment', async () => {
    expect((await call(uploadDocumento, { tipo: 'COMPROBANTE_PAGO' })).error).toBeUndefined();
    expect(mock.saveDoc).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: 'COMPROBANTE_PAGO', estado: 'PENDIENTE' }) });
  });
  it.each([null, [], 42, '{broken'])('rejects malformed actor data: %j without persisting it', async datosActor => {
    expect((await call(updateSolicitud, { datosActor })).error).toMatchObject({ statusCode: 400 });
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('keeps a forbidden upload from replacing the owner document', async () => {
    mock.find.mockResolvedValue({ ...draft, usuarioId: 'another' });
    expect((await call(uploadDocumento, { tipo: 'CONSTANCIA_AFIP' })).error).toMatchObject({ statusCode: 403 });
    expect(mock.removeDocs).not.toHaveBeenCalled(); expect(mock.saveDoc).not.toHaveBeenCalled();
  });
  it('does not overwrite a draft saved by another editor since the caller version', async () => {
    mock.find.mockResolvedValue({ ...draft, updatedAt: new Date('2026-10-09T10:30:00.000Z') });
    expect((await call(updateSolicitud, { datosActor: { razonSocial: 'QA late editor' }, expectedUpdatedAt: '2026-10-09T10:29:00.000Z' })).error).toMatchObject({ statusCode: 409 });
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('saves a matching draft revision and preserves incomplete fields without submitting', async () => {
    mock.find.mockResolvedValue({ ...draft, updatedAt: new Date('2026-10-09T10:30:00.000Z') });
    expect((await call(updateSolicitud, { datosActor: { razonSocial: '', domicilio: '' }, expectedUpdatedAt: '2026-10-09T10:30:00.000Z' })).error).toBeUndefined();
    expect(mock.update).toHaveBeenCalledWith({ where: { id: 'draft' }, data: expect.objectContaining({ datosActor: '{"razonSocial":"","domicilio":""}' }) });
    expect(mock.notices).not.toHaveBeenCalled();
  });
});
