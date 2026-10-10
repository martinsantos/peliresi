import { beforeEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
const mock = vi.hoisted(() => ({ describe: vi.fn(), read: vi.fn(), unlink: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../services/documentAnalysis.service', () => ({ describeDocument: mock.describe, readReceipt: mock.read }));
vi.mock('node:fs/promises', () => ({ unlink: mock.unlink }));
import { previewDocument } from '../../controllers/documentPreview.controller';
const file = { path: path.join(os.tmpdir(), 'sitrep-preview-unit'), mimetype: 'image/png' };
beforeEach(() => { vi.clearAllMocks(); mock.describe.mockReturnValue({ mimeType: 'image/png' }); mock.read.mockResolvedValue({ version: 1, lectura: 'LEIDO', motor: 'TESSERACT', texto: 'DNI: 90000000\nVENCIMIENTO: 31/12/2027', duplicado: false, alcance: 'Imagen.', aviso: null }); });
async function read(tipo = 'LICENCIA', provided: object | undefined = file) {
  const res = { setHeader: vi.fn(), json: vi.fn() }, next = vi.fn();
  await previewDocument({ body: { tipo }, file: provided } as never, res as never, next);
  return { res, error: next.mock.calls[0]?.[0] };
}
describe('bounded document reading is stateless and cleans only its own temporary file', () => {
  it('returns explicit non-persistence and proposals, without granting validity', async () => {
    const result = await read(); expect(result.error).toBeUndefined();
    expect(result.res.json.mock.calls[0][0].data).toMatchObject({ persistido: false, campos: { dni: '90000000', vencimiento: '2027-12-31' } });
    expect(result.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store'); expect(mock.unlink).toHaveBeenCalledWith(file.path);
    expect(result.res.json.mock.calls[0][0].data).not.toHaveProperty('solicitudId');
  });
  it('keeps a missing engine or unreadable file explicit, with manual completion available', async () => {
    mock.read.mockResolvedValue({ lectura: 'NO_DISPONIBLE', texto: '', version: 1 });
    const result = await read(); expect(result.res.json.mock.calls[0][0].data).toMatchObject({ persistido: false, campos: {}, analisis: { lectura: 'NO_DISPONIBLE' } });
    expect(result.res.json.mock.calls[0][0].data.analisis.aviso).toContain('manualmente'); expect(mock.unlink).toHaveBeenCalledOnce();
  });
  it('rejects type or content errors before OCR and still removes the uploaded temporary file', async () => {
    expect((await read('unsupported')).error).toMatchObject({ statusCode: 400 }); expect(mock.read).not.toHaveBeenCalled();
    mock.describe.mockImplementation(() => { throw new Error('QA invalid magic bytes'); });
    expect((await read()).error).toBeInstanceOf(Error); expect(mock.unlink).toHaveBeenCalledTimes(2);
  });
  it('never deletes a path outside its generated upload prefix', async () => {
    await read('LICENCIA', { ...file, path: '/somewhere/real-document.png' }); expect(mock.unlink).not.toHaveBeenCalled();
  });
});
