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
import { inspectionContextKey } from '../../utils/inspectionWorkspace';

const owner = JSON.stringify(['actor-1', 'GENERADOR', 'actor-g1', 'company-1', 'grant-1', 2]);
const id = inspectionContextKey('actor-1', owner, 'inspection-1');

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
    await saveOfflineExchangeDraft('actor-1', 'inspection-1', owner, draft, [file]);

    expect(mocks.save).toHaveBeenCalledWith('inspection_exchange_drafts', expect.objectContaining({
      id, owner,
      userId: 'actor-1',
      inspectionId: 'inspection-1',
      draft,
      files: [expect.objectContaining({ name: 'constancia.pdf', type: 'application/pdf', blob: expect.any(Blob) })],
    }));
    expect(mocks.save).not.toHaveBeenCalledWith('sync_queue', expect.anything());
  });

  it('restores files only for the same owning user and case', async () => {
    mocks.get.mockResolvedValue({
      id, owner, userId: 'actor-1', inspectionId: 'inspection-1', savedAt: '2026-09-22T12:00:00.000Z', draft,
      files: [{ name: 'constancia.pdf', type: 'application/pdf', lastModified: 123, blob: new Blob(['%PDF'], { type: 'application/pdf' }) }],
    });
    const restored = await loadOfflineExchangeDraft('actor-1', 'inspection-1', owner);
    expect(restored?.draft).toEqual(draft);
    expect(restored?.files[0]).toBeInstanceOf(File);
    expect(restored?.files[0].name).toBe('constancia.pdf');

    mocks.get.mockResolvedValueOnce({ userId: 'actor-2', inspectionId: 'inspection-1', draft, files: [] });
    expect(await loadOfflineExchangeDraft('actor-1', 'inspection-1', owner)).toBeNull();
  });

  it('removes the local draft only after the UI confirms a successful presentation', async () => {
    await removeOfflineExchangeDraft('actor-1', 'inspection-1', owner);
    expect(mocks.remove).toHaveBeenCalledWith('inspection_exchange_drafts', id);
  });

  it.each(['other-role', 'other-company', 'other-authorization', 'other-revision', ''])('does not restore a draft for context %s', async other => {
    mocks.get.mockResolvedValue({ id, owner, userId: 'actor-1', inspectionId: 'inspection-1', draft, files: [] });
    expect(await loadOfflineExchangeDraft('actor-1', 'inspection-1', other)).toBeNull();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('preserves legacy records without assigning them to the current role', async () => {
    mocks.get.mockResolvedValue({ id: 'actor-1:inspection-1', userId: 'actor-1', inspectionId: 'inspection-1', draft, files: [] });
    expect(await loadOfflineExchangeDraft('actor-1', 'inspection-1', owner)).toBeNull();
    expect(mocks.get).toHaveBeenCalledWith('inspection_exchange_drafts', id);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('waits for the departing context write before restoring its attachments', async () => {
    let finish!: () => void;
    mocks.save.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const write = saveOfflineExchangeDraft('actor-1', 'inspection-1', owner, draft, []);
    const read = loadOfflineExchangeDraft('actor-1', 'inspection-1', owner);
    await Promise.resolve(); await Promise.resolve();
    expect(mocks.get).not.toHaveBeenCalled();
    finish(); await write; await read;
    expect(mocks.get).toHaveBeenCalledWith('inspection_exchange_drafts', id);
  });
});
