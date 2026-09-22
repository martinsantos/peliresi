import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// This suite always serves local builds and API fixtures on an ephemeral loopback
// port. PLAYWRIGHT_BASE_URL (whose repository default is production) is unused.
// Build first: npm run build && npx vite build --config vite.config.app.ts
test.use({ serviceWorkers: 'allow', screenshot: 'off', trace: 'off' });

const frontend = fileURLToPath(new URL('..', import.meta.url));
const sessionKey = 'sitrep_offline_session_v1';
const inspector = {
  id: 'inspector-sw-offline', nombre: 'María', apellido: 'Offline',
  email: 'inspector.offline@example.test', rol: 'ADMIN', activo: true,
  esInspector: true, empresa: 'Fiscalización local', forcePasswordChange: false,
};
const inspection = {
  id: 'inspection-sw-offline', numero: 'I-OFFLINE-000001', numeroActa: 'ACTA-OFFLINE-001',
  tipoActor: 'TRANSPORTISTA', estado: 'EN_CAMPO', inspectorId: inspector.id,
  inspector, version: 1, generador: null, operador: null,
  transportista: {
    id: 'transportista-sw-offline', razonSocial: 'Transporte de prueba local',
    cuit: '30-70812345-6', domicilio: 'Ruta de prueba 123', activo: true,
  },
  ubicacion: 'Ruta de prueba 123', observaciones: 'Expediente local para regresión offline.',
  iniciadaAt: '2026-09-22T12:00:00.000Z', createdAt: '2026-09-22T12:00:00.000Z',
  updatedAt: '2026-09-22T12:00:00.000Z', plazoRespuestaAt: null,
  items: [{
    id: 'offline-control', codigo: 'SEG-02', categoria: 'Seguridad',
    etiqueta: 'Señalización y elementos de emergencia operativos',
    resultado: 'NO_CUMPLE', orden: 10, obligatorio: true,
    observacion: 'Señalización pendiente de completar.', evidencias: [],
  }],
  comparaciones: [], evidencias: [], eventos: [],
};

function fixtureToken() {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    id: inspector.id, rol: inspector.rol,
    iat: Math.floor(Date.now() / 1_000), exp: Math.floor(Date.now() / 1_000) + 3_600,
  })}.local-fixture-signature`;
}

async function localFixtureServer() {
  let rejectProfile = false;
  let available = true;
  const requests: string[] = [];
  const blockedRequests: string[] = [];
  const contentTypes: Record<string, string> = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
    '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  };
  const json = (response: ServerResponse, body: unknown, status = 200) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body));
  };
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url || '/', 'http://127.0.0.1').pathname;
      // Chromium may still check worker-script updates in offline emulation.
      // Drop those sockets too: no server response can rescue the offline reload.
      if (!available) {
        blockedRequests.push(`${request.method} ${path}`);
        request.socket.destroy();
        return;
      }
      requests.push(`${request.method} ${path}`);
      if (path.startsWith('/api/')) {
        if (path === '/api/auth/profile') {
          return rejectProfile
            ? json(response, { success: false, message: 'Sesión revocada por el servidor local.' }, 401)
            : json(response, { success: true, data: { user: inspector } });
        }
        if (path === '/api/health') return json(response, { status: 'ok' });
        let data: unknown = [];
        if (path === `/api/inspecciones/${inspection.id}`) data = inspection;
        else if (path === `/api/inspecciones/${inspection.id}/intercambios`) {
          data = { inspeccion: inspection, parteActual: 'AUTORIDAD', intercambios: [], comunicacionExterna: false };
        } else if (path === '/api/notificaciones') data = { notificaciones: [], noLeidas: 0, total: 0 };
        return json(response, { success: true, data });
      }
      const isApp = path === '/app' || path.startsWith('/app/');
      const root = resolve(frontend, isApp ? 'dist-app' : 'dist');
      const relative = decodeURIComponent(isApp ? path.slice(4) : path).replace(/^\/+/, '');
      const target = resolve(root, relative || (isApp ? 'app.html' : 'index.html'));
      if (!target.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      // Match production SPA fallbacks, but never serve HTML for a missing asset.
      const file = existsSync(target) && extname(target)
        ? target : extname(target) ? null : join(root, isApp ? 'app.html' : 'index.html');
      if (!file) {
        response.writeHead(404).end();
        return;
      }
      const body = await readFile(file);
      response.writeHead(200, {
        'Content-Type': contentTypes[extname(file)] || 'application/octet-stream',
        // An HTTP cache must not disguise a missing service-worker cache entry.
        'Cache-Control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(500).end();
    }
  });
  await new Promise<void>((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveReady);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing local fixture port');
  return {
    origin: `http://127.0.0.1:${address.port}`, requests, blockedRequests,
    setAvailable: (value: boolean) => { available = value; },
    revokeSession: () => { rejectProfile = true; },
    close: () => new Promise<void>((resolveClosed, reject) => {
      server.close((error) => error ? reject(error) : resolveClosed());
      server.closeAllConnections();
    }),
  };
}

async function expectInspector(page: Page, app: boolean) {
  if (app) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await expect(page.getByText('María Offline', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  if (app) await page.getByRole('button', { name: 'Cerrar menu', exact: true }).click();
}

for (const app of [false, true]) {
  test(`${app ? 'PWA' : 'main'} reopens an inspection offline through the real service worker and rejects a revoked session`, async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== (app ? 'mobile' : 'chromium'), 'One matching desktop/mobile surface per project.');
    test.skip(!existsSync(join(frontend, 'dist/index.html')) || !existsSync(join(frontend, 'dist-app/app.html')),
      'Build the main frontend and PWA before running service-worker regressions.');
    test.setTimeout(60_000);
    const fixture = await localFixtureServer();
    const evidence = await mkdtemp(join(tmpdir(), `sitrep-offline-sw-${app ? 'pwa' : 'main'}-`));
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    try {
      const token = fixtureToken();
      // Seed credentials once. The production AuthProvider must create its own
      // offline profile after /auth/profile; no snapshot is injected by the test.
      await context.addInitScript(({ token }) => {
        if (localStorage.getItem('offline-sw-fixture-seeded')) return;
        localStorage.setItem('offline-sw-fixture-seeded', '1');
        localStorage.setItem('sitrep_access_token', token);
        localStorage.setItem('sitrep_refresh_token', 'local-fixture-refresh');
      }, { token });
      const route = `${app ? '/app' : ''}/inspecciones/${inspection.id}#checklist/SEG-02`;
      await page.goto(fixture.origin + route);
      await expect(page).toHaveTitle(/RP Trazar/);
      await expect(page.getByRole('heading', { name: inspection.numero, exact: true })).toBeVisible();
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL))
        .toBe(fixture.origin + (app ? '/app/sw-app.js' : '/sw.js'));

      // Exercise both activation orders across the two tests. Each worker must
      // retain the other surface's precache on their shared origin.
      const otherWorker = app ? { script: '/sw.js', scope: '/' } : { script: '/app/sw-app.js', scope: '/app/' };
      await page.evaluate(async ({ script, scope }) => {
        await navigator.serviceWorker.register(script, { scope });
      }, otherWorker);
      await expect.poll(() => page.evaluate(async (scope) =>
        (await navigator.serviceWorker.getRegistration(scope))?.active?.state, otherWorker.scope)).toBe('activated');
      const bothCaches = await page.evaluate(() => caches.keys());
      expect(bothCaches.some((name) => name.startsWith('trazabilidad-rrpp-'))).toBe(true);
      expect(bothCaches.some((name) => name.startsWith('sitrep-app-'))).toBe(true);

      // Initial navigation precedes worker control; reload online to cache the
      // actual entry module and all lazy inspection chunks under that worker.
      await page.reload();
      const comment = page.getByRole('textbox', { name: `Observación: ${inspection.items[0].etiqueta}`, exact: true });
      await expect(comment).toHaveValue(inspection.items[0].observacion);
      await expectInspector(page, app);
      const savedSession = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), sessionKey);
      expect(savedSession).toMatchObject({ version: 1, token, user: { id: inspector.id, nombre: 'María Offline', esInspector: true } });
      expect(savedSession.expiresAt).toBeGreaterThan(Date.now());
      expect(fixture.requests.filter((request) => request === 'GET /api/auth/profile').length).toBeGreaterThanOrEqual(2);

      const fieldComment = 'Comentario de campo conservado después de una recarga sin conexión.';
      await comment.fill(fieldComment);
      const draftKey = `sitrep_inspection_draft_${inspector.id}_${inspection.id}`;
      await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null')?.items[0]?.observacion, draftKey)).toBe(fieldComment);
      await page.waitForLoadState('networkidle');
      await context.setOffline(true);
      fixture.setAvailable(false);
      expect(await page.evaluate(() => navigator.onLine)).toBe(false);
      const requestsBeforeOfflineReload = fixture.requests.length;
      const offlineResponse = await page.reload({ waitUntil: 'domcontentloaded' });
      expect(offlineResponse?.fromServiceWorker()).toBe(true);
      await expect(page).toHaveURL(fixture.origin + route);
      await expect(page).toHaveTitle(/RP Trazar/);
      await expect(page.getByRole('heading', { name: inspection.numero, exact: true })).toBeVisible();
      await expect(comment).toHaveValue(fieldComment);
      await expect(comment).toBeEnabled();
      await expect(page.getByText(/Sin conexión · revisá/)).toBeVisible();
      await expectInspector(page, app);
      expect(fixture.requests.slice(requestsBeforeOfflineReload)).toEqual([]);
      expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), sessionKey)).toEqual(savedSession);
      await page.screenshot({ path: join(evidence, 'inspection-offline.png'), fullPage: false });

      const cacheKeys = await page.evaluate(async () => {
        const entries: Record<string, string[]> = {};
        for (const name of await caches.keys()) {
          entries[name] = (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname);
        }
        return entries;
      });
      expect(Object.values(cacheKeys).flat().some((key) => key.startsWith('/api/'))).toBe(false);
      fixture.revokeSession();
      fixture.setAvailable(true);
      await context.setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(page).toHaveURL(new RegExp(`${app ? '/app' : ''}/login(?:[?#].*)?$`));
      await expect(page.getByRole('heading', { name: inspection.numero, exact: true })).toHaveCount(0);
      await expect.poll(() => page.evaluate((key) => ({
        session: localStorage.getItem(key), access: localStorage.getItem('sitrep_access_token'), refresh: localStorage.getItem('sitrep_refresh_token'),
      }), sessionKey)).toEqual({ session: null, access: null, refresh: null });
      await page.screenshot({ path: join(evidence, 'revoked-session-login.png'), fullPage: false });
      expect(errors).toEqual([]);
      const unexpectedConsoleErrors = consoleErrors.filter((message) =>
        !/^Failed to load resource: net::ERR_INTERNET_DISCONNECTED$/.test(message)
        && !/^Failed to load resource: the server responded with a status of 401 \(Unauthorized\)$/.test(message));
      expect(unexpectedConsoleErrors).toEqual([]);
      testInfo.annotations.push({ type: 'offline-evidence', description: evidence });
      // Evidence contains only fixture paths and error text; screenshots stay in
      // the temporary directory instead of producing files inside the checkout.
      await writeFile(join(evidence, 'evidence.json'),
        JSON.stringify({ origin: fixture.origin, evidence, cacheKeys, requests: fixture.requests, blockedRequests: fixture.blockedRequests, errors, consoleErrors }, null, 2));
    } finally {
      await context.setOffline(false);
      await fixture.close();
    }
  });
}
