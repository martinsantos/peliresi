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
  const matchClients = vi.fn().mockResolvedValue([]);
  vm.runInNewContext(source, {
    self: { location: { origin }, addEventListener: (name: string, listener: (event: WorkerEvent) => void) => listeners.set(name, listener), clients: { claim: vi.fn(), matchAll: matchClients }, skipWaiting },
    caches, fetch, URL, Response, console: { log: vi.fn(), warn: vi.fn() },
    importScripts: vi.fn(),
  });
  const precacheName = app ? 'sitrep-app-test' : /const CACHE_NAME = '([^']+)'/.exec(source)![1];
  const runtimeName = app ? 'sitrep-app-runtime-test' : /const RUNTIME_CACHE = '([^']+)'/.exec(source)![1];
  return {
    fetch, caches, stores, cacheFor, precacheName, runtimeName, skipWaiting, matchClients,
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

  it.each([404, 503, 200])('keeps the exact warmed release asset when the server returns %s instead of its module', async (status) => {
    const worker = workerHarness(app);
    const asset = `${base}/assets/page-Ab_cd-12.js`;
    await worker.cacheFor(worker.runtimeName).put(asset, new Response('export const version = "installed"', { headers: { 'Content-Type': 'application/javascript' } }));
    worker.fetch.mockResolvedValue(new Response('unavailable page', { status, headers: { 'Content-Type': 'text/html' } }));
    const response = await worker.request(asset, 'cors');
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe('export const version = "installed"');
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it('returns an explicit offline response for an unseen release module without substituting another version', async () => {
    const worker = workerHarness(app);
    await worker.cacheFor(worker.runtimeName).put(`${base}/assets/page-OldVer12.js`, new Response('old module', {headers: {'Content-Type':'application/javascript'}}));
    const response = await worker.request(`${base}/assets/page-NewVer12.js`, 'cors');
    expect(response?.status).toBe(408);
    expect(await response?.text()).not.toContain('old module');
  });

  it('replaces an invalid cached module only with a valid network module', async () => {
    const worker = workerHarness(app), asset = `${base}/assets/page-Ab_cd-12.js`;
    await worker.cacheFor(worker.runtimeName).put(asset, html('INVALID CACHE'));
    worker.fetch.mockResolvedValue(new Response('valid module', {headers: {'Content-Type':'application/javascript'}}));
    expect(await (await worker.request(asset, 'cors'))?.text()).toBe('valid module');
    expect(await (await worker.cacheFor(worker.runtimeName).match(asset))?.text()).toBe('valid module');
  });

  it.each(['icon-192.png', 'icon-512.png'])('restores its installed %s before any runtime image request', async (icon) => {
    const worker = workerHarness(app), url = `${base}/${icon}`;
    const bytes = new Uint8Array(readFileSync('public/' + icon));
    await worker.cacheFor(worker.precacheName).put(url, new Response(bytes, { headers: { 'Content-Type': 'image/png' } }));
    expect(await worker.cacheFor(worker.runtimeName).match(url)).toBeUndefined();
    const response = await worker.request(url, 'cors');
    expect(response?.status).toBe(200);
    expect(response?.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await response!.arrayBuffer())).toEqual(bytes);
    expect(worker.fetch).toHaveBeenCalledOnce();
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

it('uses the last downloaded app manifest offline instead of the initial precache', async () => {
  const worker = workerHarness(true), url = '/app/manifest-app.json';
  const json = (body: string) => new Response(body, { headers: { 'Content-Type': 'application/json' } });
  await worker.cacheFor(worker.precacheName).put(url, json('{"version":"initial"}'));
  worker.fetch.mockResolvedValueOnce(json('{"version":"updated"}'));
  expect(await (await worker.request(url, 'cors'))?.json()).toEqual({ version: 'updated' });
  worker.fetch.mockRejectedValueOnce(new TypeError('Offline'));
  expect(await (await worker.request(url, 'cors'))?.json()).toEqual({ version: 'updated' });
});

it('uses the precached app manifest offline before its first refresh', async () => {
  const worker = workerHarness(true), url = '/app/manifest-app.json';
  await worker.cacheFor(worker.precacheName).put(url, new Response('{"version":"installed"}', { headers: { 'Content-Type': 'application/json' } }));
  expect(await (await worker.request(url, 'cors'))?.json()).toEqual({ version: 'installed' });
});

it('keeps an installed app shell when the network serves a newer release', async () => {
  const worker = workerHarness(true);
  await worker.cacheFor(worker.precacheName).put('/app/index.html', html('INSTALLED SHELL'));
  worker.fetch.mockResolvedValue(html('NEW RELEASE SHELL'));
  expect(await (await worker.request('/app/'))?.text()).toBe('INSTALLED SHELL');
  expect(await (await worker.cacheFor(worker.precacheName).match('/app/index.html'))?.text()).toBe('INSTALLED SHELL');
  expect(worker.fetch).toHaveBeenCalledOnce();
});

it('passes a server error through instead of disguising it as the saved app', async () => {
  const worker = workerHarness(true);
  await worker.cacheFor(worker.precacheName).put('/app/index.html', html('INSTALLED SHELL'));
  worker.fetch.mockResolvedValue(new Response('Maintenance', { status: 503 }));
  const response = await worker.request('/app/inspecciones');
  expect(response?.status).toBe(503);
  expect(await response?.text()).toBe('Maintenance');
});

it('lets the installed router resolve a missing app route without changing its shell', async () => {
  const worker = workerHarness(true);
  await worker.cacheFor(worker.precacheName).put('/app/index.html', html('INSTALLED SHELL'));
  worker.fetch.mockResolvedValue(new Response('Not found', { status: 404 }));
  expect(await (await worker.request('/app/inspecciones'))?.text()).toBe('INSTALLED SHELL');
});

it('keeps exact old app assets usable while another app window stays open', async () => {
  const worker = workerHarness(true);
  const oldUrl = '/app/assets/Inspection-OldVer12.js';
  await worker.cacheFor('sitrep-app-runtime-old').put(oldUrl, new Response('old exact module', { headers: { 'Content-Type': 'application/javascript' } }));
  worker.cacheFor('sitrep-app-old');
  worker.matchClients.mockResolvedValue([{ url: origin + '/app/dashboard' }]);
  await worker.activate();
  expect(worker.stores.has('sitrep-app-old')).toBe(true);
  expect(worker.stores.has('sitrep-app-runtime-old')).toBe(true);
  expect(await (await worker.request(oldUrl, 'cors'))?.text()).toBe('old exact module');
  expect(worker.fetch).not.toHaveBeenCalled();
  expect((await worker.request('/app/assets/Inspection-NewVer12.js', 'cors'))?.status).toBe(408);
});

it('keeps exact old web assets usable while another web window stays open', async () => {
  const worker = workerHarness(false);
  const oldUrl = '/assets/Inspection-OldVer12.js';
  await worker.cacheFor('runtime-cache-old').put(oldUrl, new Response('old exact web module', { headers: { 'Content-Type': 'application/javascript' } }));
  worker.cacheFor('trazabilidad-rrpp-old');
  worker.matchClients.mockResolvedValue([{ url: origin + '/manifiestos' }]);
  await worker.activate();
  expect(worker.stores.has('trazabilidad-rrpp-old')).toBe(true);
  expect(worker.stores.has('runtime-cache-old')).toBe(true);
  expect(await (await worker.request(oldUrl, 'cors'))?.text()).toBe('old exact web module');
  expect(worker.fetch).not.toHaveBeenCalled();
  expect((await worker.request('/assets/Inspection-NewVer12.js', 'cors'))?.status).toBe(408);
});

it('does not recover a web asset from an app cache', async () => {
  const worker = workerHarness(false);
  const url = '/assets/Inspection-OldVer12.js';
  await worker.cacheFor('sitrep-app-runtime-old').put(url, new Response('wrong scope', { headers: { 'Content-Type': 'application/javascript' } }));
  await worker.cacheFor('runtime-cache-old').put(url, html('not a script'));
  expect((await worker.request(url, 'cors'))?.status).toBe(408);
});

it('does not recover an app asset from a web cache or from invalid cached HTML', async () => {
  const worker = workerHarness(true);
  const url = '/app/assets/Inspection-OldVer12.js';
  await worker.cacheFor('runtime-cache-old').put(url, new Response('wrong scope', { headers: { 'Content-Type': 'application/javascript' } }));
  await worker.cacheFor('sitrep-app-runtime-old').put(url, html('not a script'));
  expect((await worker.request(url, 'cors'))?.status).toBe(408);
});

it('retains old app caches if the browser cannot enumerate open windows', async () => {
  const worker = workerHarness(true);
  worker.cacheFor('sitrep-app-old');
  worker.matchClients.mockRejectedValue(new Error('clients unavailable'));
  await worker.activate();
  expect(worker.stores.has('sitrep-app-old')).toBe(true);
});

it('retains old web caches if the browser cannot enumerate open windows', async () => {
  const worker = workerHarness(false);
  worker.cacheFor('runtime-cache-old');
  worker.matchClients.mockRejectedValue(new Error('clients unavailable'));
  await worker.activate();
  expect(worker.stores.has('runtime-cache-old')).toBe(true);
});

it('can retire old app caches when only web windows remain', async () => {
  const worker = workerHarness(true);
  worker.cacheFor('sitrep-app-old');
  worker.cacheFor('trazabilidad-rrpp-old');
  worker.matchClients.mockResolvedValue([{ url: origin + '/dashboard' }]);
  await worker.activate();
  expect(worker.stores.has('sitrep-app-old')).toBe(false);
  expect(worker.stores.has('trazabilidad-rrpp-old')).toBe(true);
});

it('can retire old web caches when only app windows remain', async () => {
  const worker = workerHarness(false);
  worker.cacheFor('runtime-cache-old');
  worker.cacheFor('sitrep-app-old');
  worker.matchClients.mockResolvedValue([{ url: origin + '/app/dashboard' }]);
  await worker.activate();
  expect(worker.stores.has('runtime-cache-old')).toBe(false);
  expect(worker.stores.has('sitrep-app-old')).toBe(true);
});
