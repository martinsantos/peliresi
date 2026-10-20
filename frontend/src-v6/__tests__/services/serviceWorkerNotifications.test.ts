import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';

function worker(app: boolean, clientUrls: string[]) {
  const origin = 'https://sitrep.test', handlers = new Map<string, (event: any) => void>();
  const windows = clientUrls.map(url => ({ url: origin + url, navigate: vi.fn().mockResolvedValue(undefined), focus: vi.fn().mockResolvedValue(undefined) }));
  const clients = { matchAll: vi.fn().mockResolvedValue(windows), openWindow: vi.fn().mockResolvedValue(undefined) };
  const showNotification = vi.fn().mockResolvedValue(undefined);
  vm.runInNewContext(readFileSync(`public/${app ? 'sw-app.js' : 'sw.js'}`, 'utf8'), {
    self: { location: { origin }, addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler), registration: { showNotification } },
    clients, URL, importScripts: vi.fn(), console: { log: vi.fn() },
  });
  return { windows, clients, showNotification,
    async event(name: string, data: Record<string, unknown>) { let work: Promise<unknown> | undefined; handlers.get(name)!({ ...data, waitUntil: (promise: Promise<unknown>) => { work = promise; } }); await work; },
  };
}

it('opens an adenda inside the installed app and leaves web tabs in place', async () => {
  const test = worker(true, ['/dashboard', '/app/dashboard']);
  await test.event('notificationclick', { notification: { close: vi.fn(), data: { url: '/manifiestos/qa/adendas' } } });
  expect(test.windows[0].navigate).not.toHaveBeenCalled();
  expect(test.windows[1].navigate).toHaveBeenCalledWith('https://sitrep.test/app/manifiestos/qa/adendas');
  expect(test.windows[1].focus).toHaveBeenCalledOnce();
});
it('opens a web notice in a web tab, preserving a separate driver app', async () => {
  const test = worker(false, ['/app/transporte/cargas', '/dashboard']);
  await test.event('notificationclick', { notification: { close: vi.fn(), data: { url: '/manifiestos/qa' } } });
  expect(test.windows[0].navigate).not.toHaveBeenCalled();
  expect(test.windows[1].navigate).toHaveBeenCalledWith('https://sitrep.test/manifiestos/qa');
});
it('creates the correct app window when none is open and never opens an external target from a web notice', async () => {
  const app = worker(true, ['/dashboard']);
  await app.event('notificationclick', { notification: { close: vi.fn(), data: { url: '/transporte/perfil' } } });
  expect(app.clients.openWindow).toHaveBeenCalledWith('https://sitrep.test/app/transporte/perfil');
  const web = worker(false, []);
  await web.event('notificationclick', { notification: { close: vi.fn(), data: { url: 'https://untrusted.invalid' } } });
  expect(web.clients.openWindow).toHaveBeenCalledWith('https://sitrep.test/');
});
it.each([false, true])('renders an actionable system alert with deterministic tag (app=%s)', async app => {
  const test = worker(app, []);
  await test.event('push', { data: { json: () => ({ title: 'Adenda aprobada', body: 'Revisá el anexo', url: '/manifiestos/qa/adendas', tag: 'notification:qa', prioridad: 'ALTA' }) } });
  expect(test.showNotification).toHaveBeenCalledWith('Adenda aprobada', expect.objectContaining({ tag: 'notification:qa', renotify: true, vibrate: [200, 100, 200], data: expect.objectContaining({ url: '/manifiestos/qa/adendas' }) }));
});
