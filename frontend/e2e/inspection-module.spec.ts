import { test, expect, type Page } from '@playwright/test';

async function openSection(page: Page, hash: string) {
  const index = page.locator('#inspection-step-index');
  if (!await index.isVisible()) await page.getByRole('button', { name: /Ver todos los pasos/ }).click();
  await index.locator(`a[href="#${hash}"]`).click();
  await expect(page).toHaveURL(new RegExp(`#${hash}$`));
  await expect(page.getByTestId('inspection-step-content')).toBeVisible();
}

async function openEmergencyControl(page: Page) {
  const item = page.locator('#control-item-6');
  const toggle = item.locator('button[aria-controls="control-detail-item-6"]');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  return item;
}

const user = {
  id: 'inspector-qa', email: 'inspector.qa@sitrep.local', nombre: 'María', apellido: 'Fernández',
  rol: 'ADMIN', activo: true, esInspector: true, empresa: 'Fiscalización Ambiental',
  esDemo: true, forcePasswordChange: false,
};

const linkedChecklistPhoto = {
  id: 'e-1', tipo: 'FOTO', nombreOriginal: 'vehiculo_frente.jpg', mimeDetectado: 'image/jpeg',
  bytes: 1_240_000, capturadaAt: '2026-09-17T13:35:00.000Z', createdAt: '2026-09-17T13:35:00.000Z',
  itemId: 'item-6', descripcion: 'Señalización de emergencia incompleta',
};

const inspection = {
  id: 'inspection-qa', numero: 'I-2026-000001', numeroActa: 'ACTA-QA-001', tipoActor: 'TRANSPORTISTA',
  estado: 'EN_CAMPO', inspectorId: user.id, inspector: user, version: 3,
  transportista: { id: 'transport-qa', razonSocial: 'Transportes Andinos S.A.', cuit: '30-70812345-6', domicilio: 'Ruta 7, Km 1056', activo: true },
  generador: null, operador: null, ubicacion: 'Ruta 7, Km 1056 — Luján de Cuyo', iniciadaAt: '2026-09-17T13:30:00.000Z',
  plazoRespuestaAt: null, observaciones: 'Se constata documentación y estado general del vehículo.',
  createdAt: '2026-09-17T13:20:00.000Z', updatedAt: '2026-09-17T13:40:00.000Z',
  verificacion: {
    url: 'https://sitrep.ultimamilla.com.ar/verificar/inspecciones/eyJ2IjoxfQ.signature',
    huella: 'a'.repeat(64),
    version: 3,
  },
  items: [
    ['HAB-01', 'Habilitacion', 'Cuenta con habilitación vigente', 'CUMPLE'],
    ['HAB-02', 'Habilitacion', 'La actividad desarrollada coincide con la autorizada', 'CUMPLE'],
    ['HAB-03', 'Habilitacion', 'Rótulos y cartelería reglamentaria visibles', 'CUMPLE'],
    ['DOC-01', 'Documentacion', 'Exhibe documentación regulatoria respaldatoria', 'CUMPLE'],
    ['DOC-02', 'Documentacion', 'Los registros se encuentran completos y actualizados', 'PENDIENTE'],
    ['SEG-01', 'Seguridad', 'Elementos de protección personal disponibles y en uso', 'CUMPLE'],
    ['SEG-02', 'Seguridad', 'Señalización y elementos de emergencia operativos', 'NO_CUMPLE'],
    ['TRZ-01', 'Trazabilidad', 'La documentación coincide con los registros de SITREP', 'PENDIENTE'],
    ['TRA-01', 'Flota', 'Vehículos y habilitaciones coinciden con SITREP', 'CUMPLE'],
    ['TRA-02', 'Flota', 'Conductores poseen licencias y autorizaciones vigentes', 'PENDIENTE'],
  ].map(([codigo, categoria, etiqueta, resultado], index) => ({
    id: `item-${index}`, codigo, categoria, etiqueta, resultado, orden: (index + 1) * 10, obligatorio: true,
    observacion: index === 6 ? 'Falta completar la señalización del kit de emergencia.' : null,
    evidencias: index === 6 ? [linkedChecklistPhoto] : [],
  })),
  evidencias: [
    linkedChecklistPhoto,
    { id: 'e-2', tipo: 'AUDIO', nombreOriginal: 'nota_campo.webm', mimeDetectado: 'audio/webm', bytes: 620_000, capturadaAt: '2026-09-17T13:38:00.000Z', createdAt: '2026-09-17T13:38:00.000Z' },
  ],
  eventos: [
    { id: 'ev-2', tipo: 'EVIDENCIA_AGREGADA', titulo: 'Evidencia agregada', detalle: 'vehiculo_frente.jpg', visibleActor: false, createdAt: '2026-09-17T13:35:00.000Z', usuario: user },
    { id: 'ev-1', tipo: 'CAMBIO_ESTADO', titulo: 'Estado actualizado a EN_CAMPO', detalle: null, visibleActor: false, createdAt: '2026-09-17T13:30:00.000Z', usuario: user },
  ],
  comparaciones: [
    { id: 'comparison-field-1', codigo: 'HAB-01', categoria: 'Habilitación', etiqueta: 'Número de habilitación', valorDeclarado: 'T-000105', valorObservado: '', resultado: 'PENDIENTE', observacion: null, evidencias: [] },
    { id: 'comparison-field-2', codigo: 'DOM-01', categoria: 'Habilitación', etiqueta: 'Domicilio declarado', valorDeclarado: 'Ruta 7, Km 1056', valorObservado: 'Ruta 7, Km 1056', resultado: 'COINCIDE', observacion: null, evidencias: [] },
  ],
};

const closedInspection = {
  ...inspection,
  id: 'inspection-closed',
  numero: 'I-2026-000002',
  numeroActa: 'ACTA-QA-002',
  estado: 'CERRADA_CONFORME',
  comparaciones: [
    {
      id: 'comparison-1', codigo: 'HAB-01', etiqueta: 'Número de habilitación',
      valorDeclarado: 'T-000105', valorObservado: 'Verificado en campo: requiere actualización documental y validación del expediente respaldatorio',
      resultado: 'DIFIERE', observacion: null,
    },
    {
      id: 'comparison-2', codigo: 'DOM-01', etiqueta: 'Domicilio declarado',
      valorDeclarado: 'Ruta Provincial 7, Km 1056 — Luján de Cuyo, Mendoza',
      valorObservado: 'Ruta Provincial 7, Km 1056 — Luján de Cuyo, Mendoza', resultado: 'COINCIDE', observacion: null,
    },
  ],
};

const reviewInspection = {
  ...inspection,
  id: 'inspection-review',
  numero: 'I-2026-000003',
  numeroActa: 'ACTA-QA-003',
  estado: 'EN_REVISION',
  version: 5,
  datosActa: { atendidoPor: 'Responsable de planta', motivoInspeccion: 'Control programado' },
  informeTecnico: { objetivo: 'Evaluar la situación constatada en campo.' },
  items: inspection.items.map((item) => ({ ...item, resultado: item.resultado === 'PENDIENTE' ? 'CUMPLE' : item.resultado })),
  comparaciones: inspection.comparaciones.map((row) => ({ ...row, resultado: row.resultado === 'PENDIENTE' ? 'COINCIDE' : row.resultado })),
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sitrep_access_token', 'qa-access-token');
    localStorage.setItem('sitrep_refresh_token', 'qa-refresh-token');
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let data: unknown = [];
    if (url.pathname.endsWith('/auth/profile')) data = { user };
    else if (url.pathname.endsWith('/intercambios')) {
      const source = url.pathname.includes('inspection-closed') ? closedInspection : url.pathname.includes('inspection-review') ? reviewInspection : inspection;
      data = {
        inspeccion: { id: source.id, numero: source.numero, numeroActa: source.numeroActa, estado: source.estado, tipoActor: source.tipoActor, actor: source.transportista, plazoRespuestaAt: source.plazoRespuestaAt, version: source.version },
        parteActual: 'AUTORIDAD', intercambios: [], comunicacionExterna: false,
      };
    }
    else if (url.pathname.endsWith('/evidencias/e-1')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#dff5e9"/><path d="M90 330 230 185l95 90 70-65 155 120" fill="none" stroke="#0D8A4F" stroke-width="24"/><circle cx="455" cy="125" r="45" fill="#0D8A4F"/><text x="320" y="420" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#10213A">Evidencia de campo</text></svg>' });
    else if (url.pathname === '/api/inspecciones/inspection-qa') data = inspection;
    else if (url.pathname === '/api/inspecciones/inspection-closed') data = closedInspection;
    else if (url.pathname === '/api/inspecciones') data = { items: [inspection], total: 1, page: 1, limit: 25, totalPages: 1, summary: { byState: { EN_CAMPO: 1 }, openDeadlines: 0 } };
    else if (url.pathname.includes('/catalogos/')) data = [];
    else if (url.pathname.endsWith('/health')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
});

test('draft has one aligned start action and advances only after the server confirms', async ({ page }, testInfo) => {
  const state = { ...structuredClone(inspection), estado: 'BORRADOR' };
  let rejectStart = true;
  let starts = 0;
  await page.route('**/api/inspecciones/inspection-qa**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/estado')) {
      starts++;
      if (rejectStart) return route.fulfill({ status: 409, json: { success: false, message: 'El servidor no confirmó el inicio' } });
      state.estado = 'EN_CAMPO'; state.version++;
      return route.fulfill({ json: { success: true, data: state } });
    }
    if (request.method() === 'PATCH') { state.version++; return route.fulfill({ json: { success: true, data: state } }); }
    if (path === '/api/inspecciones/inspection-qa') return route.fulfill({ json: { success: true, data: state } });
    return route.fallback();
  });
  await page.goto((testInfo.project.name === 'mobile' ? '/mobile' : '') + '/inspecciones/inspection-qa');
  const footer = page.getByTestId('inspection-action-bar');
  const start = footer.getByRole('button', { name: 'Iniciar y continuar' });
  await expect(start).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar inspección', exact: true })).toHaveCount(0);
  await expect(footer.getByRole('button', { name: 'Siguiente', exact: true })).toHaveCount(0);
  await footer.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/sitrep-wizard-start-footer-' + testInfo.project.name + '.png' });
  await start.click();
  await expect.poll(() => starts).toBe(1);
  await expect(page.getByRole('heading', { name: 'Preparar la inspección' })).toBeVisible();
  await expect(start).toBeEnabled();
  rejectStart = false;
  await start.click();
  await expect(page).toHaveURL(/#declaracion$/);
  await expect(page.getByRole('heading', { name: 'Declarado vs. verificado' })).toBeVisible();
});

test('closed controls state their result in words and deep anchors resume the exact item', async ({ page }, testInfo) => {
  const path = (testInfo.project.name === 'mobile' ? '/mobile' : '') + '/inspecciones/inspection-qa';
  await page.goto(path + '#checklist/DOC-02');
  await expect(page.getByRole('heading', { name: 'Checklist regulatorio' })).toBeVisible();
  const active = page.getByRole('button', { name: /Los registros se encuentran completos y actualizados/ });
  await expect(active).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('inspection-item-status-item-4')).toHaveText('Pendiente');
  await expect(page.getByTestId('inspection-item-status-item-0')).toHaveText('Revisado · Cumple');
  await expect(page.getByTestId('inspection-item-status-item-6')).toHaveText('Revisado · No cumple');
  await active.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/sitrep-wizard-orientation-' + testInfo.project.name + '.png' });
  await page.getByRole('button', { name: 'Siguiente pendiente', exact: true }).click();
  await expect(page).toHaveURL(/#checklist\/TRZ-01$/);
  await page.reload();
  await expect(page.getByRole('button', { name: /La documentación coincide con los registros de SITREP/ })).toHaveAttribute('aria-expanded', 'true');
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('inspection field screen is usable on web and PWA layouts', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
  await page.goto(mobile ? '/mobile/inspecciones/inspection-qa' : '/inspecciones/inspection-qa');
  await expect(page.getByRole('heading', { name: 'I-2026-000001' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Preparar la inspección' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Paso actual del recorrido' })).toHaveAttribute('aria-valuemax', '7');
  await expect(page.getByRole('heading', { name: 'Checklist regulatorio' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Guardar borrador' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar a revisión' })).toHaveCount(0);
  await page.screenshot({ path: `/tmp/sitrep-inspection-first-viewport-${testInfo.project.name}.png`, fullPage: false });
  await expect(page.getByTestId('inspection-action-bar')).toHaveCSS('position', 'static');
  const actorLink = page.getByRole('link', { name: /Abrir actor inspeccionado: Transportes Andinos S\.A\./ });
  await expect(actorLink).toBeVisible();
  await expect(actorLink).toHaveAttribute('href', mobile
    ? '/mobile/admin/actores/transportistas/transport-qa'
    : '/admin/actores/transportistas/transport-qa');
  expect(await actorLink.evaluate((element) => getComputedStyle(element).textDecorationLine)).toBe('none');
  await expect(page.getByRole('button', { name: 'Ver ficha del actor' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Todas sus inspecciones' })).toHaveCount(0);
  await openSection(page, 'declaracion');
  await expect(page.getByRole('heading', { name: 'Declarado vs. verificado' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Difiere' }).first()).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: `/tmp/sitrep-inspection-field-comparison-${testInfo.project.name}.png`, fullPage: false });
  await openSection(page, 'checklist');
  await expect(page.getByRole('heading', { name: 'Checklist regulatorio' })).toBeVisible();
  const emergencyItem = await openEmergencyControl(page);
  const emergencyControl = page.getByRole('group', { name: /Validación: Señalización y elementos de emergencia operativos/ });
  await expect(emergencyControl.getByRole('button', { name: 'No cumple' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: /Observación: Señalización y elementos de emergencia operativos/ })).toBeVisible();
  await expect(emergencyItem.getByText('vehiculo_frente.jpg')).toBeVisible();
  const itemPhoto = emergencyItem.getByAltText('Señalización de emergencia incompleta');
  await expect(itemPhoto).toBeVisible();
  await expect(itemPhoto).toHaveAttribute('data-loaded', 'true');
  expect(await itemPhoto.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await emergencyItem.getByRole('button', { name: 'Ampliar evidencia: Señalización de emergencia incompleta' }).click();
  await expect(page.getByRole('dialog', { name: 'Vista ampliada: Señalización de emergencia incompleta' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(emergencyItem.getByLabel(/Adjuntar foto: Señalización y elementos de emergencia operativos/)).toBeAttached();
  await expect(emergencyItem.getByText(/Máximo 25 MB; también quedará en Evidencias del expediente\./)).toBeVisible();
  await emergencyItem.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/sitrep-inspection-item-evidence-${testInfo.project.name}.png`, fullPage: false });
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/sitrep-inspection-${mobile ? 'mobile' : 'desktop'}-qa.png`, fullPage: true });
  await page.getByRole('heading', { name: 'Checklist regulatorio' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/sitrep-inspection-field-checklist-${testInfo.project.name}.png`, fullPage: false });
  await openSection(page, 'evidencias');
  await expect(page.getByText('Evidencias (2)')).toBeVisible();
  await openSection(page, 'revision');
  await expect(page.getByRole('button', { name: 'Enviar a revisión' })).toBeVisible();
  const footer = page.getByTestId('inspection-action-bar');
  const content = page.getByTestId('inspection-step-content');
  const footerBox = await footer.boundingBox();
  const contentBox = await content.boundingBox();
  expect(footerBox!.y).toBeGreaterThanOrEqual(contentBox!.y + contentBox!.height - 1);
  expect(runtimeErrors).toEqual([]);
});

test('seven-step wizard preserves field values across steps, reload and browser history', async ({ page }, testInfo) => {
  const prefix = testInfo.project.name === 'mobile' ? '/mobile' : '';
  await page.goto(`${prefix}/inspecciones/inspection-qa#resumen`);
  await page.getByLabel('Ubicación', { exact: true }).fill('Depósito de campo · revisión preservada');
  const hashes = ['declaracion', 'checklist', 'evidencias', 'acta', 'informe-tecnico', 'revision'];
  for (const [index, hash] of hashes.entries()) {
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${hash}$`));
    await expect(page.getByTestId('inspection-workspace').getByText(`Paso ${index + 2} de 7`, { exact: true })).toBeVisible();
    expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await expect(page.getByRole('button', { name: 'Siguiente', exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/#informe-tecnico$/);
  await page.getByLabel('1. Objetivo').fill('Objetivo preservado al recorrer el expediente.');
  await openSection(page, 'resumen');
  await expect(page.getByLabel('Ubicación', { exact: true })).toHaveValue('Depósito de campo · revisión preservada');
  await page.reload();
  await expect(page.getByLabel('Ubicación', { exact: true })).toHaveValue('Depósito de campo · revisión preservada');
  await openSection(page, 'informe-tecnico');
  await expect(page.getByLabel('1. Objetivo')).toHaveValue('Objetivo preservado al recorrer el expediente.');
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  await expect(page).toHaveURL(/#acta$/);
});

test('section navigation preserves an unsubmitted audit note and its selected attachment', async ({ page }, testInfo) => {
  const prefix = testInfo.project.name === 'mobile' ? '/mobile' : '';
  let writes = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/inspecciones/') && ['POST', 'PATCH', 'PUT'].includes(request.method())) writes += 1;
  });
  await page.goto(`${prefix}/inspecciones/inspection-qa#trazabilidad`);
  await page.getByRole('button', { name: 'Agregar nota', exact: true }).click();
  await page.getByLabel('Detalle del registro').fill('Nota de campo pendiente de enviar, no se debe perder al consultar el QR.');
  await page.getByLabel('Adjunto del registro').setInputFiles({ name: 'nota-pendiente.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% QA note') });
  await openSection(page, 'verificacion');
  await expect(page.getByTestId('inspection-verification')).toBeVisible();
  await openSection(page, 'trazabilidad');
  await expect(page.getByLabel('Detalle del registro')).toHaveValue('Nota de campo pendiente de enviar, no se debe perder al consultar el QR.');
  await expect(page.getByRole('button', { name: 'nota-pendiente.pdf', exact: true })).toBeVisible();
  expect(await page.getByLabel('Adjunto del registro').evaluate((input: HTMLInputElement) => input.files?.length)).toBe(1);
  expect(writes).toBe(0);
});

test('inspector can attach an image to one checklist comment without losing the draft', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  const state = structuredClone(inspection);
  let uploadBody = '';
  let successfulUploads = 0;
  let allowUpload = false;
  let failDetailLoad = false;

  await page.route('**/api/inspecciones/inspection-qa**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const respond = (data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

    if (request.method() === 'GET' && /\/evidencias\/(e-1|e-item-new)$/.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#dff5e9"/><path d="M90 330 230 185l95 90 70-65 155 120" fill="none" stroke="#0D8A4F" stroke-width="24"/></svg>' });
    }
    if (request.method() === 'GET' && url.pathname === '/api/inspecciones/inspection-qa') {
      if (failDetailLoad) return route.abort('internetdisconnected');
      return respond(state);
    }
    if (request.method() === 'PATCH' && url.pathname === '/api/inspecciones/inspection-qa') {
      Object.assign(state, request.postDataJSON(), { version: state.version + 1 });
      return respond(state);
    }
    if (request.method() === 'PATCH' && url.pathname.endsWith('/items')) {
      const body = request.postDataJSON();
      state.items = state.items.map((item) => ({ ...item, ...(body.items.find((row: { id: string }) => row.id === item.id) || {}) }));
      state.version += 1;
      return respond(state);
    }
    if (request.method() === 'PATCH' && url.pathname.endsWith('/comparaciones')) {
      state.version += 1;
      return respond(state);
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/evidencias')) {
      if (!allowUpload) return route.abort('internetdisconnected');
      successfulUploads += 1;
      uploadBody = request.postData() || '';
      const evidence = { id: 'e-item-new', tipo: 'FOTO', nombreOriginal: 'senalizacion-nueva.png', mimeDetectado: 'image/png', bytes: 512, capturadaAt: new Date().toISOString(), createdAt: new Date().toISOString(), itemId: 'item-6', descripcion: 'Falta completar la señalización del kit de emergencia.' };
      state.evidencias.unshift(evidence);
      state.items = state.items.map((item) => item.id === 'item-6' ? { ...item, evidencias: [...item.evidencias, evidence] } : item);
      state.version += 1;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: evidence }) });
    }
    return route.fallback();
  });

  await page.goto(mobile ? '/mobile/inspecciones/inspection-qa#checklist' : '/inspecciones/inspection-qa#checklist');
  const emergencyItem = await openEmergencyControl(page);
  await emergencyItem.getByRole('textbox', { name: /Observación:/ }).fill('Falta completar la señalización del kit de emergencia.');
  await page.context().setOffline(true);
  const realPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  await emergencyItem.getByLabel(/Adjuntar foto:/).setInputFiles({ name: 'senalizacion-nueva.png', mimeType: 'image/png', buffer: realPng });

  await expect(emergencyItem.getByTestId('pending-inspection-evidence')).toBeVisible();
  await expect(emergencyItem.getByText('Pendiente de sincronizar')).toBeVisible();
  await page.context().setOffline(false);
  failDetailLoad = true;
  await expect(emergencyItem.getByTestId('pending-inspection-evidence')).toBeVisible();
  await page.reload();
  const recoveredItem = await openEmergencyControl(page);
  await expect(recoveredItem.getByTestId('pending-inspection-evidence')).toBeVisible();
  await expect(recoveredItem.getByRole('textbox', { name: /Observación:/ })).toHaveValue('Falta completar la señalización del kit de emergencia.');
  failDetailLoad = false;
  allowUpload = true;
  await page.getByRole('button', { name: 'Sincronizar ahora' }).click();

  await expect(recoveredItem.getByText('senalizacion-nueva.png')).toBeVisible();
  await expect(recoveredItem.getByTestId('pending-inspection-evidence')).toHaveCount(0);
  expect(uploadBody).toContain('name="itemId"');
  expect(uploadBody).toContain('item-6');
  expect(uploadBody).toContain('Falta completar la señalización del kit de emergencia.');
  expect(uploadBody).toContain('name="clienteId"');
  expect(uploadBody).toContain('name="clienteSha256"');
  await page.evaluate(() => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('online')); });
  await page.waitForTimeout(250);
  expect(successfulUploads).toBe(1);
});

test('review keeps the field act frozen while versioning the later technical report', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  const state = structuredClone(reviewInspection);
  let savedBody: { version: number; informeTecnico: { evaluacion?: string } } | null = null;

  await page.route('**/api/inspecciones/inspection-review**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname === '/api/inspecciones/inspection-review') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: state }) });
    }
    if (request.method() === 'PATCH' && url.pathname.endsWith('/informe-tecnico')) {
      savedBody = request.postDataJSON();
      state.informeTecnico = savedBody!.informeTecnico as typeof state.informeTecnico;
      state.version += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: state }) });
    }
    return route.fallback();
  });

  await page.goto(mobile ? '/mobile/inspecciones/inspection-review' : '/inspecciones/inspection-review');
  await expect(page.getByRole('heading', { name: 'Informe técnico para Legales' }).first()).toBeVisible();
  await openSection(page, 'acta');
  await expect(page.getByLabel('Atendido por')).toBeDisabled();
  await expect(page.getByLabel('Daños a personas o bienes')).toBeDisabled();
  await expect(page.getByLabel('Libro de Registro de Operaciones')).toBeDisabled();
  await expect(page.getByLabel('Firma de la persona interviniente')).toBeDisabled();
  await expect(page.getByLabel('Domicilio legal constituido')).toBeDisabled();
  await page.getByText('Formalidades de constatación · art. 44', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/sitrep-inspection-art44-${testInfo.project.name}.png`, fullPage: false });
  await openSection(page, 'informe-tecnico');
  await expect(page.getByRole('heading', { name: 'Informe técnico para Legales' }).first()).toBeVisible();
  await expect(page.getByLabel('1. Objetivo')).toBeEnabled();
  await page.getByLabel('3. Evaluación').fill('La evaluación contrasta el acta, el checklist y las evidencias preservadas.');
  await page.getByRole('button', { name: 'Guardar informe técnico' }).click();

  await expect.poll(() => savedBody).not.toBeNull();
  expect(savedBody).toEqual({
    version: 5,
    informeTecnico: expect.objectContaining({ evaluacion: 'La evaluación contrasta el acta, el checklist y las evidencias preservadas.' }),
  });
  await expect(page.getByText(/sin modificar el acta de campo/i)).toBeVisible();
});

test('inspector annuls a mistaken photo with a mandatory reason while preserving its trace', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  const state: any = structuredClone(inspection);
  let annulBody: { version: number; motivo: string } | null = null;

  await page.route('**/api/inspecciones/inspection-qa**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const respond = (data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    if (request.method() === 'GET' && url.pathname.endsWith('/evidencias/e-1')) {
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#dff5e9"/></svg>' });
    }
    if (request.method() === 'GET' && url.pathname === '/api/inspecciones/inspection-qa') return respond(state);
    if (request.method() === 'PATCH' && url.pathname.endsWith('/evidencias/e-1/anular')) {
      annulBody = request.postDataJSON();
      const patchEvidence = (evidence: typeof linkedChecklistPhoto) => ({
        ...evidence,
        anuladaAt: '2026-09-21T15:00:00.000Z',
        anuladaPorId: user.id,
        motivoAnulacion: annulBody?.motivo,
      });
      state.evidencias = state.evidencias.map((evidence) => evidence.id === 'e-1' ? patchEvidence(evidence as typeof linkedChecklistPhoto) : evidence);
      state.items = state.items.map((item) => ({ ...item, evidencias: item.evidencias.map((evidence) => evidence.id === 'e-1' ? patchEvidence(evidence) : evidence) }));
      state.version += 1;
      return respond(state.evidencias.find((evidence) => evidence.id === 'e-1'));
    }
    return route.fallback();
  });

  await page.goto(mobile ? '/mobile/inspecciones/inspection-qa#checklist' : '/inspecciones/inspection-qa#checklist');
  const emergencyItem = await openEmergencyControl(page);
  await emergencyItem.getByRole('button', { name: 'Anular con motivo' }).click();
  const reason = emergencyItem.getByRole('textbox', { name: /Motivo para anular vehiculo_frente.jpg/ });
  await reason.fill('La fotografía quedó movida y se reemplazará por una toma legible.');
  await emergencyItem.getByRole('button', { name: 'Confirmar anulación' }).click();

  await expect(emergencyItem.getByText('Anulada', { exact: true })).toBeVisible();
  await expect(emergencyItem.getByText(/fotografía quedó movida/)).toBeVisible();
  expect(annulBody).toEqual({ version: 3, motivo: 'La fotografía quedó movida y se reemplazará por una toma legible.' });
});

test('inspection list uses one active destination for the whole row', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.goto(mobile ? '/mobile/inspecciones' : '/inspecciones');
  await expect(page.getByRole('heading', { name: 'Inspecciones', level: 2 })).toBeVisible();
  await expect(page.getByText('I-2026-000001')).toBeVisible();
  await expect(page.getByText('Transportes Andinos S.A.')).toBeVisible();
  const rowLink = page.getByRole('link', { name: 'Abrir expediente I-2026-000001' });
  await expect(rowLink).toHaveAttribute('href', mobile ? '/mobile/inspecciones/inspection-qa' : '/inspecciones/inspection-qa');
  await expect(page.getByRole('link', { name: 'Transportes Andinos S.A.' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'I-2026-000001', exact: true })).toHaveCount(0);
  await expect(rowLink.getByText('Transportes Andinos S.A.')).toBeVisible();
  await expect(page.getByText('En campo').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exportar listado' })).toBeVisible();
  const createButton = page.getByRole('button', { name: 'Nueva inspección' });
  await expect(createButton).toBeVisible();
  expect(await createButton.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.getByText(/17 sept 2026|17\/09\/2026/i)).toBeVisible();
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await rowLink.focus();
  await expect(rowLink).toBeFocused();
  await page.screenshot({ path: `/tmp/sitrep-inspection-list-row-${testInfo.project.name}.png`, fullPage: false });
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(mobile ? /\/mobile\/inspecciones\/inspection-qa$/ : /\/inspecciones\/inspection-qa$/);
  await expect(page.getByRole('heading', { name: 'I-2026-000001' })).toBeVisible();
});

test('closed inspection report reflows without horizontal scroll or an empty sticky footer', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  if (!mobile) await page.setViewportSize({ width: 1180, height: 800 });
  await page.goto(mobile ? '/mobile/inspecciones/inspection-closed' : '/inspecciones/inspection-closed');

  const findings = page.getByRole('heading', { name: 'Hallazgos comparativos' }).locator('..');
  await expect(findings).toBeVisible();
  await expect(page.getByTestId('comparison-ledger')).toBeVisible();
  await expect(page.getByTestId('inspection-checklist-report')).toBeVisible();
  await expect(page.getByTestId('inspection-checklist-report').locator('[data-result="NO_CUMPLE"]')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Resultado de la inspección' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Paso actual del recorrido' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Guardar borrador' })).toHaveCount(0);
  await expect(findings.getByText('Declarado').nth(mobile ? 1 : 0)).toBeVisible();
  await expect(findings.getByText('Verificado').nth(mobile ? 1 : 0)).toBeVisible();
  await expect(findings.locator('table')).toHaveCount(0);
  await page.screenshot({ path: `/tmp/sitrep-inspection-closed-${testInfo.project.name}.png`, fullPage: true });
  await findings.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/sitrep-inspection-ledger-${testInfo.project.name}.png`, fullPage: false });
  await page.getByTestId('inspection-checklist-report').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/sitrep-inspection-checklist-report-${testInfo.project.name}.png`, fullPage: false });
  await openSection(page, 'verificacion');
  const verification = page.getByTestId('inspection-verification');
  await expect(verification).toBeVisible();
  await expect(verification.getByRole('heading', { name: 'Trazabilidad pública de la inspección' })).toBeVisible();
  const qr = verification.locator('div[aria-label="Código QR de verificación pública"]');
  await expect(qr).toBeVisible();
  await expect(qr.locator('svg')).toHaveCount(1);
  await expect(verification.getByRole('link', { name: 'Abrir verificación pública' })).toHaveAttribute('href', /\/verificar\/inspecciones\/eyJ2IjoxfQ\.signature$/);
  await verification.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/sitrep-inspection-verification-anchor-${testInfo.project.name}.png`, fullPage: false });
  await openSection(page, 'trazabilidad');
  await expect(page.locator('#trazabilidad')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historial de la inspección' })).toBeVisible();
  // Reference sections do not expose wizard/save actions for an unsent audit note.
  await expect(page.getByTestId('inspection-action-bar')).toHaveCount(0);
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});
