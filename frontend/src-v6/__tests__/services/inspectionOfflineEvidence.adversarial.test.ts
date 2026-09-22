import { beforeEach, describe, expect, it, vi } from 'vitest';

const indexedDbMocks = vi.hoisted(() => ({
  getAllOffline: vi.fn(),
  removeOffline: vi.fn(),
  saveOffline: vi.fn(),
}));

vi.mock('../../services/indexeddb', () => indexedDbMocks);

import {
  listPendingInspectionEvidence,
  pendingEvidenceFile,
  queueInspectionEvidence,
  removePendingInspectionEvidence,
  updatePendingInspectionEvidence,
  type PendingInspectionEvidence,
} from '../../services/inspectionOfflineEvidence';

const hash = Array.from({ length: 32 }, (_, index) => index + 1);

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
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'capture-generated'),
      subtle: { digest: vi.fn(async () => Uint8Array.from(hash).buffer) },
    });
  });

  it('persists the photo together with its checklist comment, item link and integrity hash', async () => {
    const file = new File(['camera-bytes'], 'hallazgo-campo.jpg', {
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
});
