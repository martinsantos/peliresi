import { beforeEach, describe, expect, it, vi } from 'vitest';

const indexedDbMocks = vi.hoisted(() => ({
  getAllOffline: vi.fn(),
  getOffline: vi.fn(),
  removeOffline: vi.fn(),
  saveOffline: vi.fn(),
}));

vi.mock('../../services/indexeddb', () => indexedDbMocks);
vi.mock('../../services/manifiesto.service', () => ({ manifiestoService: { list: vi.fn() } }));

import { clearUserOfflineData } from '../../services/offline-sync';

describe('inspection cache cleanup on logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    indexedDbMocks.removeOffline.mockResolvedValue(undefined);
  });

  it('removes only the signed-out user’s re-downloadable snapshots, preserving unsent field work', async () => {
    indexedDbMocks.getAllOffline.mockResolvedValue([
      { id: 'inspector-1:case-a' },
      { id: 'inspector-2:case-b' },
    ]);

    await clearUserOfflineData('inspector-1');

    expect(indexedDbMocks.getAllOffline).toHaveBeenCalledWith('inspection_cases');
    expect(indexedDbMocks.removeOffline).toHaveBeenCalledWith('manifiestos', 'user_inspector-1');
    expect(indexedDbMocks.removeOffline).toHaveBeenCalledWith('catalogos', 'user_inspector-1');
    expect(indexedDbMocks.removeOffline).toHaveBeenCalledWith('inspection_cases', 'inspector-1:case-a');
    expect(indexedDbMocks.removeOffline).not.toHaveBeenCalledWith('inspection_cases', 'inspector-2:case-b');
    expect(indexedDbMocks.removeOffline.mock.calls.map(([store]) => store)).not.toContain('inspection_evidence_queue');
    expect(indexedDbMocks.removeOffline.mock.calls.map(([store]) => store)).not.toContain('inspection_exchange_drafts');
  });
});
