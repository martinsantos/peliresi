import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ __esModule: true, default: { documento: { findMany }, archivoBinario: { findUnique: vi.fn() } } }));
vi.mock('../../config/config', () => ({ config: { FILE_SCAN_MODE: 'disabled' } }));
vi.mock('../../services/documentStorage.service', () => ({ fileMimeFromBytes: vi.fn(() => 'application/pdf'), scanDocumentPath: vi.fn() }));

import { backfillLegacyDocuments } from '../../services/legacyDocumentBackfill.service';

describe('legacy document backfill safety', () => {
  beforeEach(() => { vi.clearAllMocks(); findMany.mockResolvedValue([]); });
  it('defaults to dry-run and does not require a confirmation token', async () => {
    await expect(backfillLegacyDocuments()).resolves.toMatchObject({ scanned: 0, migrated: 0 });
  });
  it('blocks writes without explicit operator confirmation', async () => {
    await expect(backfillLegacyDocuments({ dryRun: false })).rejects.toMatchObject({ statusCode: 412 });
  });
});
