import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useSupportActionDraft } from '../../hooks/useSupportActionDraft';
import { emptySupportWorkspace, readSupportActionDraft, writeSupportActionDraft } from '../../services/supportActionDraft';
import type { SupportCommand } from '../../services/supportCommand';
const mocks = vi.hoisted(() => ({ records: new Map<string, unknown>(), write: false, read: false, owned: true, session: true, context: 'same', gate: null as Promise<void> | null }));
vi.mock('../../utils/supportSession', () => ({ supportSessionMatches: () => mocks.session, supportRequestContext: () => mocks.context }));
vi.mock('../../hooks/useInspectionDraftOwnership', () => ({ useInspectionDraftOwnership: () => ({ status: mocks.owned ? 'owned' : 'blocked', canWrite: () => mocks.owned, retry: vi.fn() }) }));
vi.mock('../../services/supportCommandStore', () => ({
  readSupportCommandRecord: async (key: string) => { if (mocks.read) throw new Error('Unavailable'); return mocks.records.get(key) || null; },
  updateSupportCommandRecord: async (key: string, change: (current: unknown) => unknown) => {
    if (mocks.gate) await mocks.gate;
    if (mocks.write) throw new Error('Quota');
    const next = change(mocks.records.get(key) || null); mocks.records.set(key, next); return next;
  },
}));
const scope = { userId: 'one', context: 'OPERADOR:first', ticketId: 'ticket-one' };
const audio = () => new File(['audio bytes'], 'clip.webm', { type: 'audio/webm', lastModified: 123 });
const attachment = () => new File(['pdf bytes'], 'draft.pdf', { type: 'application/pdf', lastModified: 456 });
async function ready() { const hook = renderHook(() => useSupportActionDraft(scope)); await waitFor(() => expect(hook.result.current.ready).toBe(true)); return hook; }
beforeEach(() => { mocks.records.clear(); mocks.write = false; mocks.read = false; mocks.owned = true; mocks.session = true; mocks.context = 'same'; mocks.gate = null; });
it('recovers each audience with body, document, completed audio and selected action without transmitting', async () => {
  const hook = await ready();
  act(() => { hook.result.current.update('RESPONDER', 4, { body: 'Public draft', files: [attachment()] }); hook.result.current.update('NOTA', 4, { body: 'Private draft', audio: audio() }); hook.result.current.select('NOTA'); });
  await act(async () => { expect(await hook.result.current.flush()).toBe(true); }); hook.unmount();
  const reopened = await ready();
  expect(reopened.result.current.workspace.action).toBe('NOTA');
  expect(reopened.result.current.workspace.drafts.RESPONDER).toMatchObject({ body: 'Public draft', files: [{ name: 'draft.pdf', size: 9, lastModified: 456 }] });
  expect(reopened.result.current.workspace.drafts.NOTA).toMatchObject({ body: 'Private draft', audio: { name: 'clip.webm', size: 11, lastModified: 123 } });
  expect(reopened.result.current.restored).toBe(true);
});
it.each(['userId', 'context', 'ticketId'] as const)('isolates recovery by %s', async field => {
  const hook = await ready(); act(() => hook.result.current.update('NOTA', 3, { body: 'Private' }));
  await act(() => hook.result.current.flush());
  expect(await readSupportActionDraft({ ...scope, [field]: 'other' })).toBeNull();
});
it('preserves routing and classification independently after reopening', async () => {
  const hook = await ready();
  act(() => { hook.result.current.update('DERIVAR', 3, { target: 'agent', body: 'Route note' }); hook.result.current.update('CLASIFICAR', 3, { category: 'GPS', type: 'PROBLEMA', priority: 'ALTA', body: 'Triage' }); });
  await act(() => hook.result.current.flush()); hook.unmount(); const reopened = await ready();
  expect(reopened.result.current.workspace.drafts.DERIVAR).toMatchObject({ target: 'agent', body: 'Route note', version: 3 });
  expect(reopened.result.current.workspace.drafts.CLASIFICAR).toMatchObject({ category: 'GPS', type: 'PROBLEMA', priority: 'ALTA' });
});
it('keeps the latest keystrokes after queued storage and flushes before sending', async () => {
  const hook = await ready(); let resolve!: () => void; mocks.gate = new Promise(done => { resolve = done; });
  act(() => { hook.result.current.update('RESPONDER', 1, { body: 'A' }); hook.result.current.update('RESPONDER', 1, { body: 'AB' }); hook.result.current.update('RESPONDER', 1, { body: 'ABC' }); });
  expect(hook.result.current.saving).toBe(true);
  await act(async () => { resolve(); await hook.result.current.flush(); });
  expect((await readSupportActionDraft(scope))?.drafts.RESPONDER?.body).toBe('ABC');
  expect(hook.result.current.saving).toBe(false);
});
it('shows storage failure without erasing the visible draft and allows a local retry', async () => {
  const hook = await ready(); mocks.write = true; act(() => hook.result.current.update('NOTA', 3, { body: 'Do not lose' }));
  await act(async () => { expect(await hook.result.current.flush()).toBe(false); });
  expect(hook.result.current.workspace.drafts.NOTA?.body).toBe('Do not lose'); expect(hook.result.current.error).toContain('no cierres');
  mocks.write = false; await act(async () => { expect(await hook.result.current.flush()).toBe(true); });
  expect((await readSupportActionDraft(scope))?.drafts.NOTA?.body).toBe('Do not lose');
});
it('does not overwrite an unreadable stored draft', async () => {
  mocks.read = true; const hook = renderHook(() => useSupportActionDraft(scope));
  await waitFor(() => expect(hook.result.current.error).toContain('leer'));
  act(() => hook.result.current.update('RESPONDER', 1, { body: 'replacement' }));
  expect(mocks.records.size).toBe(0); expect(hook.result.current.ready).toBe(false);
});
it('rechecks ownership inside the storage transaction before overwriting another tab', async () => {
  const hook = await ready(); let resolve!: () => void; mocks.gate = new Promise(done => { resolve = done; });
  act(() => hook.result.current.update('NOTA', 1, { body: 'stale editor' })); mocks.owned = false;
  await act(async () => { resolve(); await Promise.resolve(); });
  await waitFor(() => expect(hook.result.current.saving).toBe(false));
  expect(mocks.records.size).toBe(0);
});
it('does not replace a new account context from an older asynchronous write', async () => {
  const hook = await ready(); let resolve!: () => void; mocks.gate = new Promise(done => { resolve = done; });
  act(() => hook.result.current.update('NOTA', 1, { body: 'old context' })); mocks.context = 'new context';
  await act(async () => { resolve(); await Promise.resolve(); }); await waitFor(() => expect(hook.result.current.saving).toBe(false));
  expect(mocks.records.size).toBe(0);
});
it('retires only the confirmed action before its receipt can be cleared', async () => {
  const hook = await ready(); act(() => { hook.result.current.update('NOTA', 1, { body: 'Sent' }); hook.result.current.update('RESPONDER', 1, { body: 'Not sent' }); });
  const command = { status: 'confirmed', input: { accion: 'NOTA', cuerpo: 'Sent', version: 1 }, files: [] } as unknown as SupportCommand;
  await act(() => hook.result.current.finish(command)); hook.unmount();
  const reopened = await ready(); expect(reopened.result.current.workspace.drafts.NOTA).toBeUndefined(); expect(reopened.result.current.workspace.drafts.RESPONDER?.body).toBe('Not sent');
});
it('does not silently acknowledge cleanup when local persistence fails', async () => {
  const hook = await ready(); mocks.write = true;
  const command = { status: 'confirmed', input: { accion: 'NOTA', cuerpo: '', version: 1 }, files: [] } as unknown as SupportCommand;
  await act(async () => { await expect(hook.result.current.finish(command)).rejects.toThrow('limpieza'); });
});
it('returns rejected content to its original audience and retains its old version for review', async () => {
  const hook = await ready();
  const command = { status: 'rejected', input: { accion: 'NOTA', cuerpo: 'Rejected', version: 2 }, files: [attachment()] } as unknown as SupportCommand;
  await act(() => hook.result.current.finish(command));
  expect(hook.result.current.workspace).toMatchObject({ action: 'NOTA', drafts: { NOTA: { body: 'Rejected', version: 2, files: [{ name: 'draft.pdf' }] } } });
});
it('rejects malformed or oversized draft content rather than replacing it', async () => {
  const large = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'too-large.pdf');
  await expect(writeSupportActionDraft(scope, { ...emptySupportWorkspace(), drafts: { NOTA: { body: '', version: 1, files: [large], audio: null } } }, () => true)).rejects.toThrow('verificar');
  expect(mocks.records.size).toBe(0);
});

it('warns before closing while a local copy failed and stops warning once saved', async () => {
  const hook = await ready(); mocks.write = true;
  act(() => hook.result.current.update('RESPONDER', 1, { body: 'Unsaved' })); await act(() => hook.result.current.flush());
  const failed = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(failed); expect(failed.defaultPrevented).toBe(true);
  mocks.write = false; await act(() => hook.result.current.flush());
  const saved = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(saved); expect(saved.defaultPrevented).toBe(false);
});
it('keeps malformed local classification data intact and blocks editing', async () => {
  const id = 'draft:' + JSON.stringify([scope.userId, scope.context, scope.ticketId]);
  const corrupted = { id, scope, savedAt: Date.now(), action: 'CLASIFICAR', drafts: { CLASIFICAR: { body: '', version: 1, files: [], audio: null, category: 'unknown-category' } } };
  mocks.records.set(id, corrupted); const hook = renderHook(() => useSupportActionDraft(scope));
  await waitFor(() => expect(hook.result.current.error).toContain('leer'));
  expect(hook.result.current.ready).toBe(false); expect(mocks.records.get(id)).toBe(corrupted);
});
