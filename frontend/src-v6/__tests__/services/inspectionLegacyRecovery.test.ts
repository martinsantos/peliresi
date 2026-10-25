import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ records: new Map<string, any>(), checkpoint: vi.fn(), abort: false }));
vi.mock('../../services/inspectionFieldCheckpoint', () => ({ readInspectionFieldCheckpoint: state.checkpoint }));
vi.mock('../../services/indexeddb', () => ({
  getAllOffline: async () => [...state.records.values()],
  updateOffline: async (_store: string, key: string, update: (value: any) => any) => {
    const result = update(state.records.get(key) || null);
    if (state.abort) throw new Error('aborted');
    state.records.set(key, result); return result;
  },
}));
import { readLegacyFieldCopies, recoverLegacyFieldEvidence } from '../../services/inspectionLegacyRecovery';
const oldKey = 'sitrep_inspection_draft_inspector_case';
const entry = (overrides = {}) => ({ id: 'file', userId: 'inspector', inspectionId: 'case', file: new Blob(['original']), sha256: 'original-sha', attempts: 2, ...overrides });
describe('explicit recovery of unscoped field copies', () => {
  beforeEach(() => { state.records.clear(); localStorage.clear(); state.abort = false; state.checkpoint.mockResolvedValue(undefined); });
  it('preserves both unequal text snapshots, including unreadable bytes, without rewriting them', async () => {
    state.checkpoint.mockResolvedValue('{"observaciones":"confirmed"}'); localStorage.setItem(oldKey, '{unfinished');
    const result = await readLegacyFieldCopies('inspector', 'case');
    expect(result.texts.map(item => item.raw)).toEqual(['{"observaciones":"confirmed"}', '{unfinished']);
    expect(localStorage.getItem(oldKey)).toBe('{unfinished');
  });
  it('does not duplicate equal snapshots', async () => {
    state.checkpoint.mockResolvedValue('{}'); localStorage.setItem(oldKey, '{}');
    expect((await readLegacyFieldCopies('inspector', 'case')).texts).toHaveLength(1);
  });
  it('does not show identical content twice just because its checkpoint time differs', async () => {
    state.checkpoint.mockResolvedValue('{"observaciones":"same","checkpointAt":10}');
    localStorage.setItem(oldKey, '{"observaciones":"same","checkpointAt":11}');
    expect((await readLegacyFieldCopies('inspector', 'case')).texts).toHaveLength(1);
    expect(localStorage.getItem(oldKey)).toContain('11');
  });
  it('lists only unscoped captures belonging to this user and case', async () => {
    for (const file of [entry(), entry({ id: 'other', userId: 'other' }), entry({ id: 'case2', inspectionId: 'case2' }), entry({ id: 'owned', owner: 'G' })]) state.records.set(file.id, file);
    expect((await readLegacyFieldCopies('inspector', 'case')).files.map(item => item.id)).toEqual(['file']);
  });
  it('claims a capture once across two activities and retains bytes, identity, receipt and attempts', async () => {
    const original = entry({ uploaded: true }); state.records.set('file', original);
    const results = await Promise.allSettled([recoverLegacyFieldEvidence('inspector', 'case', 'G', 'file'), recoverLegacyFieldEvidence('inspector', 'case', 'O', 'file')]);
    expect(results.map(item => item.status)).toEqual(['fulfilled', 'rejected']);
    expect(state.records.get('file')).toEqual({ ...original, owner: 'G', recoveredManually: true });
    await recoverLegacyFieldEvidence('inspector', 'case', 'G', 'file');
    expect(state.records.size).toBe(1);
  });
  it.each([['other', 'case', 'G'], ['inspector', 'other', 'G'], ['inspector', 'case', '']])('rejects another identity or missing owner (%s/%s/%s)', async (userId, caseId, owner) => {
    const original = entry(); state.records.set('file', original);
    await expect(recoverLegacyFieldEvidence(userId, caseId, owner, 'file')).rejects.toThrow();
    expect(state.records.get('file')).toBe(original);
  });
  it('keeps the unscoped original when durable claiming fails', async () => {
    const original = entry(); state.records.set('file', original); state.abort = true;
    await expect(recoverLegacyFieldEvidence('inspector', 'case', 'G', 'file')).rejects.toThrow('aborted');
    expect(state.records.get('file')).toBe(original);
  });
});
