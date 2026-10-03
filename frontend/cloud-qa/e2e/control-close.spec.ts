import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { login, prefix } from './helpers';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

function earliestSyntheticSlot() {
  const raw=execFileSync('psql',['-U','qa','-h','127.0.0.1','-p','55440','-d','sitrep_night_qa_20260926','-X','-tA','-c',`SELECT json_build_object('database',current_database(),'host',inet_server_addr(),'port',inet_server_port(),'first',COALESCE(min("fechaProgramada"),now())) FROM inspecciones`],{encoding:'utf8'});
  const row=JSON.parse(raw.trim()); assert.equal(row.database,'sitrep_night_qa_20260926'); assert.equal(row.host,'127.0.0.1'); assert.equal(row.port,55440);
  // Stable first-page fixture even after repeated suites; production order is unchanged.
  return new Date(new Date(row.first).getTime()-2*86400000).toISOString().slice(0,16);
}

const consoleLogs = new WeakMap<Page, Array<{ level: string; message: string }>>();
test.afterEach(async ({ page }, info) => {
  await info.attach('console-health', { body: JSON.stringify(consoleLogs.get(page) || [], null, 2), contentType: 'application/json' });
});
function health(page: Page) {
  const errors: string[] = [];
  const messages: Array<{ level: string; message: string }> = [];
  consoleLogs.set(page, messages);
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) messages.push({ level: message.type(), message: message.text() });
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  return errors;
}
async function visibleProof(page: Page, info: TestInfo, name: string) {
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(name + '.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test('control center queries real layers, refreshes and opens the exact active inspection', async ({ page }, info) => {
  await login(page, info);
  const errors = health(page);
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('GENERADOR');
  await page.getByRole('combobox', { name: 'Actor inspeccionado', exact: true }).selectOption({ label: 'QA Generador 2' });
  // Put this scheduled fixture before the many existing undated QA drafts.
  // The operational list is legitimately ordered by scheduled date, not newest ID.
  await page.getByLabel('Fecha programada', { exact: true }).fill(earliestSyntheticSlot());
  const creation = page.waitForResponse(r => r.url().endsWith('/api/inspecciones') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  const saved = await creation;
  expect(saved.status()).toBe(201);
  const inspection = (await saved.json()).data;
  const start = page.waitForResponse(r => r.url().endsWith(`/inspecciones/${inspection.id}/estado`) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Iniciar visita', exact: true }).click();
  expect((await start).status()).toBe(200);
  const activity = page.waitForResponse(r => r.url().includes('/api/centro-control/actividad') && r.status() === 200);
  const operations = page.waitForResponse(r => r.url().includes('/api/inspecciones/operaciones') && r.status() === 200);
  await page.goto(`${prefix(info)}/centro-control`);
  const stats = (await (await activity).json()).data;
  const agenda = (await (await operations).json()).data;
  expect(agenda.items.some((r: { id: string }) => r.id === inspection.id)).toBe(true);
  await expect(page.getByText('Total Manifiestos', { exact: true })).toBeVisible();
  await expect(page.getByText('Total Manifiestos', { exact: true }).locator('..')).toContainText(String(stats.estadisticas.totalManifiestos));
  if (info.project.name !== 'app') {
    const header = page.getByRole('banner');
    const title = header.getByRole('heading', { name: 'Centro de Control', exact: true });
    const headerBox = (await header.boundingBox())!;
    const titleBox = (await title.boundingBox())!;
    expect(headerBox.height).toBe(64);
    await expect(title).toHaveCSS('white-space', 'nowrap');
    expect(titleBox.y).toBeGreaterThanOrEqual(headerBox.y);
    expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height);
    for (const button of await header.getByRole('button').all()) {
      if (!await button.isVisible()) continue;
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual((await page.evaluate(() => innerWidth)) + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(headerBox.y + headerBox.height);
    }
    await visibleProof(page, info, 'stable-header-after');
  }
  const legend = page.getByRole('list', { name: 'Tipos de elementos en el mapa', exact: true });
  await expect(legend).toHaveCount(1); // Only the legend for the current viewport is exposed.
  for (const [label, glyph] of [
    ['Generadores', 'factory'], ['Transportistas', 'truck'],
    ['Operadores', 'flask-conical'], ['Inspecciones', 'clipboard-check'],
  ]) {
    const entry = legend.getByRole('listitem').filter({ hasText: label });
    await expect(entry).toBeVisible();
    await expect(entry.locator('svg.lucide-' + glyph)).toHaveCount(1);
    await expect(entry.locator('polygon')).toHaveCount(0);
  }
  await legend.scrollIntoViewIfNeeded();
  const bounds = (await legend.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual((await page.evaluate(() => innerWidth)) + 1);
  if (page.viewportSize()!.width < 640) {
    const mapBounds = (await page.locator('.leaflet-container').boundingBox())!;
    // The mobile legend must follow the map rather than obscure its markers.
    expect(bounds.y).toBeGreaterThanOrEqual(mapBounds.y + mapBounds.height - 1);
    expect(bounds.x).toBeGreaterThanOrEqual(mapBounds.x - 1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width + 1);
  }
  await visibleProof(page, info, 'map-legend-after');
  const layer = page.getByRole('button', { name: 'Generadores', exact: true });
  await expect(layer).toHaveAttribute('aria-pressed', 'true');
  const changed = page.waitForResponse(r => r.url().includes('/api/centro-control/actividad') && !new URL(r.url()).searchParams.get('capas')?.includes('generadores') && r.status() === 200);
  await layer.click();
  await changed;
  await expect(layer).toHaveAttribute('aria-pressed', 'false');
  const refreshed = page.waitForResponse(r => r.url().includes('/api/centro-control/actividad') && r.status() === 200);
  await page.getByTitle('Actualizar ahora', { exact: true }).click();
  await refreshed;
  const inspectionPanel = page.locator('button[aria-expanded]').filter({ hasText: /^Inspecciones/ });
  await inspectionPanel.click();
  await expect(inspectionPanel).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: new RegExp(inspection.numero) }).click();
  await visibleProof(page, info, 'control-selected-inspection');
  await page.getByRole('button', { name: 'Abrir expediente', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/inspecciones/${inspection.id}`));
  await expect(page.getByRole('heading', { name: inspection.numero, exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('monitor LIVE, PLAYBACK and FORECAST query real data and expose usable controls', async ({ page }, info) => {
  test.setTimeout(90000);
  await login(page, info);
  const errors = health(page);
  await page.goto(`${prefix(info)}/centro-control`);
  const live = page.waitForResponse(r => r.url().includes('/api/centro-control/monitor-live'), { timeout: 15_000 });
  await page.goto(`${prefix(info)}/monitor`);
  await expect(page).toHaveURL(new RegExp(`${prefix(info)}/monitor$`));
  const liveResponse = await live;
  expect(liveResponse.status()).toBe(200);
  const liveData = (await liveResponse.json()).data;
  expect(Number.isFinite(liveData.estadisticas.total)).toBe(true);
  const mappedCarriers=liveData.actores.transportistas.filter((actor:{lat:number;lng:number})=>actor.lat&&actor.lng);
  expect(mappedCarriers.length).toBeGreaterThan(0);
  await expect(page.locator('.wr-layout-map .leaflet-marker-icon [style*="rotate(45deg)"]')).toHaveCount(mappedCarriers.length);
  await expect(page.getByText('Toneladas',{exact:true})).toHaveCount(0);
  const gpsCount=liveData.enTransito.filter((trip:{ultimaPosicion:unknown})=>trip.ultimaPosicion!==null).length;
  await expect(page.getByText('Viajes con GPS',{exact:true}).locator('..')).toContainText(String(gpsCount));
  const header = page.locator('.wr-layout-header');
  await expect(header.getByRole('button', { name: 'En vivo', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(header.getByRole('button', { name: 'Historial', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(header.getByRole('button', { name: 'Pendientes', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(header.getByRole('button', { name: 'En vivo', exact: true })).toHaveAttribute('aria-pressed','true');
  for(const mode of ['En vivo','Historial','Pendientes']){
    const glyph=header.getByRole('button',{name:mode,exact:true}).locator('svg');
    expect((await glyph.boundingBox())!.width).toBeGreaterThanOrEqual(15);
  }
  await expect(header.locator('img')).toHaveAttribute('src',new RegExp('/favicon.svg$'));
  await expect(header.getByRole('status')).toContainText('Datos actualizados');
  await expect(page.locator('.wr-layout-bottom')).toContainText(String(liveData.estadisticas.total));
  await expect(page.getByText('Agenda activa · lugares de visita', { exact: true })).toBeVisible();
  await visibleProof(page, info, 'monitor-live');
  if(info.project.name!=='web-desktop'){
    const sidebar=(await page.locator('.wr-layout-sidebar').boundingBox())!;
    const dashboard=(await page.locator('.wr-dashboard').boundingBox())!;
    const bottom=(await page.locator('.wr-layout-bottom').boundingBox())!;
    await expect(page.locator('.wr-layout-sidebar')).toHaveCSS('overflow-y','visible');
    expect(sidebar.height).toBeGreaterThanOrEqual(dashboard.height-1);
    expect(sidebar.y).toBeGreaterThanOrEqual(bottom.y+bottom.height-1);
  }
  const states=page.getByRole('button',{name:'Estados del manifiesto',exact:true});
  await states.focus();await states.press('Space');
  await expect(states).toHaveAttribute('aria-expanded','false');
  await states.press('Enter');await expect(states).toHaveAttribute('aria-expanded','true');
  const refreshed=page.waitForResponse(r=>r.url().includes('/api/centro-control/monitor-live')&&r.status()===200);
  await header.getByRole('button',{name:'Actualizar datos del Monitor'}).click();await refreshed;
  await header.getByRole('button',{name:'Modo mapa oscuro (C)'}).click();
  await expect(page.locator('.wr-layout')).toHaveClass(/wr-cinema/);
  await expect(page.locator('.wr-layout-sidebar .wr-panel').first()).toHaveCSS('background-color','rgb(255, 255, 255)');
  await visibleProof(page,info,'monitor-dark-map-readable-panels');
  await header.getByRole('button',{name:'Modo mapa oscuro (C)'}).click();
  const timeline = page.waitForResponse(r => r.url().includes('/api/centro-control/timeline'));
  await header.getByRole('button', { name: 'Historial', exact: true }).click();
  const timelineResponse = await timeline;
  expect(timelineResponse.status()).toBe(200);
  const timelineData = (await timelineResponse.json()).data;
  expect(timelineData.eventos.length).toBeGreaterThan(0);
  await expect(page.getByText('Creados', { exact: true })).toBeVisible();
  const currentEvent=page.getByRole('button',{name:'Abrir detalle del evento actual'});
  await expect(currentEvent).toBeVisible();
  expect((await currentEvent.boundingBox())!.height).toBeLessThanOrEqual(56);
  const event=page.getByRole('button',{name:/^Abrir evento /}).first();
  await expect(event).toBeVisible();
  await event.focus();await event.press('Space');
  const panel=page.locator('.fp-window').last();await expect(panel).toBeVisible();
  // Real computed CSS, not a unit assertion against class names. Badge tint,
  // event position and future-stage labels are data, not disabled controls.
  const panelQuantities = panel.getByText(/^Y\d+ · [\d.,]+ kg$/);
  const feedQuantities = event.getByText(/^Y\d+ · [\d.,]+ kg$/);
  await expect(panelQuantities.first()).toBeVisible();
  await expect(feedQuantities.first()).toBeVisible();
  const readingTargets = [panel.getByText('CREACION', { exact: true }),
    event.getByText('CREACION', { exact: true }),
    event.getByText('QA Generador 1', { exact: true }),
    ...await panelQuantities.all(),
    ...await feedQuantities.all(),
    ...await panel.getByRole('list', { name: 'Etapas hasta este evento', exact: true }).locator('span').all(),
    page.locator('.wr-widget-content').getByText(/^1\/\d+$/).first()];
  const readingEvidence = [];
  for (const target of readingTargets) {
    const measurement = await target.evaluate(el => {
      const parse = (color: string) => {
        const channels = color.match(/[\d.]+/g)?.map(Number);
        if (!channels || channels.length < 3 || !color.startsWith('rgb')) throw new Error('Unmeasured color: ' + color);
        return channels;
      };
      const background = [255, 255, 255];
      const ancestry: Element[] = []; let parent: Element | null = el;
      while (parent) { ancestry.unshift(parent); parent = parent.parentElement; }
      for (const node of ancestry) {
        const rgb = parse(getComputedStyle(node).backgroundColor), alpha = rgb[3] ?? 1;
        for (let i = 0; i < 3; i++) background[i] = rgb[i] * alpha + background[i] * (1 - alpha);
      }
      const style = getComputedStyle(el), foreground = parse(style.color);
      const lum = (rgb: number[]) => rgb.slice(0, 3).map(channel => {
        const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      }).reduce((total, value, i) => total + value * [.2126, .7152, .0722][i], 0);
      const a = lum(foreground), b = lum(background);
      return { text: el.textContent, foreground: style.color, background,
        contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), fontSize: parseFloat(style.fontSize) };
    });
    expect(measurement.contrast).toBeGreaterThanOrEqual(4.5);
    expect(measurement.fontSize).toBeGreaterThanOrEqual(12);
    readingEvidence.push(measurement);
  }
  await info.attach('monitor-reading-contrast', { body: JSON.stringify(readingEvidence, null, 2), contentType: 'application/json' });
  const actorList = panel.getByRole('list', { name: 'Actores del evento', exact: true });
  await expect(actorList.locator('svg.lucide-factory')).toHaveCount(1);
  await expect(actorList.locator('svg.lucide-flask-conical')).toHaveCount(1);
  const mapBox=(await page.locator('.wr-layout-map').boundingBox())!;
  const panelBox=(await panel.boundingBox())!;
  if(info.project.name==='web-desktop'){
    expect(panelBox.x).toBeGreaterThanOrEqual(mapBox.x);
    expect(panelBox.x+panelBox.width).toBeLessThanOrEqual(mapBox.x+mapBox.width+1);
    expect(panelBox.y+panelBox.height).toBeLessThanOrEqual(mapBox.y+mapBox.height+1);
  }else await expect(panel).toBeInViewport({ratio:1});
  await visibleProof(page,info,'monitor-event-detail-visible');
  await panel.getByRole('button',{name:'Minimizar detalle'}).click();
  await expect(panel.locator('.fp-content')).toHaveCount(0);
  await panel.getByRole('button',{name:'Expandir detalle'}).click();
  await expect(panel.locator('.fp-content')).toBeVisible();
  await panel.getByRole('button',{name:'Cerrar detalle'}).click();await expect(panel).toHaveCount(0);
  await currentEvent.click();await expect(page.locator('.fp-window')).toHaveCount(1);
  await page.locator('.fp-window').getByRole('button',{name:'Cerrar detalle'}).click();
  const slider=page.getByRole('slider',{name:'Recorrer historial'});
  await slider.focus();await slider.press('Home');
  await expect(slider).toHaveValue(String(Math.round(1000/timelineData.eventos.filter((e:{type:string})=>e.type==='EVENTO').length)));
  await slider.press('End');
  const stateEvents=new Set(['CREACION','FIRMA','RETIRO','ENTREGA','RECEPCION','TRATAMIENTO','CIERRE','CANCELACION','RECHAZO']);
  const observedManifests=new Set(timelineData.eventos.filter((e:{type:string;eventoTipo:string})=>e.type==='EVENTO'&&stateEvents.has(e.eventoTipo)).map((e:{manifiestoId:string})=>e.manifiestoId));
  await expect(page.getByText('En historial',{exact:true}).locator('..').locator('p').first()).toHaveText(new Intl.NumberFormat('es-AR').format(observedManifests.size));
  await visibleProof(page, info, 'monitor-playback');
  const forecast = page.waitForResponse(r => r.url().includes('/api/centro-control/forecast'));
  await header.getByRole('button', { name: 'Pendientes', exact: true }).click();
  const forecastResponse = await forecast;
  expect(forecastResponse.status()).toBe(200);
  const forecastData = (await forecastResponse.json()).data;
  expect(Array.isArray(forecastData.pendienteRetiro)).toBe(true);
  await expect(page.getByText(`Pendiente Retiro (${forecastData.pendienteRetiro.length})`, { exact: true })).toBeVisible();
  await expect(page.getByRole('button',{name:'Estados del manifiesto',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Eventos',exact:true})).toHaveCount(0);
  await expect(page.getByText('Retiros pendientes',{exact:true}).locator('..')).toContainText(String(forecastData.pendienteRetiro.length));
  await visibleProof(page, info, 'monitor-forecast');
  const firstPending=forecastData.pendienteRetiro[0];
  expect(firstPending).toBeDefined();
  await page.getByRole('link',{name:'Abrir manifiesto '+firstPending.numero,exact:true}).click();
  await expect(page).toHaveURL(new RegExp('/manifiestos/'+firstPending.manifiestoId+'$'));
  await expect(page.getByRole('button',{name:'Descargar PDF',exact:true})).toBeVisible();
  await page.goBack();await expect(header).toBeVisible();
  await header.getByTitle('Cerrar (Esc)', { exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/centro-control$'));
  expect(errors).toEqual([]);
});

test('monitor labels a real offline interruption and recovers without inventing a live signal',async({page,context},info)=>{
  const runtimeErrors:string[]=[];
  page.on('pageerror',error=>runtimeErrors.push(error.message));
  await login(page,info);
  const response=page.waitForResponse(r=>r.url().includes('/api/centro-control/monitor-live')&&r.status()===200);
  await page.goto(`${prefix(info)}/monitor`);await response;
  const header=page.locator('.wr-layout-header');
  await expect(header.getByRole('status')).toContainText('Datos actualizados');
  try{
    await context.setOffline(true);
    await expect(header.getByRole('status')).toContainText('Sin conexión');
    await expect(header.locator('.wr-live-dot')).toHaveCount(0);
    await expect(header.getByRole('button',{name:'Actualizar datos del Monitor'})).toBeDisabled();
    await visibleProof(page,info,'monitor-real-offline');
  }finally{await context.setOffline(false);}
  await expect(header.getByRole('button',{name:'Actualizar datos del Monitor'})).toBeEnabled();
  const recovered=page.waitForResponse(r=>r.url().includes('/api/centro-control/monitor-live')&&r.status()===200);
  await header.getByRole('button',{name:'Actualizar datos del Monitor'}).click();await recovered;
  await expect(header.getByRole('status')).toContainText('Datos actualizados');
  await expect(header.locator('.wr-live-dot')).toHaveCount(1);
  await visibleProof(page,info,'monitor-recovered');
  await page.goto('/manual/directorio.html#mod-monitor');
  const manual=page.locator('#mod-monitor');
  await expect(manual).toContainText('No es una predicción ni proyecta volúmenes futuros');
  await expect(manual).toContainText('consultar cantidades por unidad');
  await expect(manual).not.toContainText('Vista predictiva');
  expect(runtimeErrors).toEqual([]);
});

test('carrier control center does not expose inspection operations', async ({ page }, info) => {
  await login(page, info, 'transportista');
  const errors = health(page);
  await page.goto(`${prefix(info)}/centro-control`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: 'Inspecciones', exact: true })).toHaveCount(0);
  await expect(page.getByText('Inspecciones activas', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Total Manifiestos', { exact: true })).toBeVisible();
  await visibleProof(page, info, 'carrier-control-center');
  expect(errors).toEqual([]);
});

test('distribution total matches the real complete state aggregation', async ({ page }, info) => {
  await login(page, info);
  const errors = health(page);
  const response = page.waitForResponse(r => r.url().includes('/api/centro-control/actividad') && r.status() === 200);
  await page.goto(`${prefix(info)}/centro-control`);
  const stats = (await (await response).json()).data.estadisticas;
  // Stage-event activity is intentionally a separate cohort. Distribution and
  // headline must use the same created-period aggregation, including cancellations.
  expect(stats.distribucionPorEstado).toBeDefined();
  const expectedTotal = Object.values(stats.distribucionPorEstado).reduce<number>((sum, count) => sum + Number(count), 0);
  expect(expectedTotal).toBe(stats.totalManifiestos);
  await expect(page.getByText('Total Manifiestos', { exact: true }).locator('..')).toContainText(String(expectedTotal));
  await page.locator('summary').filter({ hasText: 'Actividad y estadísticas del período' }).click();
  await expect(page.getByText('Total manifiestos', { exact: true }).locator('..')).toContainText(String(expectedTotal));
  for (const [state, count] of Object.entries(stats.distribucionPorEstado)) {
    if (Number(count) > 0) await expect(page.getByText(state.replace(/_/g, ' '), { exact: true }).last()).toBeVisible();
  }
  await page.getByText('Total manifiestos', { exact: true }).scrollIntoViewIfNeeded();
  await visibleProof(page, info, 'complete-state-distribution');
  expect(errors).toEqual([]);
});
