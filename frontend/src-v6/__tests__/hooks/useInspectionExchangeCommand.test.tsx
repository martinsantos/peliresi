import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInspectionExchangeCommand } from '../../hooks/useInspectionExchangeCommand';
import { claimExchangeCommand, loadExchangeCommand, releaseExchangeCommand, settleExchangeCommand, type ExchangeCommandScope, type ExchangeCommandInput } from '../../services/inspectionExchangeCommand';

const mocks = vi.hoisted(() => ({ records: new Map<string, unknown>(), failWrite: false, presentExchange: vi.fn(), decideExchange: vi.fn(), writeGate: null as Promise<void> | null }));
vi.mock('../../services/inspeccion.service', () => ({ inspeccionService: mocks }));
vi.mock('../../services/indexeddb', () => ({
  getOffline: async (_store: string, key: string) => mocks.records.get(key) || null,
  updateOffline: async (_store: string, key: string, update: (value: unknown) => unknown) => {
    if (mocks.writeGate) await mocks.writeGate;
    if (mocks.failWrite) throw new Error('QuotaExceeded');
    const next = update(mocks.records.get(key) || null);
    if (next) mocks.records.set(key, next); else mocks.records.delete(key);
    return next;
  },
}));
const scope: ExchangeCommandScope = { userId: 'user', owner: 'generator', inspectionId: 'case' };
const proposal = (id = 'unique-original'): ExchangeCommandInput => ({ kind: 'presentation', input: {
  clienteId: id, version: 8, tipo: 'DESCARGO', asunto: 'Constancia requerida', cuerpo: 'Contenido original completo.',
  respondeAId: 'requirement-1', files: [new File(['PDF original'], 'constancia.pdf', { type: 'application/pdf', lastModified: 100 })],
} });
const receipt = { id: 'receipt', clienteId: 'unique-original' } as any;
async function ready() {
  const hook = renderHook(() => useInspectionExchangeCommand(scope));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
}
describe('durable PSIP sends', () => {
  beforeEach(() => {
    mocks.records.clear(); mocks.failWrite = false; mocks.writeGate = null;
    mocks.presentExchange.mockReset().mockResolvedValue(receipt);
    mocks.decideExchange.mockReset().mockResolvedValue(receipt);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });
  it('does not dispatch if durable saving fails', async () => {
    const hook = await ready(); mocks.failWrite = true;
    await act(() => hook.result.current.submit(proposal()));
    expect(mocks.presentExchange).not.toHaveBeenCalled();
    expect(hook.result.current.error).toContain('No se envió');
  });
  it('waits for storage acknowledgement and blocks two clicks before React renders', async () => {
    const hook = await ready(); let unblock!: () => void;
    mocks.writeGate = new Promise<void>(resolve => { unblock = resolve; });
    let first!: Promise<void>;
    act(() => { first = hook.result.current.submit(proposal()); void hook.result.current.submit(proposal('second')); });
    expect(mocks.presentExchange).not.toHaveBeenCalled();
    await act(async () => { unblock(); await first; });
    expect(mocks.presentExchange).toHaveBeenCalledTimes(1);
    expect(hook.result.current.command?.status).toBe('confirmed');
  });
  it.each(['presentation', 'decision'])('recovers a lost %s response after unmount and manually reuses the exact command', async kind => {
    const command: ExchangeCommandInput = kind === 'presentation' ? proposal() : { kind: 'decision', input: {
      clienteId: 'unique-original', version: 9, decision: 'DERIVADA_LEGALES', fundamento: 'Fundamento original verificable.', expedienteLegal: 'QA-123', files: proposal().input.files,
    } };
    const send = kind === 'presentation' ? mocks.presentExchange : mocks.decideExchange;
    send.mockRejectedValueOnce(new Error('Connection reset after commit'));
    const first = await ready();
    await act(() => first.result.current.submit(command));
    const original = send.mock.calls[0][1];
    expect(first.result.current.command?.status).toBe('pending');
    first.unmount();
    const reopened = await ready();
    expect(send).toHaveBeenCalledTimes(1);
    expect(reopened.result.current.command?.input).toEqual(original);
    await act(() => reopened.result.current.retry());
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][1]).toEqual(original);
    expect(send.mock.calls[1][1].files[0].name).toBe('constancia.pdf');
    expect(send.mock.calls[1][1].files[0].size).toBe(12);
    expect(reopened.result.current.command?.status).toBe('confirmed');
  });
  it('never overwrites a command claimed by another tab', async () => {
    const [first, second] = await Promise.all([claimExchangeCommand(scope, proposal()), claimExchangeCommand(scope, proposal('different'))]);
    expect(first.input.clienteId).toBe(second.input.clienteId);
    const hook = await ready();
    await act(() => hook.result.current.submit(proposal('third')));
    expect(mocks.presentExchange).not.toHaveBeenCalled();
    expect(hook.result.current.command?.input.clienteId).toBe(first.input.clienteId);
  });
  it.each(['userId', 'owner', 'inspectionId'] as const)('isolates the same local device by %s', async field => {
    await claimExchangeCommand(scope, proposal());
    expect(await loadExchangeCommand({ ...scope, [field]: 'another' })).toBeNull();
  });
  it('cannot discard an uncertain send, including a generic 409', async () => {
    mocks.presentExchange.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Conflicto' } } });
    const hook = await ready(); await act(() => hook.result.current.submit(proposal()));
    await expect(releaseExchangeCommand(scope, 'unique-original')).rejects.toThrow('Primero confirmá');
    expect(hook.result.current.command?.status).toBe('pending');
  });
  it('unlocks revision only after an explicit server not-applied response', async () => {
    mocks.presentExchange.mockRejectedValueOnce({ response: { data: { code: 'INSPECTION_COMMAND_NOT_APPLIED', message: 'Version outdated' } } });
    const hook = await ready(); await act(() => hook.result.current.submit(proposal()));
    expect(hook.result.current.command?.status).toBe('rejected');
    const restore = vi.fn().mockResolvedValue(undefined);
    await act(() => hook.result.current.release(restore));
    expect(restore).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ cuerpo: 'Contenido original completo.' }) }));
    expect(await loadExchangeCommand(scope)).toBeNull();
  });
  it('keeps the receipt if local cleanup fails and never repeats the server write', async () => {
    const hook = await ready(); await act(() => hook.result.current.submit(proposal()));
    await act(() => hook.result.current.release(async () => { throw new Error('Draft cleanup failed'); }));
    expect(hook.result.current.command?.status).toBe('confirmed');
    await act(() => hook.result.current.retry());
    expect(mocks.presentExchange).toHaveBeenCalledTimes(1);
  });
  it('preserves the authoritative receipt if local acknowledgement fails', async () => {
    mocks.presentExchange.mockImplementationOnce(async () => { mocks.failWrite = true; return receipt; });
    const hook = await ready(); await act(() => hook.result.current.submit(proposal()));
    expect(hook.result.current.command?.status).toBe('confirmed');
    expect(hook.result.current.error).toContain('servidor confirmó');
    expect((await loadExchangeCommand(scope))?.status).toBe('pending');
  });
  it('does not let a late rejection overwrite an already confirmed receipt', async () => {
    await claimExchangeCommand(scope, proposal());
    await settleExchangeCommand(scope, 'unique-original', { status: 'confirmed', receipt });
    await settleExchangeCommand(scope, 'unique-original', { status: 'rejected', rejection: 'late failure' });
    expect((await loadExchangeCommand(scope))?.status).toBe('confirmed');
  });
  it('does not send with a newly selected role after old-context saving completes', async () => {
    const hook = await ready(); let unblock!: () => void;
    mocks.writeGate = new Promise<void>(resolve => { unblock = resolve; });
    let pending!: Promise<void>; act(() => { pending = hook.result.current.submit(proposal()); });
    hook.unmount();
    await act(async () => { unblock(); await pending; });
    expect(mocks.presentExchange).not.toHaveBeenCalled();
    expect((await loadExchangeCommand(scope))?.status).toBe('pending');
  });
  it('does not send offline or on reconnect/focus', async () => {
    await claimExchangeCommand(scope, proposal());
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const hook = await ready();
    await act(() => hook.result.current.retry());
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await act(async () => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('focus')); });
    expect(mocks.presentExchange).not.toHaveBeenCalled();
  });
});
