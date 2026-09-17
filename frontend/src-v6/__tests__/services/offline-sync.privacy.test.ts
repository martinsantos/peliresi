import { describe, expect, it, vi } from 'vitest';

const removeOffline = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../services/indexeddb', () => ({
  OFFLINE_CATALOG_KEYS: ['tipos-residuo', 'generadores', 'transportistas', 'operadores', 'vehiculos', 'choferes'],
  getOfflineCatalogKey: (userId: string, key: string) => `user_${userId}_${key}`,
  removeOffline,
  saveOffline: vi.fn(),
  getOffline: vi.fn(),
}));

vi.mock('../../services/manifiesto.service', () => ({ manifiestoService: { list: vi.fn() } }));

import { clearUserOfflineData } from '../../services/offline-sync';

describe('clearUserOfflineData', () => {
  it('removes only the current principal cache plus legacy global catalog entries', async () => {
    await clearUserOfflineData('admin-a');

    expect(removeOffline).toHaveBeenCalledWith('manifiestos', 'user_admin-a');
    expect(removeOffline).toHaveBeenCalledWith('catalogos', 'user_admin-a_generadores');
    expect(removeOffline).toHaveBeenCalledWith('catalogos', 'generadores');
    expect(removeOffline).not.toHaveBeenCalledWith('catalogos', 'user_operador-b_generadores');
    expect(removeOffline).toHaveBeenCalledTimes(13);
  });
});
