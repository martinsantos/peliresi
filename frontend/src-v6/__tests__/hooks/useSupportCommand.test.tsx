import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useSupportCommand } from '../../hooks/useSupportCommand';
import { claimSupportCommand, confirmSupportCommand, loadSupportCommand, releaseSupportCommand, rejectSupportCommand, type SupportCommandInput } from '../../services/supportCommand';

const mocks = vi.hoisted(() => ({ records: new Map<string, unknown>(), failWrite: false, gate: null as Promise<void> | null, act: vi.fn(), recover: vi.fn(), session: true, context: 'role-one' }));
vi.mock('../../services/support.service', () => ({ supportService: { act: mocks.act, recoverAction: mocks.recover } }));
vi.mock('../../utils/supportSession', () => ({ supportSessionMatches: () => mocks.session, supportRequestContext: () => mocks.context }));
vi.mock('../../services/supportCommandStore', () => ({
  readSupportCommandRecord: async (key: string) => mocks.records.get(key) || null,
  updateSupportCommandRecord: async (key: string, update: (value: unknown) => unknown) => {
    if (mocks.gate) await mocks.gate;
    if (mocks.failWrite) throw new Error('QuotaExceeded');
    const next = update(mocks.records.get(key) || null);
    if (next) mocks.records.set(key, next); else mocks.records.delete(key);
    return next;
  },
}));
const scope = { userId: 'user', context: 'GENERADOR:actor', ticketId: 'ticket' };
const receipt = { id: 'ticket', version: 8, replay: false };
const proposal = (key = 'original'): SupportCommandInput => ({ key, input: { accion: 'RESPONDER', version: 7, cuerpo: 'Respuesta original' }, files: [new File(['original'], 'prueba.pdf', { type: 'application/pdf', lastModified: 123 })] });
async function ready() {
  const hook = renderHook(() => useSupportCommand(scope));
  await waitFor(() => expect(hook.result.current.ready).toBe(true)); return hook;
}
beforeEach(() => { mocks.records.clear(); mocks.failWrite = false; mocks.gate = null; mocks.session = true; mocks.context = 'role-one'; mocks.act.mockReset().mockResolvedValue(receipt); mocks.recover.mockReset().mockResolvedValue({ ...receipt, status: 'rejected' }); });
it('does not send if the durable copy fails', async () => {
  const hook = await ready(); mocks.failWrite = true;
  await act(() => hook.result.current.submit(proposal()));
  expect(mocks.act).not.toHaveBeenCalled(); expect(hook.result.current.error).toContain('No se envió');
});
it('waits for storage and ignores duplicate clicks before rendering', async () => {
  const hook = await ready(); let resume!: () => void;
  mocks.gate = new Promise(resolve => { resume = resolve; }); let first!: Promise<void>;
  act(() => { first = hook.result.current.submit(proposal()); void hook.result.current.submit(proposal('second')); });
  expect(mocks.act).not.toHaveBeenCalled();
  await act(async () => { resume(); await first; });
  expect(mocks.act).toHaveBeenCalledOnce(); expect(hook.result.current.command?.status).toBe('confirmed');
});
it.each(['RESPONDER', 'NOTA'] as const)('reopens an uncertain %s with the same key, body and attachment without automatic delivery', async accion => {
  mocks.act.mockRejectedValueOnce(new Error('Lost response after commit'));
  const first = await ready(); const input = proposal(); input.input.accion = accion;
  await act(() => first.result.current.submit(input)); first.unmount();
  const reopened = await ready();
  expect(mocks.act).toHaveBeenCalledOnce(); expect(reopened.result.current.command?.status).toBe('pending');
  expect(reopened.result.current.command?.files[0]).toMatchObject({ name: 'prueba.pdf', size: 8, type: 'application/pdf', lastModified: 123 });
  await act(() => reopened.result.current.retry());
  expect(mocks.act.mock.calls[1]).toEqual(mocks.act.mock.calls[0]); expect(reopened.result.current.command?.status).toBe('confirmed');
});
it.each(['userId', 'context', 'ticketId'] as const)('isolates stored commands by %s', async field => {
  await claimSupportCommand(scope, proposal());
  expect(await loadSupportCommand({ ...scope, [field]: 'different' })).toBeNull();
});
it('an atomic claim cannot replace another tab command', async () => {
  const [one, two] = await Promise.all([claimSupportCommand(scope, proposal()), claimSupportCommand(scope, proposal('second'))]);
  expect(two.key).toBe(one.key);
  const hook = await ready(); await act(() => hook.result.current.submit(proposal('third')));
  expect(mocks.act).not.toHaveBeenCalled(); expect(hook.result.current.error).toContain('anterior');
});
it.each([401, 403, 409, 500])('does not erase uncertainty based on generic HTTP %s', async status => {
  mocks.act.mockRejectedValueOnce({ response: { status } });
  const hook = await ready(); await act(() => hook.result.current.submit(proposal()));
  expect(hook.result.current.command?.status).toBe('pending');
  await expect(releaseSupportCommand(scope, 'original')).rejects.toThrow('Primero confirmá');
});
it('allows recovery only after an explicit server proof of non-application', async () => {
  mocks.act.mockRejectedValueOnce({ response: { status: 409, data: { code: 'SUPPORT_ACTION_NOT_APPLIED', message: 'La versión cambió.' } } });
  const hook = await ready(); await act(() => hook.result.current.submit(proposal()));
  expect(hook.result.current.command).toMatchObject({ status: 'rejected', rejection: 'La versión cambió.' });
  const cleanup = vi.fn().mockRejectedValueOnce(new Error('UI refresh failed')).mockResolvedValueOnce(undefined);
  await act(() => hook.result.current.release(cleanup)); expect(await loadSupportCommand(scope)).not.toBeNull();
  await act(() => hook.result.current.release(cleanup)); expect(await loadSupportCommand(scope)).toBeNull();
});
it('retains confirmation when saving the receipt fails and safely replays after reopening', async () => {
  const hook = await ready(); mocks.act.mockImplementationOnce(async () => { mocks.failWrite = true; return receipt; });
  await act(() => hook.result.current.submit(proposal()));
  expect(hook.result.current.command?.status).toBe('confirmed');
  expect(hook.result.current.error).toContain('servidor confirmó'); hook.unmount(); mocks.failWrite = false;
  const reopened = await ready(); expect(reopened.result.current.command?.status).toBe('pending');
  await act(() => reopened.result.current.retry()); expect(mocks.act.mock.calls[1]).toEqual(mocks.act.mock.calls[0]);
});
it('does not clean the draft until a confirmed receipt is durably saved', async () => {
  const hook = await ready();
  mocks.act.mockImplementationOnce(async () => { mocks.failWrite = true; return receipt; });
  await act(() => hook.result.current.submit(proposal()));
  const cleanup = vi.fn().mockResolvedValue(undefined);
  await act(() => hook.result.current.release(cleanup));
  expect(cleanup).not.toHaveBeenCalled();
  expect((await loadSupportCommand(scope))?.status).toBe('pending');
  expect(hook.result.current.command?.status).toBe('confirmed');
  mocks.failWrite = false;
  await act(() => hook.result.current.release(cleanup));
  expect(cleanup).toHaveBeenCalledOnce();
  expect(await loadSupportCommand(scope)).toBeNull();
  expect(mocks.act).toHaveBeenCalledOnce();
});
it('a failed follow-up read cannot turn a confirmed action into a retry', async () => {
  const hook = await ready(); await act(() => hook.result.current.submit(proposal()));
  await act(() => hook.result.current.release(async () => { throw new Error('Read failed'); }));
  expect(hook.result.current.command?.status).toBe('confirmed');
  await act(() => hook.result.current.retry()); expect(mocks.act).toHaveBeenCalledOnce();
});
it('late rejections cannot undo a saved receipt', async () => {
  await claimSupportCommand(scope, proposal()); await confirmSupportCommand(scope, 'original', receipt);
  expect((await rejectSupportCommand(scope, 'original', 'Late failure')).status).toBe('confirmed');
});
it('does not dispatch when session changes while preparing attachment storage', async () => {
  const hook = await ready(); let resume!: () => void;
  mocks.gate = new Promise(resolve => { resume = resolve; }); let first!: Promise<void>;
  act(() => { first = hook.result.current.submit(proposal()); }); mocks.session = false;
  await act(async () => { resume(); await first; }); expect(mocks.act).not.toHaveBeenCalled();
});
it('rejects a receipt for a different ticket', async () => {
  mocks.act.mockResolvedValueOnce({ ...receipt, id: 'different' });
  const hook = await ready(); await act(() => hook.result.current.submit(proposal()));
  expect(hook.result.current.command?.status).toBe('pending');
});

it('does not dispatch if activity changes for the same account before the stored copy completes', async () => {
  const hook = await ready(); let resume!: () => void;
  mocks.gate = new Promise(resolve => { resume = resolve; }); let first!: Promise<void>;
  act(() => { first = hook.result.current.submit(proposal()); }); mocks.context = 'role-two';
  await act(async () => { resume(); await first; }); expect(mocks.act).not.toHaveBeenCalled();
});

it('recovers rejected files without retransmitting the multipart body', async () => {
  mocks.act.mockRejectedValueOnce({ response: { status: 400, data: { message: 'Archivo no permitido' } } });
  const hook = await ready(); await act(() => hook.result.current.submit(proposal()));
  expect(hook.result.current.command?.status).toBe('pending');
  await act(() => hook.result.current.recover());
  expect(mocks.recover).toHaveBeenCalledWith('ticket', 'original');
  expect(mocks.act).toHaveBeenCalledOnce();
  expect(hook.result.current.command).toMatchObject({ status: 'rejected', input: proposal().input });
  expect(hook.result.current.command?.files[0].name).toBe('prueba.pdf');
  hook.unmount(); const reopened = await ready(); expect(reopened.result.current.command?.status).toBe('rejected');
});
it('shows confirmation instead of allowing edits when recovery discovers an applied action', async () => {
  await claimSupportCommand(scope, proposal()); mocks.recover.mockResolvedValueOnce({ ...receipt, status: 'confirmed' });
  const hook = await ready(); await act(() => hook.result.current.recover());
  expect(hook.result.current.command?.status).toBe('confirmed'); expect(mocks.act).not.toHaveBeenCalled();
});
it('keeps uncertain content when recovery fails and retries the same recovery after reopening', async () => {
  await claimSupportCommand(scope, proposal()); mocks.recover.mockRejectedValueOnce(new Error('timeout'));
  const hook = await ready(); await act(() => hook.result.current.recover());
  expect(hook.result.current.command?.status).toBe('pending'); hook.unmount();
  const reopened = await ready(); await act(() => reopened.result.current.recover());
  expect(mocks.recover.mock.calls).toEqual([['ticket', 'original'], ['ticket', 'original']]);
  expect(reopened.result.current.command?.status).toBe('rejected');
});
it('does not unlock on a mismatched recovery receipt', async () => {
  await claimSupportCommand(scope, proposal()); mocks.recover.mockResolvedValueOnce({ ...receipt, id: 'foreign', status: 'rejected' });
  const hook = await ready(); await act(() => hook.result.current.recover());
  expect(hook.result.current.command?.status).toBe('pending');
});
it('blocks recovery after the active account context changes', async () => {
  await claimSupportCommand(scope, proposal()); const hook = await ready(); mocks.context = 'another';
  await act(() => hook.result.current.recover()); expect(mocks.recover).not.toHaveBeenCalled();
});
