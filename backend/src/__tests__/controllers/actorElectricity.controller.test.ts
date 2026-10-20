import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ actor: vi.fn(), save: vi.fn(), audit: vi.fn(), read: vi.fn(), digest: vi.fn(), duplicate: vi.fn(), notice: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  generador: { findUnique: mock.actor }, operador: { findUnique: mock.actor }, transportista: { findUnique: mock.actor },
  $transaction: (callback: (tx: unknown) => unknown) => callback({ documento: { create: mock.save } }),
} }));
vi.mock('../../utils/auditoria', () => ({ auditarActor: mock.audit }));
vi.mock('../../services/documentAnalysis.service', () => ({
  describeDocument: () => ({ sha256: 'a'.repeat(64), size: 100, mimeType: 'application/pdf' }),
  readReceipt: mock.read, retainReceiptDigest: mock.digest, receiptDuplicate: mock.duplicate, receiptNotice: mock.notice,
}));
vi.mock('../../utils/logger', () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
import { uploadDocumento } from '../../controllers/documento.controller';

beforeEach(() => {
  vi.clearAllMocks(); mock.actor.mockResolvedValue({ id: 'artificial-actor', usuarioId: 'owner' });
  mock.save.mockImplementation(async ({ data }) => ({ ...data, id: 'electric-bill' }));
  mock.read.mockResolvedValue({ version: 1, lectura: 'LEIDO', motor: 'PDF_TEXT', texto: 'EDEMSA\nTarifa: T2 R BT\nConsumo facturado: 1250 kWh\nPotencia contratada: 45 kW', duplicado: false });
});
it.each([['FACTURA_LUZ', 'generadores', 'generadorId'], ['FACTURA_ELECTRICA', 'generadores', 'generadorId'], ['FACTURA_ELECTRICA', 'operadores', 'operadorId']])
  ('reads %s for %s without changing its original type or treating it as a payment', async (tipo, route, ownerKey) => {
    const req = { originalUrl: `/api/actores/${route}/artificial-actor/documentos`, params: { id: 'artificial-actor' }, user: { id: 'reviewer', rol: 'ADMIN' }, headers: {},
      body: { tipo, anio: '2026' }, file: { path: '/virtual/electric.pdf', originalname: 'Factura-QA.pdf', mimetype: 'application/pdf', size: 100 } };
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }, next = vi.fn();
    await uploadDocumento(req as never, res as never, next);
    expect(next).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(201);
    expect(mock.read).toHaveBeenCalledWith({ path: '/virtual/electric.pdf', mimeType: 'application/pdf' }, 'FACTURA_ELECTRICA');
    expect(mock.save).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo, [ownerKey]: 'artificial-actor',
      analisis: expect.objectContaining({ documentKind: 'FACTURA_ELECTRICA', electricidad: expect.objectContaining({ campos: { categoriaTarifaria: 'T2RBT', consumoKwh: '1250', potenciaContratadaKw: '45' } }) }) }) });
    expect(mock.audit).toHaveBeenCalledOnce(); expect(mock.digest).not.toHaveBeenCalled();
    expect(mock.duplicate).not.toHaveBeenCalled(); expect(mock.notice).not.toHaveBeenCalled();
  });
