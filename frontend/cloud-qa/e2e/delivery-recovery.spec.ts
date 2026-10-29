import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
const fixture = () => JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'delivery-recovery-private.json'), 'utf8'));
const contextOptions = (info: TestInfo) => ({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
  isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'block' as const });
async function installGps(page: Page) {
  await page.addInitScript(() => {
    let watch: PositionCallback | undefined;
    (window as any).__deliveryGps = { ready: () => !!watch, emit: () => watch?.({ coords: { latitude: -33.7, longitude: -68.7,
      accuracy: 10, speed: null, heading: null, altitude: null, altitudeAccuracy: null }, timestamp: Date.now() } as GeolocationPosition) };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition(callback: PositionCallback) { watch = callback; return 1; },
      getCurrentPosition() {}, clearWatch() { watch = undefined; },
    } });
  });
}
async function queueFor(page: Page, manifestId: string) {
  return page.evaluate(async id => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('sitrep_offline_db', 5);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try { return await new Promise<any[]>((resolve, reject) => {
      const request = db.transaction('sync_queue', 'readonly').objectStore('sync_queue').getAll();
      request.onsuccess = () => resolve(request.result.filter((item: any) => item.endpoint.includes(`/manifiestos/${id}/confirmar-entrega`)));
      request.onerror = () => reject(request.error);
    }); } finally { db.close(); }
  }, manifestId);
}

test('individual delivery recovers a lost response with the same reference', async ({ browser }, info) => {
  const manifest = fixture().cases[info.project.name].individual, context = await browser.newContext(contextOptions(info));
  const page = await context.newPage(), payloads: any[] = [], statuses: number[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message)); await installGps(page);
  try {
    await login(page, info, 'transportista'); if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(page.getByText(manifest.numero, { exact: true })).toBeVisible();
    await page.route(`**/api/manifiestos/${manifest.id}/confirmar-entrega-idempotente`, async route => {
      payloads.push(route.request().postDataJSON()); const response = await route.fetch(); statuses.push(response.status());
      if (payloads.length === 1) await route.abort('failed'); else await route.fulfill({ response });
    });
    await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
    await page.getByRole('dialog', { name: 'Confirmar Entrega?', exact: true }).getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true }).click();
    await expect(page.getByText('Entrega confirmada exitosamente', { exact: true })).toBeVisible({ timeout: 30_000 });
    expect(statuses).toEqual([200, 200]); expect(payloads).toHaveLength(2);
    expect(payloads[0].referencia).toBe(payloads[1].referencia); expect(await queueFor(page, manifest.id)).toEqual([]);
    expect(errors).toEqual([]); await page.screenshot({ path: info.outputPath('entrega-recuperada.png'), animations: 'disabled' });
    writeFileSync(info.outputPath('individual-proof.json'), JSON.stringify({ surface: info.project.name, synthetic: true, responseLost: true, statuses, sameReference: true }));
  } finally { await context.close(); }
});

test('offline delivery survives closing and verifies a response lost after reconnection', async ({ browser }, info) => {
  const manifest = fixture().cases[info.project.name].offline, context = await browser.newContext(contextOptions(info));
  const page = await context.newPage(), payloads: any[] = [], statuses: number[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message)); await installGps(page);
  try {
    await login(page, info, 'transportista'); if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`); await expect(page.getByText(manifest.numero, { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(id => Object.keys(localStorage).some(key => {
      if (!key.startsWith('viaje_snapshot_v2_')) return false;
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      return saved.id === id && typeof saved.handoffActive === 'boolean';
    }), manifest.id)).toBe(true);
    // A different account's pending delivery must stop GPS and this account's
    // delivery until the original context resolves it; do not replay it here.
    const foreignId = await page.evaluate(async id => {
      const db = await new Promise<IDBDatabase>((resolve,reject) => { const r = indexedDB.open('sitrep_offline_db',5); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
      try { return await new Promise<IDBValidKey>((resolve,reject) => {
        const tx=db.transaction('sync_queue','readwrite'); const r=tx.objectStore('sync_queue').add({type:'POST',endpoint:`/manifiestos/${id}/confirmar-entrega-idempotente`,data:{referencia:'qa-foreign'},userId:'qa-foreign-account',contextOwner:'qa-foreign-context',createdAt:new Date().toISOString()});
        let key:IDBValidKey | undefined; r.onsuccess=()=>{key=r.result;}; tx.oncomplete=()=>key === undefined ? reject(new Error('No se guardó la entrega artificial')) : resolve(key); tx.onerror=()=>reject(tx.error);
      }); } finally { db.close(); window.dispatchEvent(new Event('sitrep:offline-queue-changed')); }
    }, manifest.id);
    await expect(page.getByText(/Hay una entrega guardada en otra cuenta o actividad/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar entrega', exact: true })).toHaveCount(0);
    await page.getByText(/Hay una entrega guardada en otra cuenta o actividad/).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('entrega-otra-actividad.png'), animations: 'disabled' });
    await page.evaluate(async key => {
      const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('sitrep_offline_db',5);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      try { await new Promise<void>((resolve,reject)=>{const tx=db.transaction('sync_queue','readwrite');tx.objectStore('sync_queue').delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);}); }
      finally { db.close();window.dispatchEvent(new Event('sitrep:offline-queue-changed')); }
    }, foreignId);
    await expect(page.getByRole('button', { name: 'Confirmar entrega', exact: true })).toBeEnabled();
    await context.setOffline(true); await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await expect(page.getByText('Último estado guardado.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar entrega', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
    await page.getByRole('dialog', { name: 'Confirmar Entrega?', exact: true }).getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true }).click();
    await expect.poll(() => queueFor(page, manifest.id)).toHaveLength(1);
    await expect(page.getByRole('status').filter({ hasText: 'Entrega guardada. Se intentará enviar o comprobar al sincronizar' })).toBeVisible();
    await expect(page.getByText('Viaje activo', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Entrega pendiente', { exact: true }).last()).toBeVisible();
    await page.getByRole('status').filter({ hasText: 'Entrega guardada. Se intentará enviar o comprobar al sincronizar' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('entrega-sin-conexion-guardada.png'), animations: 'disabled' });
    const saved = await queueFor(page, manifest.id); expect(saved).toHaveLength(1); expect(saved[0].data.referencia).toBeTruthy();
    await page.close();
    await context.route(`**/api/manifiestos/${manifest.id}/confirmar-entrega-idempotente`, async route => {
      payloads.push(route.request().postDataJSON()); const response = await route.fetch(); statuses.push(response.status());
      if (payloads.length === 1) await route.abort('failed'); else await route.fulfill({ response });
    });
    await context.setOffline(false);
    const reopened = await context.newPage(); reopened.on('pageerror', error => errors.push(error.message));
    if (info.project.name === 'app') await reopened.setViewportSize({ width: 320, height: 800 });
    await reopened.goto(`${prefix(info)}/dashboard`);
    const notice = reopened.getByRole('status').filter({ hasText: 'No recibimos confirmación de la entrega' });
    await expect(notice).toBeVisible({ timeout: 30_000 }); expect(statuses).toEqual([200]);
    expect((await queueFor(reopened, manifest.id))[0].data.referencia).toBe(saved[0].data.referencia);
    await notice.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect.poll(() => queueFor(reopened, manifest.id), { timeout: 30_000 }).toEqual([]);
    expect(statuses).toEqual([200, 200]); expect(payloads[0].referencia).toBe(payloads[1].referencia);
    expect(errors).toEqual([]); await reopened.screenshot({ path: info.outputPath('entrega-sin-conexion-recuperada.png'), animations: 'disabled' });
    writeFileSync(info.outputPath('offline-proof.json'), JSON.stringify({ surface: info.project.name, synthetic: true, closedAndReopened: true, responseLost: true, statuses, sameReference: true }));
  } finally { await context.close(); }
});

test('manifest detail reports a recovered delivery instead of a false failure', async ({ browser }, info) => {
  const manifest = fixture().cases[info.project.name].detail, context = await browser.newContext(contextOptions(info));
  const page = await context.newPage(), payloads: any[] = [], statuses: number[] = []; await installGps(page);
  try {
    // Transportista intentionally opens the trip page for an active manifest;
    // administration uses the manifest detail and can confirm delivery there.
    await login(page, info, 'admin'); if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${prefix(info)}/manifiestos/${manifest.id}`);
    const button = page.getByRole('button', { name: 'Confirmar Entrega', exact: true }); await expect(button).toBeEnabled();
    await page.route(`**/api/manifiestos/${manifest.id}/confirmar-entrega-idempotente`, async route => {
      payloads.push(route.request().postDataJSON()); const response = await route.fetch(); statuses.push(response.status());
      if (payloads.length === 1) await route.abort('failed'); else await route.fulfill({ response });
    });
    await button.click(); await expect(page.getByText('Entrega confirmada exitosamente', { exact: true })).toBeVisible({ timeout: 30_000 });
    expect(statuses).toEqual([200, 200]); expect(payloads[0].referencia).toBe(payloads[1].referencia);
    expect(await queueFor(page, manifest.id)).toEqual([]);
    writeFileSync(info.outputPath('detail-proof.json'), JSON.stringify({ surface: info.project.name, synthetic: true, responseLost: true, statuses, sameReference: true }));
  } finally { await context.close(); }
});

test('fleet delivery recovers its result while another selected load continues', async ({ browser }, info) => {
  const cases = fixture().cases[info.project.name], first = cases['fleet-a'], second = cases['fleet-b'];
  const context = await browser.newContext(contextOptions(info)), page = await context.newPage(), payloads: any[] = [], statuses: number[] = [];
  await installGps(page);
  try {
    await login(page, info, 'transportista'); if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${prefix(info)}/transporte/cargas`);
    await page.getByRole('searchbox', { name: 'Número de manifiesto' }).fill(first.numero.slice(0, -'FLEET-A'.length));
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    for (const load of [first, second]) { const checkbox = page.getByRole('checkbox', { name: `Llevo ${load.numero} en este móvil`, exact: true });
      await expect(checkbox).toBeEnabled(); await checkbox.check(); }
    await page.getByRole('button', { name: 'Iniciar GPS', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__deliveryGps.ready())).toBe(true);
    await page.evaluate(() => (window as any).__deliveryGps.emit());
    await expect(page.getByRole('region', { name: 'Cargas marcadas' }).getByRole('status').filter({ hasText: 'GPS recibido' })).toHaveCount(2);
    await page.route(`**/api/manifiestos/${first.id}/confirmar-entrega-idempotente`, async route => {
      payloads.push(route.request().postDataJSON()); const response = await route.fetch(); statuses.push(response.status());
      if (payloads.length === 1) await route.abort('failed'); else await route.fulfill({ response });
    });
    await page.getByRole('button', { name: `Entregar ${first.numero}`, exact: true }).click();
    await page.getByRole('dialog', { name: 'Confirmar entrega', exact: true }).getByRole('button', { name: 'Confirmar entrega de esta carga', exact: true }).click();
    const selected = page.getByRole('region', { name: 'Cargas marcadas' });
    await expect(selected).not.toContainText(first.numero, { timeout: 30_000 }); await expect(selected).toContainText(second.numero);
    expect(statuses).toEqual([200, 200]); expect(payloads[0].referencia).toBe(payloads[1].referencia);
    expect(await queueFor(page, first.id)).toEqual([]);
    writeFileSync(info.outputPath('fleet-proof.json'), JSON.stringify({ surface: info.project.name, synthetic: true, responseLost: true, statuses, sameReference: true, otherLoadRetained: true }));
  } finally { await context.close(); }
});

test('a second tab sees the pending delivery and refreshes after confirmation', async ({ browser }, info) => {
  const manifest = fixture().cases[info.project.name].tabs, context = await browser.newContext(contextOptions(info));
  const first = await context.newPage(), second = await context.newPage(), payloads: any[] = [];
  let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  try {
    await login(first, info, 'admin');
    if (info.project.name === 'app') { await first.setViewportSize({ width: 320, height: 800 }); await second.setViewportSize({ width: 320, height: 800 }); }
    await first.goto(`${prefix(info)}/manifiestos/${manifest.id}`); await second.goto(`${prefix(info)}/manifiestos/${manifest.id}`);
    const a = first.getByRole('button', { name: 'Confirmar Entrega', exact: true });
    const b = second.getByRole('button', { name: 'Confirmar Entrega', exact: true });
    await expect(a).toBeEnabled(); await expect(b).toBeEnabled();
    // Either tab may acquire the shared queue lock first. Intercept both so
    // the test checks the pending state regardless of which tab sends.
    await context.route(`**/api/manifiestos/${manifest.id}/confirmar-entrega-idempotente`, async route => {
      payloads.push(route.request().postDataJSON()); await gate; await route.continue();
    });
    await a.click(); await expect.poll(() => payloads.length).toBe(1);
    await expect(b).toBeDisabled();
    await expect(second.getByText('Hay una entrega guardada en este dispositivo. Revisá la sincronización antes de continuar.')).toBeVisible();
    const saved = await queueFor(second, manifest.id); expect(saved).toHaveLength(1); expect(saved[0].data.referencia).toBe(payloads[0].referencia);
    release();
    await expect(first.getByText('Entrega confirmada exitosamente', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(b).toHaveCount(0, { timeout: 30_000 });
    await expect(second.getByText('Entregado', { exact: true }).first()).toBeVisible();
    expect(await queueFor(second, manifest.id)).toEqual([]); expect(payloads).toHaveLength(1);
    writeFileSync(info.outputPath('tabs-proof.json'), JSON.stringify({ surface: info.project.name, synthetic: true, pendingVisibleInSecondTab: true, refreshedAfterConfirmation: true, oneSavedCommand: true, oneRequest: true }));
  } finally { release(); await context.close(); }
});

test('concurrent retries accept one delivery and reject changed data', async ({ browser }, info) => {
  const manifest = fixture().cases[info.project.name].concurrent, context = await browser.newContext(contextOptions(info));
  const page = await context.newPage();
  try {
    await login(page, info, 'transportista'); const token = await page.evaluate(() => localStorage.getItem('sitrep_access_token')); expect(token).toBeTruthy();
    const reference = randomUUID(), url = `/api/manifiestos/${manifest.id}/confirmar-entrega-idempotente`;
    const body = { referencia: reference, observaciones: 'Entrega artificial concurrente', latitud: -33.1, longitud: -68.1 };
    const send = () => page.request.post(url, { headers: { Authorization: `Bearer ${token}` }, data: body });
    const settled = await Promise.allSettled(Array.from({ length: 8 }, send));
    const responses = settled.filter((value): value is PromiseFulfilledResult<import('@playwright/test').APIResponse> => value.status === 'fulfilled').map(value => value.value);
    const failures = settled.length - responses.length;
    for (let i = 0; i < failures; i++) responses.push(await send());
    expect(responses.map(response => response.status())).toEqual(Array(8).fill(200));
    const data = await Promise.all(responses.map(async response => (await response.json()).data));
    expect(data.every(item => item.idempotencia.referencia === reference && item.manifiesto.id === manifest.id)).toBe(true);
    expect(data.filter(item => item.idempotencia.repetido === false).length).toBeLessThanOrEqual(1);
    const conflict = await page.request.post(url, { headers: { Authorization: `Bearer ${token}` }, data: { ...body, latitud: -33.2 } });
    expect(conflict.status()).toBe(409);
    const another = await page.request.post(url, { headers: { Authorization: `Bearer ${token}` }, data: { ...body, referencia: randomUUID() } });
    expect(another.status()).toBe(400);
    const otherContext = await browser.newContext(contextOptions(info)), other = await otherContext.newPage();
    try {
      await login(other, info, 'transportista2'); const otherToken = await other.evaluate(() => localStorage.getItem('sitrep_access_token'));
      const denied = await other.request.post(url, { headers: { Authorization: `Bearer ${otherToken}` }, data: body });
      expect(denied.status()).toBe(404);
    } finally { await otherContext.close(); }
    writeFileSync(info.outputPath('concurrent-proof.json'), JSON.stringify({ surface: info.project.name, synthetic: true, concurrent: 8, failures, conflict: 409, newReferenceAfterDelivery: 400, foreignCarrier: 404 }));
  } finally { await context.close(); }
});
