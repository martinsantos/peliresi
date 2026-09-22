import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ save: vi.fn(), get: vi.fn(), remove: vi.fn() }));
vi.mock('../../services/indexeddb', () => ({
  saveOffline: mocks.save,
  getOffline: mocks.get,
  removeOffline: mocks.remove,
}));

import {
  loadOfflineExchangeDraft,
  removeOfflineExchangeDraft,
  saveOfflineExchangeDraft,
} from '../../services/inspectionOfflineExchange';

const draft = {
  tipo: 'DESCARGO' as const,
  asunto: 'Descargo documentado',
  cuerpo: 'Se acompaña la documentación solicitada.',
  respondeAId: 'exchange-1',
  plazoRespuestaAt: '',
};

describe('inspection exchange offline draft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preserves attachment blobs per user and inspection without enqueuing an automatic send', async () => {
    const file = new File(['%PDF-1.4'], 'constancia.pdf', { type: 'application/pdf', lastModified: 123 });
    await saveOfflineExchangeDraft('actor-1', 'inspection-1', draft, [file]);

    expect(mocks.save).toHaveBeenCalledWith('inspection_exchange_drafts', expect.objectContaining({
      id: 'actor-1:inspection-1',
      userId: 'actor-1',
      inspectionId: 'inspection-1',
      draft,
      files: [expect.objectContaining({ name: 'constancia.pdf', type: 'application/pdf', blob: expect.any(Blob) })],
    }));
    expect(mocks.save).not.toHaveBeenCalledWith('sync_queue', expect.anything());
  });

  it('restores files only for the same owning user and case', async () => {
    mocks.get.mockResolvedValue({
      id: 'actor-1:inspection-1', userId: 'actor-1', inspectionId: 'inspection-1', savedAt: '2026-09-22T12:00:00.000Z', draft,
      files: [{ name: 'constancia.pdf', type: 'application/pdf', lastModified: 123, blob: new Blob(['%PDF'], { type: 'application/pdf' }) }],
    });
    const restored = await loadOfflineExchangeDraft('actor-1', 'inspection-1');
    expect(restored?.draft).toEqual(draft);
    expect(restored?.files[0]).toBeInstanceOf(File);
    expect(restored?.files[0].name).toBe('constancia.pdf');

    mocks.get.mockResolvedValueOnce({ userId: 'actor-2', inspectionId: 'inspection-1', draft, files: [] });
    expect(await loadOfflineExchangeDraft('actor-1', 'inspection-1')).toBeNull();
  });

  it('removes the local draft only after the UI confirms a successful presentation', async () => {
    await removeOfflineExchangeDraft('actor-1', 'inspection-1');
    expect(mocks.remove).toHaveBeenCalledWith('inspection_exchange_drafts', 'actor-1:inspection-1');
  });
});
