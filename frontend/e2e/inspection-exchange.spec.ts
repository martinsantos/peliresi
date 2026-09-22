import { expect, test } from '@playwright/test';

const actorUser = {
  id: 'actor-user-1', email: 'responsable@actor.test', nombre: 'Responsable', apellido: 'Ambiental',
  rol: 'GENERADOR', activo: true, esInspector: false, empresa: 'Generador QA',
  generador: { id: 'generator-1', razonSocial: 'Generador QA' },
  esDemo: true, forcePasswordChange: false,
};

const summary = {
  id: 'inspection-exchange', numero: 'I-2026-000021', numeroActa: '116-2026', estado: 'NOTIFICADA',
  tipoActor: 'GENERADOR', actor: { id: 'generator-1', razonSocial: 'Generador QA', cuit: '30-00000000-1' },
  plazoRespuestaAt: '2099-09-30T18:00:00.000Z', version: 8, cantidadPresentaciones: 1,
};

const authorityExchange = {
  id: 'exchange-1', inspeccionId: summary.id, secuencia: 1, clienteId: null, respondeAId: null,
  tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', asunto: 'Acompañar constancia vigente',
  cuerpo: 'Presente la constancia y el plan de adecuación dentro del plazo indicado.',
  plazoRespuestaAt: summary.plazoRespuestaAt, presentadoFueraDePlazo: false, canal: 'PORTAL_SITREP',
  versionExpediente: 8, contenidoSha256: 'a'.repeat(64), hashAnterior: null, hashCadena: 'b'.repeat(64),
  autorId: 'admin-1', createdAt: '2026-09-22T15:00:00.000Z',
  autor: { id: 'admin-1', nombre: 'Ana', apellido: 'Auditora', rol: 'ADMIN_GENERADOR' }, adjuntos: [],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sitrep_access_token', 'qa-access-token');
    localStorage.setItem('sitrep_refresh_token', 'qa-refresh-token');
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let data: unknown = [];
    if (url.pathname.endsWith('/auth/profile')) data = { user: actorUser };
    else if (url.pathname === '/api/inspecciones/participacion') data = [summary];
    else if (url.pathname === `/api/inspecciones/${summary.id}/intercambios` && request.method() === 'GET') data = {
      inspeccion: summary, parteActual: 'INSPECCIONADO', intercambios: [authorityExchange], comunicacionExterna: false,
    };
    else if (url.pathname === `/api/inspecciones/${summary.id}/intercambios` && request.method() === 'POST') {
      data = { ...authorityExchange, id: 'exchange-2', secuencia: 2, tipo: 'DESCARGO', parte: 'INSPECCIONADO', respondeAId: authorityExchange.id };
    } else if (url.pathname.endsWith('/health')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
});

test('inspected actor can answer the exact authority action with audited attachments', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.goto(mobile ? '/mobile/mis-inspecciones' : '/mis-inspecciones');
  await expect(page.getByRole('main').getByRole('heading', { name: 'Mis inspecciones' })).toBeVisible();
  await page.getByRole('button', { name: /I-2026-000021/ }).click();

  await expect(page.getByRole('heading', { name: 'Presentaciones y respuestas' })).toBeVisible();
  await expect(page.getByText('Acompañar constancia vigente')).toBeVisible();
  await expect(page.getByText(/no envía correos/i)).toBeVisible();
  const ledger = page.getByTestId('inspection-exchange-ledger');
  await expect(ledger.getByRole('heading', { name: 'Registro cronológico formal' })).toBeVisible();
  await expect(ledger.getByTestId('inspection-exchange-row')).toHaveCount(1);
  await ledger.getByText('Integridad y versión').click();
  await expect(ledger.getByTestId('exchange-content-hash')).toHaveText('a'.repeat(64));
  await expect(ledger.getByTestId('exchange-chain-hash')).toHaveText('b'.repeat(64));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Responder esta actuación' }).click();
  await expect(page.getByText(/Antecedente: presentación #1/i)).toBeVisible();
  await page.getByLabel('Contenido').fill('Se acompaña la constancia y la evidencia respaldatoria solicitada.');
  await page.getByLabel(/Adjuntos probatorios/i).setInputFiles({
    name: 'constancia.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 QA'),
  });

  const presented = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith(`/api/inspecciones/${summary.id}/intercambios`));
  await page.getByRole('button', { name: 'Presentar en expediente' }).click();
  const request = await presented;
  expect(request.postData()).toContain('exchange-1');
  expect(request.postData()).toContain('constancia.pdf');
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});
