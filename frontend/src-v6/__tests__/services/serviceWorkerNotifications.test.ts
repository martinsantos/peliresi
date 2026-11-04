import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';

function worker(app: boolean, clientUrls: string[]) {
  const origin = 'https://sitrep.test', handlers = new Map<string, (event: any) => void>();
  const windows = clientUrls.map(url => {
    const client = { url: origin + url, navigate: vi.fn(), focus: vi.fn().mockResolvedValue(undefined) };
    client.navigate.mockResolvedValue(client);
    return client;
  });
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

it.each([false, true])('waits for navigation before focusing an existing window (app=%s)', async app => {
  const test = worker(app, [app ? '/app/dashboard' : '/dashboard']);
  let finish!: (value: typeof test.windows[number]) => void;
  test.windows[0].navigate.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  let complete = false;
  const click = test.event('notificationclick', { notification: { close: vi.fn(), data: { url: '/notificaciones/qa' } } })
    .then(() => { complete = true; });
  await vi.waitFor(() => expect(test.windows[0].navigate).toHaveBeenCalledOnce());
  await Promise.resolve();
  expect(complete).toBe(false);
  expect(test.windows[0].focus).not.toHaveBeenCalled();
  finish(test.windows[0]);
  await click;
  expect(test.windows[0].focus).toHaveBeenCalledOnce();
  expect(test.clients.openWindow).not.toHaveBeenCalled();
});

it.each([false, true])('opens a window if the previous window cannot be navigated (app=%s)', async app => {
  const test = worker(app, [app ? '/app/dashboard' : '/dashboard']);
  test.windows[0].navigate.mockResolvedValueOnce(null);
  await test.event('notificationclick', { notification: { close: vi.fn(), data: { url: '/notificaciones/qa?origen=aviso#detalle' } } });
  expect(test.clients.openWindow).toHaveBeenCalledWith(`https://sitrep.test${app ? '/app' : ''}/notificaciones/qa?origen=aviso#detalle`);
  expect(test.windows[0].focus).not.toHaveBeenCalled();
});

it.each([false, true])('opens a window if navigation rejects (app=%s)', async app => {
  const test = worker(app, [app ? '/app/dashboard' : '/dashboard']);
  const rejected = Promise.reject(new Error('window closed'));
  void rejected.catch(() => {});
  test.windows[0].navigate.mockReturnValueOnce(rejected);
  await test.event('notificationclick', { notification: { close: vi.fn(), data: { url: '/notificaciones/qa' } } });
  expect(test.clients.openWindow).toHaveBeenCalledWith(`https://sitrep.test${app ? '/app' : ''}/notificaciones/qa`);
});

it.each([false, true])('tries a new window when the navigated window cannot be focused (app=%s)', async app => {
  const test = worker(app, [app ? '/app/dashboard' : '/dashboard']);
  test.windows[0].focus.mockRejectedValueOnce(new Error('window no longer focusable'));
  await test.event('notificationclick', { notification: { close: vi.fn(), data: { url: '/notificaciones/qa' } } });
  expect(test.clients.openWindow).toHaveBeenCalledWith(`https://sitrep.test${app ? '/app' : ''}/notificaciones/qa`);
});

it('reuses an app window at its scope root', async () => {
  const test = worker(true, ['/app']);
  await test.event('notificationclick', { notification: { close: vi.fn(), data: { url: '/notificaciones/qa' } } });
  expect(test.windows[0].navigate).toHaveBeenCalledWith('https://sitrep.test/app/notificaciones/qa');
  expect(test.clients.openWindow).not.toHaveBeenCalled();
});

it('keeps same-origin absolute links in the installed app, including query and fragment', async () => {
  const test = worker(true, []);
  await test.event('notificationclick', { notification: { close: vi.fn(), data: { url: 'https://sitrep.test/manifiestos/qa?adenda=1#anexo' } } });
  expect(test.clients.openWindow).toHaveBeenCalledWith('https://sitrep.test/app/manifiestos/qa?adenda=1#anexo');
});

it('does not duplicate the app prefix on an absolute app destination', async () => {
  const test = worker(true, []);
  await test.event('notificationclick', { notification: { close: vi.fn(), data: { url: 'https://sitrep.test/app?source=notice' } } });
  expect(test.clients.openWindow).toHaveBeenCalledWith('https://sitrep.test/app/?source=notice');
});

it.each([false, true])('tries a new window if client enumeration fails (app=%s)', async app => {
  const test = worker(app, []);
  test.clients.matchAll.mockRejectedValueOnce(new Error('client list unavailable'));
  await test.event('notificationclick', { notification: { close: vi.fn(), data: { url: '/notificaciones/qa' } } });
  expect(test.clients.openWindow).toHaveBeenCalledWith(`https://sitrep.test${app ? '/app' : ''}/notificaciones/qa`);
});

it.each([false, true])('uses its own home for malformed or foreign destinations (app=%s)', async app => {
  for (const url of [null, { unexpected: true }, 'https://untrusted.invalid/path', '//untrusted.invalid/path']) {
    const test = worker(app, []);
    await test.event('notificationclick', { notification: { close: vi.fn(), data: { url } } });
    expect(test.clients.openWindow).toHaveBeenCalledWith(`https://sitrep.test${app ? '/app/' : '/'}`);
  }
});
