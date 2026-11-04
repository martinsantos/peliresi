/** Small same-origin lock manager for jsdom, which does not implement Web Locks. */
export function installMockGpsLocks() {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'locks');
  const held = new Set<string>();
  const waiting = new Map<string, Array<() => void>>();
  const request = <T>(name: string, options: LockOptions, callback: (lock: Lock | null) => T | PromiseLike<T>) =>
    new Promise<T>((resolve, reject) => {
      let queued = false;
      const abort = () => {
        if (!queued) return;
        queued = false;
        const queue = waiting.get(name), index = queue?.indexOf(grant) ?? -1;
        if (index >= 0) queue!.splice(index, 1);
        if (!queue?.length) waiting.delete(name);
        reject(new DOMException('Lock request aborted', 'AbortError'));
      };
      const release = () => {
        held.delete(name);
        const queue = waiting.get(name), next = queue?.shift();
        if (!queue?.length) waiting.delete(name);
        next?.();
      };
      const grant = () => {
        queued = false;
        options.signal?.removeEventListener('abort', abort);
        held.add(name);
        try { Promise.resolve(callback({ name, mode: 'exclusive' })).then(value => { release(); resolve(value); }, error => { release(); reject(error); }); }
        catch (error) { release(); reject(error); }
      };
      if (options.signal?.aborted) reject(new DOMException('Lock request aborted', 'AbortError'));
      else if (!held.has(name)) grant();
      else if (options.ifAvailable) {
        try { Promise.resolve(callback(null)).then(resolve, reject); } catch (error) { reject(error); }
      } else {
        const queue = waiting.get(name) ?? [];
        queued = true; queue.push(grant); waiting.set(name, queue);
        options.signal?.addEventListener('abort', abort, {once:true});
      }
    });
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
  return () => {
    if (previous) Object.defineProperty(navigator, 'locks', previous);
    else Reflect.deleteProperty(navigator, 'locks');
  };
}
