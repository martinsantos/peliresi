import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { assertCloudDatabase, backendRequire } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

const { PrismaClient } = backendRequire('@prisma/client');
let db: InstanceType<typeof PrismaClient>, users: Record<string, any>;
const phase = process.env.QA_FRESH_PHASE;
test.beforeAll(async () => {
  await assertCloudDatabase();
  expect(new URL(process.env.DATABASE_URL!).searchParams.get('schema')).toBe('proposal_operations_20261021');
  expect(process.env.QA_ARTIFACTS).toBe('/work/sitrep/.qa-fleet-freshness-20261030');
  expect(process.env.DISABLE_EMAILS).toBe('true'); expect(process.env.PUSH_MANIFEST_NOTICES_ENABLED).toBe('false');
  expect(['before', 'after']).toContain(phase);
  db = new PrismaClient(); users = {};
  for (const name of ['generador', 'transportista', 'operador']) {
    const email = `${name}@night-qa.invalid`;
    const user = await db.usuario.findUniqueOrThrow({ where: { email }, include: { generador: true, transportista: true, operador: true } });
    expect(user.email).toBe(email); expect(user.activo).toBe(true); users[name] = user;
    expect(user[name].razonSocial).toMatch(/^QA /);
  }
});
test.afterAll(async () => { await db?.$disconnect(); });

async function manifest() {
  return db.manifiesto.create({ data: { numero: 'QA-GPS-' + randomUUID().slice(0, 12), estado: 'EN_TRANSITO',
    generadorId: users.generador.generador.id, transportistaId: users.transportista.transportista.id, operadorId: users.operador.operador.id,
    creadoPorId: users.transportista.id, isDemoData: true, modalidad: 'FIJO', fechaRetiro: new Date(),
    asignacionTransporte: { version: 1, transportistaId: users.transportista.transportista.id, vehiculo: null, chofer: null } } });
}
async function installSensor(page: Page, heldLockId?: string) {
  await page.addInitScript((targetId: string | null) => {
    const now = Date.now.bind(Date); let offset = 0, watcher: PositionCallback | undefined, held = false, arm = false;
    let release: (() => void) | undefined;
    Date.now = () => now() + offset;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition(callback: PositionCallback) { watcher = callback; return 1; }, clearWatch() { watcher = undefined; },
    } });
    if (targetId) {
      const original = navigator.locks;
      Object.defineProperty(navigator, 'locks', { configurable: true, value: {
        query: original.query.bind(original),
        request(name: string, options: LockOptions, callback: LockGrantedCallback<unknown>) {
          return original.request(name, options, async lock => {
            if (name === 'sitrep:gps:' + targetId && arm) {
              arm = false; held = true; await new Promise<void>(resolve => { release = resolve; }); held = false;
            }
            return callback(lock);
          });
        },
      } });
    }
    (window as any).qaFresh = {
      arm: () => { arm = true; }, holding: () => held, release: () => release?.(), advance: (ms: number) => { offset += ms; },
      ready: () => !!watcher,
      emit: () => watcher?.({ coords: { latitude: -33.21, longitude: -68.91, accuracy: 10, speed: null, heading: null, altitude: null, altitudeAccuracy: null }, timestamp: Date.now() } as GeolocationPosition),
    };
  }, heldLockId || null);
}
async function openFleet(page: Page, info: TestInfo, item: { numero: string }) {
  await page.goto(prefix(info) + '/transporte/cargas');
  await page.getByRole('searchbox', { name: 'Número de manifiesto' }).fill(item.numero);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('checkbox', { name: `Llevo ${item.numero} en este móvil` }).check();
  await page.getByRole('button', { name: 'Iniciar GPS', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).qaFresh.ready())).toBe(true);
}
async function stored(page: Page, id: string) {
  return page.evaluate(manifestId => Object.entries(localStorage).filter(([key]) => key.startsWith('sitrep_fleet_gps_v1:'))
    .map(([, raw]) => JSON.parse(raw)).filter(value => JSON.parse(value.targetKey)[1] === 'MANIFIESTO:' + manifestId), id);
}

test('a point that expires while waiting for its lock is not sent as current', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const item = await manifest(); await installSensor(page, item.id); await login(page, info, 'transportista');
  await openFleet(page, info, item); await page.evaluate(() => (window as any).qaFresh.arm());
  let posts = 0; page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith(`/manifiestos/${item.id}/ubicacion-idempotente`)) posts++; });
  await page.evaluate(() => (window as any).qaFresh.emit());
  await expect.poll(() => page.evaluate(() => (window as any).qaFresh.holding())).toBe(true);
  await page.evaluate(() => { (window as any).qaFresh.advance(61_000); (window as any).qaFresh.release(); });
  if (phase === 'before') {
    await expect.poll(() => posts).toBe(1);
    await expect.poll(() => db.trackingGPS.count({ where: { manifiestoId: item.id } })).toBe(1);
  } else {
    const area = page.getByRole('region', { name: 'Cargas marcadas' });
    await expect(area).toContainText('La ubicación dejó de ser reciente antes de este envío');
    expect(posts).toBe(0); expect(await db.trackingGPS.count({ where: { manifiestoId: item.id } })).toBe(0);
    expect(await stored(page, item.id)).toHaveLength(1);
    await page.getByRole('button', { name: `Entregar ${item.numero}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirmar entrega' });
    await dialog.getByRole('button', { name: 'Confirmar entrega de esta carga' }).click();
    await expect(dialog.getByRole('alert')).toContainText(/ubicación pendiente/i);
    expect((await db.manifiesto.findUniqueOrThrow({ where: { id: item.id } })).estado).toBe('EN_TRANSITO');
    await page.screenshot({ path: info.outputPath('pendiente-conservado.png'), animations: 'disabled' });
  }
  expect(errors).toEqual([]);
});

if (phase === 'after') test('stopping GPS during a wait keeps the unsent point and does not dispatch it', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const item = await manifest(); await installSensor(page, item.id); await login(page, info, 'transportista');
  await openFleet(page, info, item); await page.evaluate(() => (window as any).qaFresh.arm());
  let posts = 0; page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith(`/manifiestos/${item.id}/ubicacion-idempotente`)) posts++; });
  await page.evaluate(() => (window as any).qaFresh.emit());
  await expect.poll(() => page.evaluate(() => (window as any).qaFresh.holding())).toBe(true);
  await page.getByRole('button', { name: 'Detener GPS' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar GPS' })).toBeVisible();
  await page.evaluate(() => (window as any).qaFresh.release());
  await expect.poll(async () => (await stored(page, item.id)).length).toBe(1);
  expect(posts).toBe(0); expect(await db.trackingGPS.count({ where: { manifiestoId: item.id } })).toBe(0);
  await page.getByRole('button', { name: `Entregar ${item.numero}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirmar entrega' });
  await dialog.getByRole('button', { name: 'Confirmar entrega de esta carga' }).click();
  await expect(dialog.getByRole('alert')).toContainText(/ubicación pendiente/i);
  expect(errors).toEqual([]);
});

test('a late confirmation is not shown as a recent fleet position', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const item = await manifest(); await installSensor(page); await login(page, info, 'transportista');
  let committed = false, release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/manifiestos/${item.id}/ubicacion-idempotente`, async intercepted => {
    const response = await intercepted.fetch(); expect(response.status()).toBe(200); committed = true;
    await held; await intercepted.fulfill({ response });
  });
  try {
    await openFleet(page, info, item); await page.evaluate(() => (window as any).qaFresh.emit());
    await expect.poll(() => committed).toBe(true);
    await page.evaluate(() => (window as any).qaFresh.advance(61_000)); release();
    const area = page.getByRole('region', { name: 'Cargas marcadas' });
    await expect(area).toContainText(phase === 'before' ? 'GPS recibido' : 'SITREP confirmó una ubicación anterior');
    expect(await db.trackingGPS.count({ where: { manifiestoId: item.id } })).toBe(1);
    if (phase === 'after') {
      expect(await stored(page, item.id)).toHaveLength(0);
      await area.screenshot({ path: info.outputPath('confirmacion-anterior.png'), animations: 'disabled' });
    }
    expect(errors).toEqual([]);
  } finally { release(); }
});

test('a late relay confirmation is not shown as current', async ({ browser }, info) => {
  const errors: string[] = [];
  const item = await manifest(), source = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', serviceWorkers: 'block' });
  const external = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.name === 'app' ? { width: 393, height: 844 } : { width: 1440, height: 900 }, serviceWorkers: 'block' });
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  try {
    const driver = await source.newPage(); driver.on('pageerror', error => errors.push(error.message)); await login(driver, info, 'transportista');
    const token = await driver.evaluate(() => localStorage.getItem('sitrep_access_token')); expect(token).toBeTruthy();
    const handoff = await driver.request.post(`/api/manifiestos/${item.id}/tramos`, { headers: { Authorization: 'Bearer ' + token },
      data: { id: randomUUID(), anteriorId: null, tipo: 'EXTERNO', datos: { empresa: 'QA relevo externo' }, motivo: 'QA espera y confirmación GPS' } });
    expect(handoff.status()).toBe(201); const { tramo, acceso } = (await handoff.json()).data;
    const relay = await external.newPage(); relay.on('pageerror', error => errors.push(error.message)); await installSensor(relay); await isolatedMapTiles(relay, info);
    let committed = false;
    await relay.route(`**/api/seguimiento-relevo/${tramo.id}/ubicacion-idempotente`, async intercepted => {
      const response = await intercepted.fetch(); expect(response.status()).toBe(200); committed = true;
      await held; await intercepted.fulfill({ response });
    });
    await relay.goto(prefix(info) + `/relevo/${tramo.id}#${acceso}`);
    await relay.getByRole('button', { name: 'Compartir ubicación' }).click();
    await expect.poll(() => relay.evaluate(() => (window as any).qaFresh.ready())).toBe(true);
    await relay.evaluate(() => (window as any).qaFresh.emit()); await expect.poll(() => committed).toBe(true);
    await relay.evaluate(() => (window as any).qaFresh.advance(61_000)); release();
    await expect(relay.getByRole('status')).toContainText(phase === 'before' ? 'Ubicación recibida por SITREP' : 'SITREP confirmó una ubicación anterior');
    expect(await db.trackingGPS.count({ where: { manifiestoId: item.id, tramoId: tramo.id } })).toBe(1);
    if (phase === 'after') {
      expect(await relay.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await relay.screenshot({ path: info.outputPath('relevo-confirmacion-anterior.png'), animations: 'disabled' });
    }
    expect(errors).toEqual([]);
  } finally { release(); await external.close(); await source.close(); }
});
