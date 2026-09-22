import { StrictMode, type PropsWithChildren } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInspectionDraftOwnership } from '../../hooks/useInspectionDraftOwnership';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function lockManager(gate?: Promise<void>) {
  const held = new Set<string>();
  const request = vi.fn(async (name: string, options: LockOptions, callback: LockGrantedCallback<unknown>) => {
    if (gate) await gate;
    expect(options).toEqual({ mode: 'exclusive', ifAvailable: true });
    if (held.has(name)) return callback(null);
    held.add(name);
    try {
      return await callback({ name, mode: 'exclusive' } as Lock);
    } finally {
      held.delete(name);
    }
  });
  return { held, request };
}

const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');

function installLocks(value: unknown) {
  Object.defineProperty(navigator, 'locks', { configurable: true, value });
}

describe('useInspectionDraftOwnership', () => {
  beforeEach(() => { installLocks(lockManager()); });
  afterEach(async () => {
    cleanup();
    await act(async () => { await Promise.resolve(); });
    if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks);
    else Reflect.deleteProperty(navigator, 'locks');
  });

  it('allows only one instance to write the same local draft and never steals its lock', async () => {
    const manager = lockManager();
    installLocks(manager);
    const owner = renderHook(() => useInspectionDraftOwnership('inspector-1:case-1', true));
    expect(owner.result.current.status).toBe('checking');
    expect(owner.result.current.canWrite()).toBe(false);
    await waitFor(() => expect(owner.result.current.status).toBe('owned'));
    act(() => owner.result.current.retry());
    expect(owner.result.current.canWrite()).toBe(true);
    expect(manager.request).toHaveBeenCalledTimes(1);

    const contender = renderHook(() => useInspectionDraftOwnership('inspector-1:case-1', true));
    await waitFor(() => expect(contender.result.current.status).toBe('blocked'));
    expect(owner.result.current.canWrite()).toBe(true);
    expect(contender.result.current.canWrite()).toBe(false);

    act(() => contender.result.current.retry());
    await waitFor(() => expect(contender.result.current.status).toBe('blocked'));
    expect(owner.result.current.canWrite()).toBe(true);
    expect(manager.held.size).toBe(1);
  });

  it('revokes the synchronous guard on unmount and permits an explicit retry after release', async () => {
    const owner = renderHook(() => useInspectionDraftOwnership('draft-1', true));
    await waitFor(() => expect(owner.result.current.status).toBe('owned'));
    const canWriteBeforeUnmount = owner.result.current.canWrite;
    const contender = renderHook(() => useInspectionDraftOwnership('draft-1', true));
    await waitFor(() => expect(contender.result.current.status).toBe('blocked'));

    owner.unmount();
    expect(canWriteBeforeUnmount()).toBe(false);
    await act(async () => { await Promise.resolve(); });
    expect(contender.result.current.status).toBe('blocked');
    act(() => contender.result.current.retry());
    await waitFor(() => expect(contender.result.current.status).toBe('owned'));
    expect(contender.result.current.canWrite()).toBe(true);
  });

  it('keeps distinct users or inspections independently editable', async () => {
    const first = renderHook(() => useInspectionDraftOwnership('user-1:case-1', true));
    const second = renderHook(() => useInspectionDraftOwnership('user-2:case-1', true));
    const third = renderHook(() => useInspectionDraftOwnership('user-1:case-2', true));
    await waitFor(() => {
      expect(first.result.current.status).toBe('owned');
      expect(second.result.current.status).toBe('owned');
      expect(third.result.current.status).toBe('owned');
    });
  });

  it('fails closed when Web Locks is absent and can retry if support becomes available', async () => {
    installLocks(undefined);
    const hook = renderHook(() => useInspectionDraftOwnership('draft-1', true));
    await waitFor(() => expect(hook.result.current.status).toBe('unavailable'));
    expect(hook.result.current.canWrite()).toBe(false);

    installLocks(lockManager());
    act(() => hook.result.current.retry());
    await waitFor(() => expect(hook.result.current.status).toBe('owned'));
  });

  it('fails closed when the browser rejects a lock request', async () => {
    installLocks({ request: vi.fn().mockRejectedValue(new DOMException('Unavailable', 'SecurityError')) });
    const hook = renderHook(() => useInspectionDraftOwnership('draft-1', true));
    await waitFor(() => expect(hook.result.current.status).toBe('unavailable'));
    expect(hook.result.current.canWrite()).toBe(false);
  });

  it('releases a late asynchronous grant after unmount without keeping the draft locked', async () => {
    const gate = deferred();
    const manager = lockManager(gate.promise);
    installLocks(manager);
    const hook = renderHook(() => useInspectionDraftOwnership('draft-1', true));
    await waitFor(() => expect(manager.request).toHaveBeenCalledTimes(1));
    const canWriteBeforeUnmount = hook.result.current.canWrite;
    hook.unmount();
    await act(async () => { gate.resolve(); await gate.promise; });
    expect(canWriteBeforeUnmount()).toBe(false);
    expect(manager.held.size).toBe(0);

    const successor = renderHook(() => useInspectionDraftOwnership('draft-1', true));
    await waitFor(() => expect(successor.result.current.status).toBe('owned'));
  });

  it('survives StrictMode effect replay without blocking itself or leaking a lock', async () => {
    const manager = lockManager();
    installLocks(manager);
    const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
    const hook = renderHook(() => useInspectionDraftOwnership('draft-1', true), { wrapper });
    await waitFor(() => expect(hook.result.current.status).toBe('owned'));
    expect(hook.result.current.canWrite()).toBe(true);
    expect(manager.held.size).toBe(1);
    hook.unmount();
    await act(async () => { await Promise.resolve(); });
    expect(manager.held.size).toBe(0);
  });

  it('releases on disable or key change and keeps callbacks from an old key revoked', async () => {
    const manager = lockManager();
    installLocks(manager);
    const hook = renderHook(({ draftKey, enabled }) => useInspectionDraftOwnership(draftKey, enabled), {
      initialProps: { draftKey: 'draft-1', enabled: true },
    });
    await waitFor(() => expect(hook.result.current.status).toBe('owned'));
    const oldGuard = hook.result.current.canWrite;
    hook.rerender({ draftKey: 'draft-2', enabled: true });
    expect(oldGuard()).toBe(false);
    expect(hook.result.current.status).toBe('checking');
    await waitFor(() => expect(hook.result.current.status).toBe('owned'));
    expect(manager.held.has('sitrep:inspection-draft:draft-1')).toBe(false);
    expect(manager.held.has('sitrep:inspection-draft:draft-2')).toBe(true);

    hook.rerender({ draftKey: 'draft-2', enabled: false });
    expect(hook.result.current.canWrite()).toBe(false);
    expect(hook.result.current.status).toBe('unavailable');
    await act(async () => { await Promise.resolve(); });
    expect(manager.held.size).toBe(0);

    hook.rerender({ draftKey: 'draft-2', enabled: true });
    expect(hook.result.current.status).toBe('checking');
    await waitFor(() => expect(hook.result.current.status).toBe('owned'));
  });

  it('does not request a lock for an empty key or a disabled editor', async () => {
    const manager = lockManager();
    installLocks(manager);
    const empty = renderHook(() => useInspectionDraftOwnership('', true));
    const disabled = renderHook(() => useInspectionDraftOwnership('draft-1', false));
    expect(empty.result.current.status).toBe('unavailable');
    expect(disabled.result.current.status).toBe('unavailable');
    act(() => { empty.result.current.retry(); disabled.result.current.retry(); });
    await act(async () => { await Promise.resolve(); });
    expect(manager.request).not.toHaveBeenCalled();
  });
});
