import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { prefix } from './helpers';
import { trainingLogin as login, publishedTraining } from '../training-login';
import { approveExceptionalJourney } from '../exceptional-journey';

async function role(page: Page, info: TestInfo, category: string, n: number) {
  const back = page.getByRole('button', { name: 'Volver a mi cuenta', exact: true });
  if (await back.isVisible()) { await back.click(); await expect(page).toHaveURL(/\/switch-user\?modo=capacitacion$/); }
  await page.goto(prefix(info) + '/switch-user?modo=capacitacion');
  const group = page.getByRole('region', { name: category, exact: true });
  await expect(group.getByRole('button', { name: /^Ver como CAP/ })).toHaveCount(5);
  const changed = page.waitForResponse(r => r.url().includes('/admin/training/impersonate/') && r.request().method() === 'POST');
  await group.getByRole('button', { name: /^Ver como CAP/ }).nth(n - 1).click();
  expect((await changed).status()).toBe(200);
  await expect(page.getByText('Capacitación · sin validez oficial', { exact: false }).first()).toBeVisible();
}
async function choose(page: Page, name: string, option: RegExp) {
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('option', { name: option }).click();
}
async function headers(page: Page) { return { Authorization: 'Bearer ' + await page.evaluate(() => localStorage.getItem('sitrep_access_token')) }; }
async function proof(page: Page, info: TestInfo, name: string) {
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath(name + '.png'), animations: 'disabled', fullPage: true });
}
const team = (info: TestInfo) => publishedTraining ? 5 : ['web-desktop', 'web-responsive', 'app'].indexOf(info.project.name) + 1;

test('school creates a manifest with registered fleet; an addendum preserves its declaration and requires another party', async ({ page }, info) => {
  test.setTimeout(180000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await login(page, info);
  if (!publishedTraining) {
    await page.goto(prefix(info) + '/manifiestos');
    await expect(page.getByRole('link', { name: 'Eventuales', exact: true })).toHaveCount(0);
  }
  const n = team(info); await role(page, info, 'Generadores', n);
  await page.goto(prefix(info) + '/manifiestos/nuevo');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await choose(page, 'Tipo de Residuo *', /^Y-CAP/);
  await page.getByLabel('Cantidad *', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await choose(page, 'Transportista *', new RegExp('^CAP · Transporte ' + n));
  await choose(page, 'Vehículo (opcional)', new RegExp('^CAP00' + n));
  await choose(page, 'Chofer (opcional)', new RegExp('^Chofer ficticio ' + n));
  await choose(page, 'Operador / Destino *', new RegExp('^CAP · Operador ' + n));
  await proof(page, info, 'training-fleet');
  const creating = page.waitForResponse(r => r.url().endsWith('/api/manifiestos') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear Manifiesto', exact: true }).click();
  const created = await creating; expect(created.status()).toBe(201); expect(created.headers()['x-sitrep-training']).toBe('true');
  expect(created.request().postDataJSON()).toMatchObject({ vehiculoId: `cap-20261012-vehiculo-${n}`, choferId: `cap-20261012-chofer-${n}` });
  const manifest = (await created.json()).data.manifiesto;
  await expect(page).toHaveURL(new RegExp('/manifiestos/' + manifest.id + '$'));
  await page.reload(); await expect(page.getByText('Chofer ficticio ' + n, { exact: true })).toBeVisible();
  const original = (await (await page.request.get('/api/manifiestos/' + manifest.id, { headers: await headers(page) })).json()).data.manifiesto;
  await page.getByRole('button', { name: 'Firmar Manifiesto', exact: true }).click();
  const signature = page.getByRole('dialog', { name: 'Firma del manifiesto', exact: true });
  const canvas = signature.locator('canvas'); await canvas.scrollIntoViewIfNeeded(); const b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + b.width * .1, b.y + b.height * .5); await page.mouse.down();
  for (const [x,y] of [[.2,.2],[.4,.6],[.6,.2],[.8,.7]]) await page.mouse.move(b.x + b.width*x,b.y+b.height*y,{steps:5});
  await page.mouse.up(); await signature.getByRole('button', { name: 'Usar firma', exact: true }).click();
  const signing = page.waitForResponse(r => r.url().endsWith('/' + manifest.id + '/firmar') && r.request().method() === 'POST');
  await signature.getByRole('button', { name: 'Confirmar y Firmar', exact: true }).click(); expect((await signing).status()).toBe(200);
  await role(page, info, 'Transportistas', n); await page.goto(prefix(info) + '/manifiestos/' + manifest.id);
  await page.getByRole('link', { name: 'Adendas y revisión posterior', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar diferencia', exact: true }).click();
  await page.getByLabel('Corriente observada 1', { exact: true }).fill('Y1');
  await page.getByLabel('Cantidad observada 1', { exact: true }).fill('12');
  await page.getByLabel('Motivo de la adenda', { exact: true }).fill('CAP: carga observada distinta, sin modificar declaración');
  const saving = page.waitForResponse(r => r.url().endsWith('/' + manifest.id + '/adendas') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Guardar y solicitar revisión', exact: true }).click();
  const saved = await saving; expect(saved.status()).toBe(201); const adenda = (await saved.json()).data.adenda;
  expect(adenda.impersonadoPorId).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Aprobar post facto', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Descargar anexo v0', exact: true })).toBeDisabled();
  expect((await page.request.get(`/api/manifiestos/${manifest.id}/adendas/${adenda.id}/anexo`, { headers: await headers(page) })).status()).toBe(403);
  await role(page, info, 'Generadores', n); await page.goto(prefix(info) + '/manifiestos/' + manifest.id + '/adendas');
  await page.getByLabel('Motivo de resolución', { exact: true }).fill('CAP: contraparte revisó la diferencia; no modifica el original');
  const reviewing = page.waitForResponse(r => r.url().endsWith('/revisiones') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Aprobar post facto', exact: true }).click();
  const reviewed = await reviewing; expect(reviewed.status()).toBe(200);
  expect((await reviewed.json()).data.adenda.revisiones[0].impersonadoPorId).toBe(adenda.impersonadoPorId);
  await page.reload(); await expect(page.getByRole('status', { name: 'Estado de revisión' })).toHaveText('Aprobada post facto');
  await expect(page.getByText('Y-CAP · 10 kg', { exact: true })).toBeVisible();
  await expect(page.getByText('Y1 · 12 kg', { exact: true })).toBeVisible();
  const after = (await (await page.request.get('/api/manifiestos/' + manifest.id, { headers: await headers(page) })).json()).data.manifiesto;
  expect(after.residuos).toEqual(original.residuos); expect(after.estado).toBe('APROBADO');
  await proof(page, info, 'training-addendum');
  await role(page, info, 'Transportistas', n); await page.goto(prefix(info) + '/manifiestos/' + manifest.id);
  const retired = page.waitForResponse(r => r.url().endsWith('/confirmar-retiro') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirmar retiro', exact: true }).click(); expect((await retired).status()).toBe(200);
  await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
  const delivered = page.waitForResponse(r => r.url().endsWith('/confirmar-entrega') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true }).click(); expect((await delivered).status()).toBe(200);
  await role(page, info, 'Operadores', n); await page.goto(prefix(info) + '/manifiestos/' + manifest.id);
  const received = page.waitForResponse(r => r.url().endsWith('/confirmar-recepcion') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirmar Recepcion', exact: true }).click(); expect((await received).status()).toBe(200);
  await page.getByRole('button', { name: 'Registrar Tratamiento', exact: true }).click();
  const treatment = page.getByRole('dialog', { name: 'Registrar Tratamiento', exact: true });
  await treatment.getByPlaceholder('Observaciones del tratamiento...').fill('CAP: tratamiento ficticio, sin validez oficial');
  const treated = page.waitForResponse(r => r.url().endsWith('/tratamiento') && r.request().method() === 'POST');
  await treatment.getByRole('button', { name: 'Confirmar Tratamiento', exact: true }).click(); expect((await treated).status()).toBe(200);
  const closed = page.waitForResponse(r => r.url().endsWith('/cerrar') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Cerrar Manifiesto', exact: true }).click(); expect((await closed).status()).toBe(200);
  await page.reload(); await expect(page.getByRole('button', { name: 'Descargar Certificado', exact: true })).toBeDisabled();
  await proof(page, info, 'training-new-manifest-closed'); expect(errors).toEqual([]);
});

test('school eventual tolerates missing external identity, requires linked approvals, then records facts and independent review', async ({ page }, info) => {
  test.setTimeout(180000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await login(page, info); const n = team(info); await role(page, info, 'Generadores', n);
  await page.goto(prefix(info) + '/manifiestos'); await page.getByRole('link', { name: 'Eventuales', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar operación', exact: true }).click();
  await page.getByRole('button', { name: 'Operador · Buscar en padrón', exact: true }).click();
  await page.getByLabel('Operador del padrón', { exact: true }).click();
  await page.getByRole('option', { name: new RegExp('^CAP · Operador ' + n + ' ·') }).click();
  await page.getByLabel('Corriente', { exact: true }).fill('Y1'); await page.getByLabel('Cantidad', { exact: true }).fill('10');
  await page.getByLabel('Motivo del registro excepcional', { exact: true }).fill('CAP: identidad externa pendiente, datos ficticios');
  const creating = page.waitForResponse(r => r.url().endsWith('/api/manifiestos/baja-intensidad') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Guardar operación', exact: true }).click();
  const response = await creating; expect(response.status()).toBe(201);
  const record = (await response.json()).data.registro; expect(record.numeroOficial).toBeNull();
  expect(record.datos.transportista).toMatchObject({ nombre: '', identificacion: '', domicilio: '' });
  await approveExceptionalJourney(page, 'quien lo creó');
  await expect(page.getByRole('button', { name: 'Registrar retirado', exact: true })).toBeDisabled();
  if (!publishedTraining) {
    await role(page, info, 'Operadores', 5);
    expect((await page.request.get('/api/manifiestos/baja-intensidad/' + record.id, { headers: await headers(page) })).status()).toBe(404);
  }
  await role(page, info, 'Operadores', n); await page.goto(prefix(info) + '/manifiestos/baja-intensidad?registro=' + record.id);
  await approveExceptionalJourney(page, 'operador');
  await expect(page.getByText('Aprobación de las partes: aprobado', { exact: true })).toBeVisible();
  await role(page, info, 'Generadores', n); await page.goto(prefix(info) + '/manifiestos/baja-intensidad?registro=' + record.id);
  for (const stage of ['retirado', 'recibido', 'tratado']) {
    const movement = page.waitForResponse(r => r.url().endsWith('/eventos') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Registrar ' + stage, exact: true }).click(); expect((await movement).status()).toBe(200);
  }
  await page.getByLabel('Nota de la acción', { exact: true }).fill('CAP: revisión de evidencia ficticia');
  const requested = page.waitForResponse(r => r.url().endsWith('/eventos') && r.request().method() === 'POST');
  await page.getByRole('region', { name: 'Revisión original', exact: true }).getByRole('button', { name: 'Solicitar revisión', exact: true }).click(); expect((await requested).status()).toBe(200);
  await role(page, info, 'Operadores', n); await page.goto(prefix(info) + '/manifiestos/baja-intensidad?registro=' + record.id);
  await page.getByLabel('Nota de la acción', { exact: true }).fill('CAP: faltan datos externos por completar');
  const reviewing = page.waitForResponse(r => r.url().endsWith('/eventos') && r.request().method() === 'POST');
  await page.getByRole('region', { name: 'Revisión original', exact: true }).getByRole('button', { name: 'Observar', exact: true }).click(); expect((await reviewing).status()).toBe(200);
  await page.reload(); await expect(page.getByRole('status', { name: 'Estado operativo' })).toHaveText('Operación: Tratado');
  await expect(page.getByRole('region', { name: 'Revisión original', exact: true })).toContainText('Observada');
  await proof(page, info, 'training-eventual'); expect(errors).toEqual([]);
});

test('school Centro de Control and Monitor show synthetic trips; new manual guide renders without regressions', async ({ page }, info) => {
  test.setTimeout(120000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await login(page, info); await role(page, info, 'Administradores', team(info));
  const activity = page.waitForResponse(r => r.url().includes('/api/centro-control/actividad'));
  await page.goto(prefix(info) + '/centro-control'); const response = await activity;
  expect(response.status()).toBe(200); expect(response.headers()['x-sitrep-training']).toBe('true');
  const control = (await response.json()).data;
  expect(control.enTransito.some((trip: any) => trip.numero === 'CAP-1-EN_TRANSITO' && trip.ultimaPosicion)).toBe(true);
  const layers = page.getByRole('group', { name: 'Capas del mapa', exact: true });
  const transit = layers.getByRole('button', { name: 'En Tránsito', exact: true });
  await expect(transit).toHaveAttribute('aria-pressed', 'true');
  await transit.click(); await expect(transit).toHaveAttribute('aria-pressed', 'false');
  await transit.click(); await expect(transit).toHaveAttribute('aria-pressed', 'true');
  const agenda = page.getByRole('region', { name: 'Agenda y viajes', exact: true });
  await agenda.getByPlaceholder('Buscar por número o transportista...').fill('CAP-1-EN_TRANSITO');
  const trip = agenda.getByRole('button', { name: 'Seleccionar viaje CAP-1-EN_TRANSITO', exact: true });
  await trip.click(); await expect(trip).toHaveAttribute('aria-expanded', 'true');
  await expect(agenda.getByRole('button', { name: 'Ver detalle del viaje', exact: true })).toBeVisible();
  await proof(page, info, 'training-control');
  const live = page.waitForResponse(r => r.url().includes('/api/centro-control/monitor-live'));
  await page.goto(prefix(info) + '/monitor'); const liveResponse = await live; expect(liveResponse.status()).toBe(200);
  await expect(page.getByRole('status', { name: 'Modo capacitación', exact: true })).toBeInViewport({ ratio: 1 });
  expect((await liveResponse.json()).data.enTransito.some((row: any) => row.numero === 'CAP-1-EN_TRANSITO')).toBe(true);
  const timeline = page.waitForResponse(r => r.url().includes('/api/centro-control/timeline?'));
  await page.getByRole('button', { name: 'Historial', exact: true }).click();
  const history = await timeline; expect(history.status()).toBe(200);
  const eventCount = (await history.json()).data.eventos.filter((event: any) => event.type === 'EVENTO').length; expect(eventCount).toBeGreaterThan(1);
  // The preceding manifest journey supplies actual events; GPS alone is not a movie.
  // A named step action pauses playback without racing the automatic start
  // against a button whose accessible name changes between Play and Pause.
  await page.getByRole('button', { name: 'Siguiente evento', exact: true }).click();
  const pause = page.getByRole('button', { name: 'Pausar historial', exact: true });
  const scrubber = page.getByRole('slider', { name: 'Recorrer historial', exact: true });
  await scrubber.focus(); await scrubber.press('End'); await expect(scrubber).toHaveValue('1000');
  await scrubber.press('Home');
  await expect(scrubber).toHaveValue(String(Math.round(1000 / eventCount)));
  await expect(page.getByText('1 / ' + eventCount, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reproducir historial', exact: true }).click();
  await pause.click(); await proof(page, info, 'training-monitor');
  const forecast = page.waitForResponse(r => r.url().includes('/api/centro-control/forecast'));
  await page.getByRole('button', { name: 'Pendientes', exact: true }).click(); expect((await forecast).status()).toBe(200);
  await expect(page.getByText('Retiros pendientes', { exact: true })).toBeVisible();
  await page.goto('/manual/'); await page.getByRole('link', { name: 'Eventuales, adendas y transporte', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Eventuales, adendas y transporte · práctica simple', exact: true })).toBeVisible();
  await expect(page.getByText('El original sigue intacto', { exact: false })).toBeVisible(); await proof(page, info, 'training-manual-new'); expect(errors).toEqual([]);
});
