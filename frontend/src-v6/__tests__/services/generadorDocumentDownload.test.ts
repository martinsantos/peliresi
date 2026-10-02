import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generadorFiscalService } from '../../services/generador-fiscal.service';

const mock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { get: mock.get } }));

describe('authenticated generator document download', () => {
  let clicked: { href: string; filename: string; connected: boolean } | undefined;
  beforeEach(() => {
    mock.get.mockReset(); clicked = undefined;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:qa-document');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked = { href: this.href, filename: this.download, connected: this.isConnected };
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('requests actual bytes through the session API, downloads by original name and releases the blob', async () => {
    const bytes = new Blob(['%PDF-1.4 QA'], { type: 'application/pdf' });
    mock.get.mockResolvedValue({ data: bytes });
    await generadorFiscalService.downloadDocumento('doc /1', 'Declaración.pdf');
    expect(mock.get).toHaveBeenCalledWith('/actores/documentos/doc%20%2F1/download', { responseType: 'blob' });
    expect(URL.createObjectURL).toHaveBeenCalledWith(bytes);
    expect(clicked).toEqual({ href: 'blob:qa-document', filename: 'Declaración.pdf', connected: true });
    expect(document.querySelector('a[download]')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:qa-document');
  });

  it('does not fabricate a download when authentication or transport fails', async () => {
    const error = new Error('401 or offline');
    mock.get.mockRejectedValue(error);
    await expect(generadorFiscalService.downloadDocumento('doc-1', 'QA.pdf')).rejects.toBe(error);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(clicked).toBeUndefined();
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('cleans up the anchor and URL even if initiating the download fails', async () => {
    mock.get.mockResolvedValue({ data: new Blob(['QA']) });
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(() => { throw new Error('download blocked'); });
    await expect(generadorFiscalService.downloadDocumento('doc-1', 'QA.pdf')).rejects.toThrow('download blocked');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:qa-document');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
