import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  request: vi.fn(), binary: vi.fn(), document: vi.fn(), update: vi.fn(), storage: vi.fn(),
}));
vi.mock('../../lib/prisma', () => ({ default: {
  solicitudInscripcion: { findUnique: mocks.request }, archivoBinario: { findUnique: mocks.binary },
  documentoSolicitud: { findUnique: mocks.document, update: mocks.update },
} }));
vi.mock('../../services/documentStorage.service', () => ({ persistDocumentFile: mocks.storage, storageKeyPath: vi.fn() }));
vi.mock('../../utils/ocr', () => ({ recognizeDocument: vi.fn() }));
import { uploadSolicitudDocument, confirmDocumentOcr } from '../../controllers/document-management.controller';

function response() { return { status: vi.fn().mockReturnThis(), json: vi.fn() }; }
function request(body: Record<string, unknown> = {}) {
  return { params: { id: 'draft' }, body: { tipo: 'LICENCIA_CONDUCIR', cara: 'FRENTE', ...body }, user: { id: 'owner', rol: 'GENERADOR' }, file: { buffer: Buffer.from('qa file'), originalname: 'qa.png' } } as any;
}
describe('request document identity and review integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.request.mockResolvedValue({ usuarioId: 'owner', tipoActor: 'GENERADOR', estado: 'BORRADOR' });
  });
  it('retries the exact same request, type and face idempotently', async () => {
    mocks.binary.mockResolvedValue({ documentosSolicitud: [{ solicitudId: 'draft', tipo: 'LICENCIA_CONDUCIR', cara: 'FRENTE' }] });
    const res = response(); const next = vi.fn();
    await uploadSolicitudDocument(request(), res as any, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
  });
  it.each([
    { solicitudId: 'other', tipo: 'LICENCIA_CONDUCIR', cara: 'FRENTE' },
    { solicitudId: 'draft', tipo: 'OTRO', cara: 'FRENTE' },
    { solicitudId: 'draft', tipo: 'LICENCIA_CONDUCIR', cara: 'DORSO' },
  ])('does not silently reuse a different logical document %j', async saved => {
    mocks.binary.mockResolvedValue({ documentosSolicitud: [saved] });
    const next = vi.fn();
    await uploadSolicitudDocument(request(), response() as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409, message: 'DOCUMENTO_YA_REGISTRADO' }));
    expect(mocks.storage).not.toHaveBeenCalled();
  });
  it('does not modify evidence belonging to an already approved request', async () => {
    mocks.document.mockResolvedValue({ id: 'doc', solicitudId: 'draft' });
    mocks.request.mockResolvedValue({ usuarioId: 'owner', tipoActor: 'GENERADOR', estado: 'APROBADA' });
    const next = vi.fn();
    await confirmDocumentOcr(request(), response() as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('date corrections invalidate a previous approval', async () => {
    mocks.document.mockResolvedValue({ id: 'doc', solicitudId: 'draft', estado: 'APROBADO', vigenteDesde: new Date('2026-01-01'), vigenteHasta: new Date('2027-01-01') });
    await confirmDocumentOcr(request({ vigenteHasta: '2028-01-01' }), response() as any, vi.fn());
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'PENDIENTE', revisadoPor: null, revisadoAt: null }) }));
  });
});
