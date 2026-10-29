import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { isolatedMapTiles, prefix } from './helpers';

test('one phone tracks three selected loads, delivers one and isolates a subsequent handoff', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'fleet-private.json'), 'utf8'));
  const loads = fixture.cases[info.project.name], mp = prefix(info);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport, deviceScaleFactor: 1,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow',
    timezoneId: 'America/Argentina/Mendoza', permissions: ['geolocation'], geolocation: { latitude: -33.2, longitude: -68.9 } });
  const page = await context.newPage(), errors: string[] = [], uploads: Record<string, number> = {};
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message)); await isolatedMapTiles(page, info);
  await page.addInitScript(() => {
    localStorage.setItem('sitrep_onboarding_TRANSPORTISTA', 'true');
    const original = navigator.geolocation.watchPosition.bind(navigator.geolocation);
    (window as any).qaGpsWatchCount = 0;
    navigator.geolocation.watchPosition = (...args) => { (window as any).qaGpsWatchCount++; return original(...args); };
  });
  page.on('response', response => { if (response.request().method() === 'POST' && response.url().endsWith('/ubicacion')) {
    const match = response.url().match(/\/(manifiestos|seguimiento-relevo)\/([^/]+)\/ubicacion$/);
    if (match && response.status() === 200) uploads[match[2]] = (uploads[match[2]] || 0) + 1;
  } });
  try {
    await page.goto(mp + '/login'); await page.getByLabel('Correo electrónico o CUIT').fill(fixture.users.origin.email); await page.getByLabel('Contraseña', { exact: true }).fill(fixture.password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click(); await expect(page).not.toHaveURL(/\/login$/);
    const skip = page.getByRole('button', { name: 'Saltar introducción', exact: true }); if (await skip.isVisible()) await skip.click();
    await page.goto(mp + '/transporte/perfil');
    const tripCount = await page.getByRole('heading', { name: /^En tránsito: \d+ manifiestos?$/ }).getAttribute('aria-label');
    const total = tripCount?.match(/^En tránsito: (\d+) manifiestos?$/)?.[1];
    expect(total).toBeTruthy();
    await expect(page.getByText(`${total} en tránsito`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'GPS de mis viajes', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/transporte/cargas$'));
    const find = async (number: string) => { await page.getByRole('searchbox', { name: 'Número de manifiesto', exact: true }).fill(number); await page.getByRole('button', { name: 'Buscar', exact: true }).click(); };
    await find(loads.prefix);
    for (const load of [loads.a, loads.b, loads.incoming]) await page.getByRole('checkbox', { name: `Llevo ${load.numero} en este móvil`, exact: true }).check();
    await page.getByRole('button', { name: 'Iniciar GPS', exact: true }).click();
    await expect.poll(() => [loads.a.id, loads.b.id, loads.incoming.tramoId].every(id => uploads[id] === 1)).toBe(true);
    expect(await page.evaluate(() => (window as any).qaGpsWatchCount)).toBe(1);
    const selected = page.getByRole('region', { name: 'Cargas marcadas', exact: true }); await expect(selected).toContainText('GPS recibido');
    await page.getByRole('button', { name: 'Elegir otras cargas', exact: true }).click(); await find('QA-NO-EXISTE');
    await expect(page.getByText('No hay cargas en tránsito con ese número.', { exact: true })).toBeVisible();
    for (const load of [loads.a, loads.b, loads.incoming]) await expect(selected).toContainText(load.numero);
    await page.getByRole('button', { name: `Entregar ${loads.a.numero}`, exact: true }).click();
    const delivered = page.waitForResponse(r => r.url().endsWith(`/manifiestos/${loads.a.id}/confirmar-entrega`) && r.request().method() === 'POST');
    await page.getByRole('dialog', { name: 'Confirmar entrega', exact: true }).getByRole('button', { name: 'Confirmar entrega de esta carga', exact: true }).click();
    expect((await delivered).status()).toBe(200); await expect(selected.getByText(loads.a.numero, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Cerrar selección', exact: true }).click();
    await context.setGeolocation({ latitude: -33.21, longitude: -68.91 });
    await expect.poll(() => uploads[loads.b.id], { timeout: 45000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(() => uploads[loads.incoming.tramoId], { timeout: 10000 }).toBeGreaterThanOrEqual(2);
    expect(uploads[loads.a.id]).toBe(1); expect(await page.evaluate(() => (window as any).qaGpsWatchCount)).toBe(1);
    await selected.evaluate(element => element.scrollIntoView({ block: 'center' }));
    await selected.screenshot({ path: info.outputPath('fleet-gps-received.png') });
    if(info.project.name==='app'){
      const last=selected.getByText('Entrega a cargo de la transportista de origen.',{exact:true});await last.scrollIntoViewIfNeeded();
      const clearance=await last.evaluate(element=>({text:element.getBoundingClientRect().bottom,nav:document.querySelector('nav[aria-label="Navegación principal"]')!.getBoundingClientRect().top}));
      expect(clearance.text).toBeLessThanOrEqual(clearance.nav);
      expect(await page.locator('header').getByRole('button',{name:/Ayuda|soporte/i}).count()).toBeGreaterThan(0);
    }
    const token = await page.evaluate(() => localStorage.getItem('sitrep_access_token'));
    const handoff = await page.request.post(`/api/manifiestos/${loads.b.id}/tramos`, { headers: { Authorization: 'Bearer ' + token }, data: {
      id: randomUUID(), anteriorId: null, tipo: 'EXTERNO', datos: {}, motivo: 'Rotura ficticia mientras siguen otras cargas en el mismo móvil',
    } });
    expect(handoff.status()).toBe(201);
    await context.setGeolocation({ latitude: -33.22, longitude: -68.92 });
    await expect.poll(() => uploads[loads.incoming.tramoId], { timeout: 45000 }).toBeGreaterThanOrEqual(3);
    await expect(selected.getByRole('button',{name:'Reintentar GPS',exact:true})).toHaveCount(0); await expect(selected).toContainText('El GPS de este manifiesto continúa desde el enlace del transporte de reemplazo');
    expect(uploads[loads.a.id]).toBe(1); expect(await page.evaluate(() => (window as any).qaGpsWatchCount)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await selected.evaluate(element => element.scrollIntoView({ block: 'center' })); await selected.screenshot({ path: info.outputPath('fleet-active-loads.png') });
    await page.getByRole('button', { name: 'Detener GPS', exact: true }).click();
    await page.goto(mp + '/notificaciones');
    await page.getByRole('button', { name: 'Opciones de avisos', exact: true }).click();
    const device = page.getByRole('region', { name: 'Avisos del dispositivo', exact: true });
    await expect(device).toContainText('Este canal todavía no está habilitado');
    await expect(page.getByRole('list', { name: 'Avisos', exact: true })).toContainText('Cambio de transporte en tránsito');
    await device.screenshot({ path: info.outputPath('device-notifications-off.png') });
    expect(errors).toEqual([]);
  } finally { await context.close().catch(() => {}); }
});
