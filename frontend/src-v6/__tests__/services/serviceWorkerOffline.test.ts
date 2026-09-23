import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const origin = 'https://sitrep.test';
type WorkerRequest = { url: string; method: string; mode: string };
type WorkerEvent = {
  request: WorkerRequest;
  data?: { type?: string };
  respondWith: (response: Promise<Response>) => void;
  waitUntil: (work: Promise<unknown>) => void;
};
const html = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/html' } });

function workerHarness(app = false) {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const cacheApis = new Map<string, { match: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; add: ReturnType<typeof vi.fn>; addAll: ReturnType<typeof vi.fn> }>();
  const keyOf = (key: string | WorkerRequest) => new URL(typeof key === 'string' ? key : key.url, origin).href;
  const cacheFor = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    if (!cacheApis.has(name)) cacheApis.set(name, {
      match: vi.fn(async (key: string | WorkerRequest) => store.get(keyOf(key))?.clone()),
      put: vi.fn(async (key: string | WorkerRequest, response: Response) => { store.set(keyOf(key), response.clone()); }),
      add: vi.fn(async () => undefined),
      addAll: vi.fn(async () => undefined),
    });
    return cacheApis.get(name)!;
  };
  const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  const caches = {
    open: vi.fn(async (name: string) => cacheFor(name)),
    keys: vi.fn(async () => [...stores.keys()]),
    delete: vi.fn(async (name: string) => stores.delete(name)),
  };
  const source = readFileSync(`public/${app ? 'sw-app.js' : 'sw.js'}`, 'utf8').replaceAll('__SW_VERSION__', 'test');
  const skipWaiting = vi.fn();
  vm.runInNewContext(source, {
    self: { location: { origin }, addEventListener: (name: string, listener: (event: WorkerEvent) => void) => listeners.set(name, listener), clients: { claim: vi.fn() }, skipWaiting },
    caches, fetch, URL, Response, console: { log: vi.fn(), warn: vi.fn() },
    importScripts: vi.fn(),
  });
  const precacheName = app ? 'sitrep-app-test' : /const CACHE_NAME = '([^']+)'/.exec(source)![1];
  const runtimeName = app ? 'sitrep-app-runtime-test' : /const RUNTIME_CACHE = '([^']+)'/.exec(source)![1];
  return {
    fetch, caches, stores, cacheFor, precacheName, runtimeName, skipWaiting,
    async install() {
      let work: Promise<unknown> | undefined;
      listeners.get('install')!({ request: {} as WorkerRequest, respondWith: () => undefined, waitUntil: pending => { work = pending; } });
      await work;
    },
    message(data: { type: string }) { listeners.get('message')?.({ request: {} as WorkerRequest, data, respondWith: () => undefined, waitUntil: () => undefined }); },
    async request(path: string, mode = 'navigate', method = 'GET') {
      let handled: Promise<Response> | undefined;
      listeners.get('fetch')!({ request: { url: new URL(path, origin).href, mode, method }, respondWith: response => { handled = response; }, waitUntil: () => undefined });
      return handled ? await handled : undefined;
    },
    async activate() {
      let work: Promise<unknown> | undefined;
      listeners.get('activate')!({ request: {} as WorkerRequest, respondWith: () => undefined, waitUntil: pending => { work = pending; } });
      await work;
    },
  };
}

describe.each([false, true])('service worker scope/app=%s', (app) => {
  const base = app ? '/app' : '';

  it('serves its own saved SPA shell for a cold inspection navigation', async () => {
    const worker = workerHarness(app);
    await worker.cacheFor(worker.precacheName).put(`${base}/index.html`, html('SAVED SHELL'));
    const response = await worker.request(`${base}/inspecciones/case-1`);
    expect(await response?.text()).toBe('SAVED SHELL');
  });

  it('waits for explicit user approval after a complete precache', async () => {
    const worker = workerHarness(app);
    await worker.install();
    expect(worker.cacheFor(worker.precacheName).addAll).toHaveBeenCalled();
    expect(worker.skipWaiting).not.toHaveBeenCalled();
    worker.message({ type: 'SKIP_WAITING' });
    expect(worker.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('does not activate if an essential shell file cannot be precached', async () => {
    const worker = workerHarness(app);
    worker.cacheFor(worker.precacheName).addAll.mockRejectedValueOnce(new TypeError('Failed to precache shell'));
    await expect(worker.install()).rejects.toThrow('Failed to precache shell');
    expect(worker.skipWaiting).not.toHaveBeenCalled();
  });

  it.each(['/manual/', '/public/notice.html', '/archivo.pdf'])('does not substitute the SPA shell for %s', async (path) => {
    const worker = workerHarness(app);
    await worker.cacheFor(worker.precacheName).put(`${base}/index.html`, html('SAVED SHELL'));
    const response = await worker.request(`${base}${path}`);
    expect(await response?.text()).not.toContain('SAVED SHELL');
    expect(response?.status).toBe(503);
  });

  it('preserves exact cached public files', async () => {
    const worker = workerHarness(app);
    await worker.cacheFor(worker.runtimeName).put(`${base}/manual/`, html('MANUAL'));
    expect(await (await worker.request(`${base}/manual/`))?.text()).toBe('MANUAL');
  });

  it.each(['/api/auth/profile', '/api', 'https://other.test/private'])('does not intercept or cache %s', async (path) => {
    const worker = workerHarness(app);
    expect(await worker.request(path, 'cors')).toBeUndefined();
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it('does not intercept writes or the other application scope', async () => {
    const worker = workerHarness(app);
    expect(await worker.request(`${base}/inspecciones`, 'cors', 'POST')).toBeUndefined();
    expect(await worker.request(app ? '/inspecciones/case-1' : '/app/inspecciones/case-1')).toBeUndefined();
  });

  it('always returns an offline response when no shell has been stored', async () => {
    const worker = workerHarness(app);
    expect((await worker.request(`${base}/inspecciones/case-1`))?.status).toBe(503);
  });

  it('does not cache HTML served at a JavaScript asset URL', async () => {
    const worker = workerHarness(app);
    worker.fetch.mockResolvedValue(html('HTML FALLBACK'));
    const asset = `${base}/assets/page-Ab_cd-12.js`;
    await worker.request(asset, 'cors');
    expect(await worker.cacheFor(worker.runtimeName).match(asset)).toBeUndefined();
  });

  it('restores a warmed JavaScript chunk with the correct MIME type offline', async () => {
    const worker = workerHarness(app);
    const asset = `${base}/assets/page-Ab_cd-12.js`;
    await worker.cacheFor(worker.runtimeName).put(asset, new Response('export {}', { headers: { 'Content-Type': 'application/javascript' } }));
    expect(await (await worker.request(asset, 'cors'))?.text()).toBe('export {}');
  });

  it('activation removes only its own old caches', async () => {
    const worker = workerHarness(app);
    worker.cacheFor('trazabilidad-rrpp-old');
    worker.cacheFor('runtime-cache-old');
    worker.cacheFor('sitrep-app-old');
    worker.cacheFor('sitrep-app-runtime-old');
    worker.cacheFor('other-feature');
    worker.cacheFor(worker.precacheName);
    worker.cacheFor(worker.runtimeName);
    await worker.activate();
    expect(worker.stores.has('other-feature')).toBe(true);
    expect(worker.stores.has(worker.precacheName)).toBe(true);
    expect(worker.stores.has(worker.runtimeName)).toBe(true);
    expect(worker.stores.has('sitrep-app-old')).toBe(!app);
    expect(worker.stores.has('trazabilidad-rrpp-old')).toBe(app);
  });
});

it('a public PWA navigation cannot overwrite the saved application shell', async () => {
  const worker = workerHarness(true);
  await worker.cacheFor(worker.precacheName).put('/app/index.html', html('APP SHELL'));
  worker.fetch.mockResolvedValue(html('PUBLIC PAGE'));
  expect(await (await worker.request('/app/public/notice.html'))?.text()).toBe('PUBLIC PAGE');
  expect(await (await worker.cacheFor(worker.precacheName).match('/app/index.html'))?.text()).toBe('APP SHELL');
});
