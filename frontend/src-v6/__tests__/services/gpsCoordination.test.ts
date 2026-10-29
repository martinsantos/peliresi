import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startGpsLease, withGpsTransitionLock } from '../../services/gpsCoordination';
import { installMockGpsLocks } from '../utils/mockGpsLocks';

let restoreLocks: () => void;
beforeEach(() => { restoreLocks = installMockGpsLocks(); });
afterEach(() => restoreLocks());

describe('GPS coordination between pages', () => {
  it('blocks delivery while another page can add points, then allows it after release', async () => {
    const granted = vi.fn(), problem = vi.fn(), delivery = vi.fn().mockResolvedValue('entregado');
    const tracker = startGpsLease('trip-a', granted, problem);
    expect(granted).toHaveBeenCalledOnce();
    await expect(withGpsTransitionLock('trip-a', delivery)).rejects.toThrow(/otra pestaña/);
    expect(delivery).not.toHaveBeenCalled();
    await expect(withGpsTransitionLock('trip-b', delivery)).resolves.toBe('entregado');
    await tracker.release();
    await expect(withGpsTransitionLock('trip-a', delivery)).resolves.toBe('entregado');
    expect(problem).not.toHaveBeenCalled();
  });

  it('keeps another transition out until the first server action completes', async () => {
    let finish!: () => void;
    const action = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const first = withGpsTransitionLock('trip-a', action);
    await expect(withGpsTransitionLock('trip-a', vi.fn())).rejects.toThrow(/otra pestaña/);
    finish(); await first;
    await expect(withGpsTransitionLock('trip-a', async () => 1)).resolves.toBe(1);
  });

  it('fails closed when the browser cannot coordinate, with an actionable message', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    const granted = vi.fn(), problem = vi.fn(), delivery = vi.fn();
    const tracker = startGpsLease('trip-a', granted, problem);
    expect(granted).not.toHaveBeenCalled();
    expect(problem.mock.calls[0][0].message).toMatch(/navegador.*coordinar/i);
    await expect(withGpsTransitionLock('trip-a', delivery)).rejects.toThrow(/navegador.*coordinar/i);
    expect(delivery).not.toHaveBeenCalled();
    await tracker.release();
  });

  it('does not start a watcher if a delayed lock grant arrives after the page stopped', async () => {
    let grant!: () => void;
    Object.defineProperty(navigator, 'locks', { configurable: true, value: {
      request: (name: string, _options: LockOptions, callback: (lock: Lock) => Promise<void>) =>
        new Promise<void>((resolve, reject) => { grant = () => { void callback({ name, mode: 'exclusive' }).then(resolve, reject); }; }),
    } });
    const granted = vi.fn(), problem = vi.fn();
    const tracker = startGpsLease('trip-a', granted, problem);
    const stopped = tracker.release();
    grant(); await stopped;
    expect(granted).not.toHaveBeenCalled(); expect(problem).not.toHaveBeenCalled();
  });
});
