import { beforeEach, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => ({ getAllOffline: vi.fn(), saveOffline: vi.fn(), removeOffline: vi.fn() }));
vi.mock('../../services/indexeddb', () => storage);
vi.mock('../../services/inspectionOfflineEvidence', () => ({ validateInspectionEvidence: vi.fn().mockResolvedValue('image/jpeg') }));
import { listSpontaneousFindings, newSpontaneousFinding, protectSpontaneousText, saveSpontaneousFinding, removeSpontaneousFinding } from '../../services/inspectionSpontaneousDraft';

describe('field finding interruption recovery', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); storage.getAllOffline.mockResolvedValue([]); storage.saveOffline.mockResolvedValue(undefined); });

  it('recovers the last keystroke before a pending IndexedDB save and isolates the inspector', async () => {
    const draft = { ...newSpontaneousFinding('inspector-1'), description: 'Envases abiertos junto al desagüe' };
    protectSpontaneousText(draft);
    expect(storage.saveOffline).not.toHaveBeenCalled();
    expect(await listSpontaneousFindings('inspector-1')).toMatchObject([{ id: draft.id, description: draft.description }]);
    expect(await listSpontaneousFindings('inspector-2')).toEqual([]);
  });

  it('merges the latest text journal with already protected photo bytes', async () => {
    const photo = { id: 'p-1', file: new Blob(['original photo']), fileName: 'campo.jpg', mimeType: 'image/jpeg', capturedAt: '', lastModified: 0 };
    const draft = { ...newSpontaneousFinding('one'), description: 'Inicial', photos: [photo], updatedAt: '2026-09-24T12:00:00.000Z' };
    storage.getAllOffline.mockResolvedValue([draft]);
    protectSpontaneousText({ ...draft, description: 'Se agregó el contexto final', updatedAt: '2026-09-24T12:00:01.000Z' });
    const [recovered] = await listSpontaneousFindings('one');
    expect(recovered.description).toBe('Se agregó el contexto final');
    expect(recovered.photos[0].file).toBe(photo.file);
  });

  it('does not erase newer typing when an earlier write finishes', async () => {
    let finish!: () => void;
    storage.saveOffline.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const first = { ...newSpontaneousFinding('one'), description: 'Primera nota' };
    protectSpontaneousText(first);
    const writing = saveSpontaneousFinding(first);
    protectSpontaneousText({ ...first, description: 'Última palabra', updatedAt: '2099-01-01T00:00:00.000Z' });
    finish();
    await writing;
    expect(await listSpontaneousFindings('one')).toMatchObject([{ description: 'Última palabra' }]);
  });

  it('does not resurrect cleared text or a removed photo after an interruption', async () => {
    const draft = { ...newSpontaneousFinding('one'), description: 'Borrar este texto', photos: [{ id: 'p', file: new Blob(['photo']), fileName: 'campo.jpg', mimeType: 'image/jpeg', lastModified: 0, capturedAt: '' }], updatedAt: '2026-09-24T12:00:00.000Z' };
    storage.getAllOffline.mockResolvedValue([draft]);
    protectSpontaneousText({ ...draft, description: '', photos: [], updatedAt: '2026-09-24T12:00:01.000Z' });
    expect(await listSpontaneousFindings('one')).toEqual([]);
  });

  it('allows protecting a photo before typing and never confirms an aborted write', async () => {
    const draft = { ...newSpontaneousFinding('one'), photos: [{ id: 'p', file: new Blob(['photo']), fileName: 'campo.jpg', mimeType: 'image/jpeg', lastModified: 0, capturedAt: '' }] };
    await expect(saveSpontaneousFinding(draft)).resolves.toMatchObject({ description: '', photos: [{ id: 'p' }] });
    storage.saveOffline.mockRejectedValue(new DOMException('Full', 'QuotaExceededError'));
    await expect(saveSpontaneousFinding(draft)).rejects.toThrow('Full');
  });

  it('removes the recovery journal only after confirmed deletion', async () => {
    const draft = { ...newSpontaneousFinding('one'), description: 'Conservar si falla el borrado' };
    protectSpontaneousText(draft);
    storage.removeOffline.mockRejectedValueOnce(new Error('abort'));
    await expect(removeSpontaneousFinding(draft.id)).rejects.toThrow();
    expect(await listSpontaneousFindings('one')).toHaveLength(1);
    storage.removeOffline.mockResolvedValue(undefined);
    await removeSpontaneousFinding(draft.id);
    expect(await listSpontaneousFindings('one')).toEqual([]);
  });
});
