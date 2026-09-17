import { test, expect } from '@playwright/test';

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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sitrep_access_token', 'qa-access-token');
    localStorage.setItem('sitrep_refresh_token', 'qa-refresh-token');
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let data: unknown = [];
    if (url.pathname.endsWith('/auth/profile')) data = { user };
    else if (url.pathname.endsWith('/evidencias/e-1')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#dff5e9"/><path d="M90 330 230 185l95 90 70-65 155 120" fill="none" stroke="#0D8A4F" stroke-width="24"/><circle cx="455" cy="125" r="45" fill="#0D8A4F"/><text x="320" y="420" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#10213A">Evidencia de campo</text></svg>' });
    else if (url.pathname === '/api/inspecciones/inspection-qa') data = inspection;
    else if (url.pathname === '/api/inspecciones/inspection-closed') data = closedInspection;
    else if (url.pathname === '/api/inspecciones') data = { items: [inspection], total: 1, page: 1, limit: 25, totalPages: 1, summary: { byState: { EN_CAMPO: 1 }, openDeadlines: 0 } };
    else if (url.pathname.includes('/catalogos/')) data = [];
    else if (url.pathname.endsWith('/health')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
});

test('inspection field screen is usable on web and PWA layouts', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.goto(mobile ? '/mobile/inspecciones/inspection-qa' : '/inspecciones/inspection-qa');
  await expect(page.getByRole('heading', { name: 'I-2026-000001' })).toBeVisible();
  await expect(page.getByText('Checklist regulatorio', { exact: true })).toBeVisible();
  await expect(page.getByText('Evidencias (2)')).toBeVisible();
  await expect(page.getByText('Declarado vs. verificado')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Difiere' }).first()).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Guardar borrador' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar a revisión' })).toBeVisible();
  const actorLink = page.getByRole('link', { name: /Abrir actor inspeccionado: Transportes Andinos S\.A\./ });
  await expect(actorLink).toBeVisible();
  await expect(actorLink).toHaveAttribute('href', mobile
    ? '/mobile/admin/actores/transportistas/transport-qa'
    : '/admin/actores/transportistas/transport-qa');
  expect(await actorLink.evaluate((element) => getComputedStyle(element).textDecorationLine)).toBe('none');
  await expect(page.getByRole('button', { name: 'Ver ficha del actor' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Todas sus inspecciones' })).toHaveCount(0);
  const emergencyControl = page.getByRole('group', { name: /Validación: Señalización y elementos de emergencia operativos/ });
  await expect(emergencyControl.getByRole('button', { name: 'No cumple' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: /Observación: Señalización y elementos de emergencia operativos/ })).toBeVisible();
  const emergencyItem = page.getByText('Señalización y elementos de emergencia operativos', { exact: true }).locator('xpath=ancestor::div[@data-result][1]');
  await expect(emergencyItem.getByText('vehiculo_frente.jpg')).toBeVisible();
  await expect(emergencyItem.getByLabel(/Adjuntar foto: Señalización y elementos de emergencia operativos/)).toBeAttached();
  await expect(emergencyItem.getByText('La imagen también queda disponible en Evidencias del expediente.')).toBeVisible();
  await emergencyItem.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/sitrep-inspection-item-evidence-${testInfo.project.name}.png`, fullPage: false });
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  await page.screenshot({ path: `../output/inspection-${mobile ? 'mobile' : 'desktop'}-qa.png`, fullPage: true });
  await page.getByText('Declarado vs. verificado').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/sitrep-inspection-field-comparison-${testInfo.project.name}.png`, fullPage: false });
  await page.getByText('Checklist regulatorio', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/sitrep-inspection-field-checklist-${testInfo.project.name}.png`, fullPage: false });
});

test('inspector can attach an image to one checklist comment without losing the draft', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  const state = structuredClone(inspection);
  let uploadBody = '';

  await page.route('**/api/inspecciones/inspection-qa**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const respond = (data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

    if (request.method() === 'GET' && /\/evidencias\/(e-1|e-item-new)$/.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#dff5e9"/><path d="M90 330 230 185l95 90 70-65 155 120" fill="none" stroke="#0D8A4F" stroke-width="24"/></svg>' });
    }
    if (request.method() === 'GET' && url.pathname === '/api/inspecciones/inspection-qa') return respond(state);
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
      uploadBody = request.postData() || '';
      const evidence = { id: 'e-item-new', tipo: 'FOTO', nombreOriginal: 'senalizacion-nueva.png', mimeDetectado: 'image/png', bytes: 512, capturadaAt: new Date().toISOString(), createdAt: new Date().toISOString(), itemId: 'item-6', descripcion: 'Falta completar la señalización del kit de emergencia.' };
      state.evidencias.unshift(evidence);
      state.items = state.items.map((item) => item.id === 'item-6' ? { ...item, evidencias: [...item.evidencias, evidence] } : item);
      state.version += 1;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: evidence }) });
    }
    return route.fallback();
  });

  await page.goto(mobile ? '/mobile/inspecciones/inspection-qa' : '/inspecciones/inspection-qa');
  const emergencyItem = page.getByText('Señalización y elementos de emergencia operativos', { exact: true }).locator('xpath=ancestor::div[@data-result][1]');
  await emergencyItem.getByRole('textbox', { name: /Observación:/ }).fill('Falta completar la señalización del kit de emergencia.');
  await emergencyItem.getByLabel(/Adjuntar foto:/).setInputFiles({ name: 'senalizacion-nueva.png', mimeType: 'image/png', buffer: Buffer.from('qa-image') });

  await expect(emergencyItem.getByText('senalizacion-nueva.png')).toBeVisible();
  expect(uploadBody).toContain('name="itemId"');
  expect(uploadBody).toContain('item-6');
  expect(uploadBody).toContain('Falta completar la señalización del kit de emergencia.');
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
  await expect(findings.getByText('Declarado').nth(mobile ? 1 : 0)).toBeVisible();
  await expect(findings.getByText('Verificado').nth(mobile ? 1 : 0)).toBeVisible();
  await expect(findings.locator('table')).toHaveCount(0);
  await expect(page.getByTestId('inspection-action-bar')).toHaveCount(0);
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await page.screenshot({ path: `/tmp/sitrep-inspection-closed-${testInfo.project.name}.png`, fullPage: true });
  await findings.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/sitrep-inspection-ledger-${testInfo.project.name}.png`, fullPage: false });
  await page.getByTestId('inspection-checklist-report').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/sitrep-inspection-checklist-report-${testInfo.project.name}.png`, fullPage: false });
});
