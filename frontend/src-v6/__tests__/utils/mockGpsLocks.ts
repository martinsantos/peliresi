/** Small same-origin lock manager for jsdom, which does not implement Web Locks. */
export function installMockGpsLocks() {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'locks');
  const held = new Set<string>();
  const request = <T>(name: string, _options: LockOptions, callback: (lock: Lock | null) => T | PromiseLike<T>) => {
    if (held.has(name)) return Promise.resolve(callback(null));
    held.add(name);
    try {
      return Promise.resolve(callback({ name, mode: 'exclusive' })).finally(() => held.delete(name));
    } catch (error) { held.delete(name); return Promise.reject(error); }
  };
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
  return () => {
    if (previous) Object.defineProperty(navigator, 'locks', previous);
    else Reflect.deleteProperty(navigator, 'locks');
  };
}
