import { beforeEach, describe, expect, it, vi } from 'vitest';

const indexedDbMocks = vi.hoisted(() => ({
  getAllOffline: vi.fn(),
  removeOffline: vi.fn(),
  replaceOffline: vi.fn(),
  saveOffline: vi.fn(),
}));

vi.mock('../../services/indexeddb', () => indexedDbMocks);

import {
  listPendingInspectionEvidence,
  pendingEvidenceFile,
  queueInspectionEvidence,
  removePendingInspectionEvidence,
  updatePendingInspectionEvidence,
  syncPendingInspectionEvidence,
  replacePendingInspectionEvidence,
  discardPendingInspectionEvidence,
  type PendingInspectionEvidence,
} from '../../services/inspectionOfflineEvidence';

const hash = Array.from({ length: 32 }, (_, index) => index + 1);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function pending(overrides: Partial<PendingInspectionEvidence> = {}): PendingInspectionEvidence {
  return {
    id: 'capture-1',
    inspectionId: 'inspection-1',
    userId: 'inspector-1',
    file: new Blob(['camera-bytes'], { type: 'image/jpeg' }),
    fileName: 'hallazgo-campo.jpg',
    mimeType: 'image/jpeg',
    lastModified: 1_725_000_000_000,
    fields: {
      itemId: 'item-seg-1',
      descripcion: 'Matafuego sin constancia de mantenimiento.',
    },
    capturedAt: '2024-08-29T18:40:00.000Z',
    sha256: '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20',
    createdAt: '2026-09-22T10:00:00.000Z',
    attempts: 0,
    ...overrides,
  };
}

describe('inspection offline evidence queue adversarial invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    indexedDbMocks.getAllOffline.mockResolvedValue([]);
    indexedDbMocks.saveOffline.mockResolvedValue(undefined);
    indexedDbMocks.removeOffline.mockResolvedValue(undefined);
    indexedDbMocks.replaceOffline.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'capture-generated'),
      subtle: { digest: vi.fn(async () => Uint8Array.from(hash).buffer) },
    });
  });

  it('persists the photo together with its checklist comment, item link and integrity hash', async () => {
    const file = new File([jpeg], 'hallazgo-campo.jpg', {
      type: 'image/jpeg',
      lastModified: 1_725_000_000_000,
    });

    const result = await queueInspectionEvidence('inspection-1', 'inspector-1', file, {
      itemId: 'item-seg-1',
      descripcion: 'Matafuego sin constancia de mantenimiento.',
    });

    expect(result).toMatchObject({
      id: 'capture-generated',
      inspectionId: 'inspection-1',
      userId: 'inspector-1',
      fileName: 'hallazgo-campo.jpg',
      mimeType: 'image/jpeg',
      attempts: 0,
      fields: {
        itemId: 'item-seg-1',
        descripcion: 'Matafuego sin constancia de mantenimiento.',
      },
      sha256: '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20',
    });
    expect(indexedDbMocks.saveOffline).toHaveBeenCalledWith('inspection_evidence_queue', result);
  });

  it('never exposes pending evidence from another inspection or another impersonated user', async () => {
    indexedDbMocks.getAllOffline.mockResolvedValue([
      pending({ id: 'later', createdAt: '2026-09-22T10:02:00.000Z' }),
      pending({ id: 'other-inspection', inspectionId: 'inspection-2' }),
      pending({ id: 'other-user', userId: 'inspector-2' }),
      pending({ id: 'earlier', createdAt: '2026-09-22T09:58:00.000Z' }),
    ]);

    const entries = await listPendingInspectionEvidence('inspection-1', 'inspector-1');

    expect(entries.map((entry) => entry.id)).toEqual(['earlier', 'later']);
    expect(indexedDbMocks.getAllOffline).toHaveBeenCalledWith('inspection_evidence_queue');
  });

  it('keeps a rejected or interrupted upload queued with an incremented attempt and diagnostic', async () => {
    const failed = pending({ attempts: 3, lastError: 'Conexión interrumpida durante la carga' });

    await updatePendingInspectionEvidence(failed);

    expect(indexedDbMocks.saveOffline).toHaveBeenCalledWith('inspection_evidence_queue', failed);
    expect(indexedDbMocks.removeOffline).not.toHaveBeenCalled();
  });

  it('reconstructs the exact file for an idempotent retry and removes it only after success', async () => {
    const entry = pending();

    const retriedFile = pendingEvidenceFile(entry);

    expect(retriedFile.name).toBe(entry.fileName);
    expect(retriedFile.type).toBe(entry.mimeType);
    expect(retriedFile.lastModified).toBe(entry.lastModified);
    expect(await retriedFile.text()).toBe('camera-bytes');
    expect(indexedDbMocks.removeOffline).not.toHaveBeenCalled();

    // This is deliberately the final operation: callers invoke it only after
    // the server accepted the same clienteId + SHA-256 capture.
    await removePendingInspectionEvidence(entry.id);
    expect(indexedDbMocks.removeOffline).toHaveBeenCalledWith('inspection_evidence_queue', entry.id);
  });

  it.each([
    ['animada.gif', 'image/gif', new TextEncoder().encode('GIF89a')],
    ['disfrazada.jpg', 'image/jpeg', new TextEncoder().encode('GIF89a')],
    ['captura.heic', 'image/heic', new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99])],
  ])('rejects unsupported content %s before persistence', async (name, type, bytes) => {
    await expect(queueInspectionEvidence('inspection-1', 'inspector-1', new File([bytes], name, { type }))).rejects.toThrow('Formato no permitido');
    expect(indexedDbMocks.saveOffline).not.toHaveBeenCalled();
  });

  it('does not claim durable capture when IndexedDB rejects for quota', async () => {
    indexedDbMocks.saveOffline.mockRejectedValue(new DOMException('quota', 'QuotaExceededError'));
    await expect(queueInspectionEvidence('inspection-1', 'inspector-1', new File([jpeg], 'photo.jpg', { type: 'image/jpeg' }))).rejects.toThrow('No se pudo confirmar la copia');
  });

  function memoryQueue(entries: PendingInspectionEvidence[]) {
    const store = new Map(entries.map((entry) => [entry.id, entry]));
    indexedDbMocks.getAllOffline.mockImplementation(async () => [...store.values()]);
    indexedDbMocks.saveOffline.mockImplementation(async (_store, entry: PendingInspectionEvidence) => { store.set(entry.id, entry); });
    indexedDbMocks.removeOffline.mockImplementation(async (_store, id: string) => { store.delete(id); });
    indexedDbMocks.replaceOffline.mockImplementation(async (_store, previousId: string, entry: PendingInspectionEvidence) => { store.set(entry.id, entry); store.delete(previousId); });
    return store;
  }
  const valid = (id: string) => pending({ id, file: new Blob([jpeg], { type: 'image/jpeg' }) });
  const scope = { inspectionId: 'inspection-1', userId: 'inspector-1' };

  it('retains a 400 diagnostic while allowing the next valid capture to synchronize', async () => {
    const store = memoryQueue([valid('bad'), valid('good')]);
    const upload = vi.fn().mockRejectedValueOnce({ response: { status: 400, data: { message: 'El destino no pertenece a esta inspección' } } }).mockResolvedValueOnce({ id: 'published' });
    expect(await syncPendingInspectionEvidence({ ...scope, upload })).toEqual({ synchronized: 1, failed: 1, skipped: 0 });
    expect(store.get('bad')).toMatchObject({ attempts: 1, failureKind: 'terminal', lastError: 'El destino no pertenece a esta inspección' });
    expect(store.has('good')).toBe(false);
    await syncPendingInspectionEvidence({ ...scope, upload });
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('keeps a 503 pending and waits for backoff or an explicit retry', async () => {
    const store = memoryQueue([valid('server-down')]);
    const upload = vi.fn().mockRejectedValue({ response: { status: 503, data: { message: 'Servicio temporalmente no disponible' } } });
    await syncPendingInspectionEvidence({ ...scope, upload });
    expect(store.get('server-down')).toMatchObject({ attempts: 1, failureKind: 'retryable' });
    await syncPendingInspectionEvidence({ ...scope, upload });
    expect(upload).toHaveBeenCalledTimes(1);
    upload.mockResolvedValueOnce({});
    await syncPendingInspectionEvidence({ ...scope, upload, manual: true });
    expect(store.size).toBe(0);
  });

  it('deduplicates simultaneous online events before reading or sending', async () => {
    const store = memoryQueue([valid('capture')]);
    let finish!: () => void;
    const upload = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const first = syncPendingInspectionEvidence({ ...scope, upload });
    const second = syncPendingInspectionEvidence({ ...scope, upload });
    expect(first).toBe(second);
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    finish();
    await Promise.all([first, second]);
    await syncPendingInspectionEvidence({ ...scope, upload });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(0);
  });

  it('stops sending when the active account changes and never exposes another owner', async () => {
    memoryQueue([valid('first'), valid('second'), { ...valid('foreign'), userId: 'inspector-2' }]);
    let active = true;
    const upload = vi.fn(async () => { active = false; });
    await syncPendingInspectionEvidence({ ...scope, upload, isActive: () => active });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0].id).toBe('first');
  });

  it('gives corrected bytes a new capture identity and preserves linkage', async () => {
    const store = memoryQueue([{ ...valid('old-capture'), failureKind: 'terminal' }]);
    const replacement = await replacePendingInspectionEvidence(scope.inspectionId, scope.userId, 'old-capture', new File([jpeg], 'corrected.jpg', { type: 'image/jpeg' }));
    expect(replacement.id).not.toBe('old-capture');
    expect(replacement.fields.itemId).toBe('item-seg-1');
    expect(store.has('old-capture')).toBe(false);
    expect(store.has(replacement.id)).toBe(true);
  });

  it('does not discard another user’s local capture or a confirmed upload', async () => {
    const store = memoryQueue([{ ...valid('foreign'), userId: 'inspector-2' }, { ...valid('published'), uploaded: true }]);
    await expect(discardPendingInspectionEvidence(scope.inspectionId, scope.userId, 'foreign')).rejects.toThrow('Esta captura ya cambió');
    await expect(discardPendingInspectionEvidence(scope.inspectionId, scope.userId, 'published')).rejects.toThrow('Esta captura ya cambió');
    expect(store.size).toBe(2);
  });

  it('preserves the original when a corrected capture cannot be saved', async () => {
    const original = { ...valid('old-capture'), failureKind: 'terminal' as const };
    const store = memoryQueue([original]);
    indexedDbMocks.replaceOffline.mockRejectedValue(new DOMException('quota', 'QuotaExceededError'));
    await expect(replacePendingInspectionEvidence(scope.inspectionId, scope.userId, original.id, new File([jpeg], 'corrected.jpg'))).rejects.toThrow('No se pudo confirmar la copia');
    expect(store.get(original.id)).toBe(original);
    expect(indexedDbMocks.removeOffline).not.toHaveBeenCalled();
  });

  it('pauses automatic retries after three attempts but keeps manual recovery available', async () => {
    const store = memoryQueue([{ ...valid('exhausted'), attempts: 3, failureKind: 'retryable' }]);
    const upload = vi.fn().mockResolvedValue({});
    await syncPendingInspectionEvidence({ ...scope, upload });
    expect(upload).not.toHaveBeenCalled();
    expect(store.size).toBe(1);
    await syncPendingInspectionEvidence({ ...scope, upload, manual: true });
    expect(store.size).toBe(0);
  });

  it('stops the batch after an authorization failure without removing either capture', async () => {
    const store = memoryQueue([valid('first'), valid('second')]);
    const upload = vi.fn().mockRejectedValue({ response: { status: 403, data: { message: 'Acceso denegado' } } });
    await syncPendingInspectionEvidence({ ...scope, upload });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(2);
  });

  it('marks a legacy GIF terminal locally while uploading the next valid capture', async () => {
    const store = memoryQueue([pending({ id: 'legacy-gif', file: new Blob(['GIF89a']) }), valid('good')]);
    const upload = vi.fn().mockResolvedValue({});
    await syncPendingInspectionEvidence({ ...scope, upload });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(store.get('legacy-gif')).toMatchObject({ failureKind: 'terminal', lastError: expect.stringContaining('Formato no permitido') });
  });

  it('uploads a newly queued capture even when another pass already read its snapshot', async () => {
    const store = memoryQueue([valid('first')]);
    let finish!: () => void;
    const upload = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; })).mockResolvedValue({});
    const first = syncPendingInspectionEvidence({ ...scope, upload });
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    store.set('new', valid('new'));
    const second = syncPendingInspectionEvidence({ ...scope, upload, onlyId: 'new', manual: true });
    finish();
    await Promise.all([first, second]);
    expect(upload.mock.calls.map(([entry]) => entry.id)).toEqual(['first', 'new']);
    expect(store.size).toBe(0);
  });

  it('waits for the browser lock on an explicit retry instead of dropping the request', async () => {
    memoryQueue([valid('capture')]);
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');
    const request = vi.fn(async (_name, _options, callback) => callback({ name: 'scope' }));
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
    try {
      await syncPendingInspectionEvidence({ ...scope, upload: vi.fn().mockResolvedValue({}), manual: true });
      expect(request).toHaveBeenCalledWith(expect.any(String), {}, expect.any(Function));
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'locks', descriptor);
      else Reflect.deleteProperty(navigator, 'locks');
    }
  });
});
