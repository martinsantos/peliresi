import { test, expect, devices, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from '../safety';
import { login, prefix, readablePageHeading } from './helpers';

test.beforeAll(async () => {
  await assertCloudDatabase();
  expect(process.env.QA_COMPAT_BACKEND).toBe('17152d81');
  expect(process.env.QA_ARTIFACTS).toBe('/work/sitrep/.qa-rollback-partial-20261030');
});

test('a proposal created before rollback keeps its signature and can finish with all three parties', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'rollback-fixture.json'), 'utf8'));
  expect(fixture.synthetic).toBe(true);
  const item = fixture.cases[info.project.name] as { id: string; numero: string; markerSha256: string };
  expect(item).toBeTruthy();
  const errors: string[] = [], contexts = [];
  const pages = {} as Record<'generador' | 'transportista' | 'operador', Page>;
  const options = info.project.name === 'web-desktop'
    ? { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
    : { ...devices['Pixel 7'], viewport: { width: 320, height: 800 } };
  async function openNotice(role: 'transportista' | 'operador') {
    const page = pages[role];
    await page.goto(prefix(info) + '/notificaciones');
    const notice = page.getByRole('list', { name: 'Avisos', exact: true }).getByRole('listitem')
      .filter({ hasText: item.numero }).filter({ hasText: 'Manifiesto pendiente de tu aprobación' });
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: /^Abrir aviso:/ }).click();
    const manifestUrl = new RegExp('/manifiestos/' + item.id + '$');
    await page.waitForURL(url => manifestUrl.test(url.pathname) || /\/notificaciones\/[^/]+$/.test(url.pathname));
    if (/\/notificaciones\/[^/]+$/.test(new URL(page.url()).pathname)) {
      const label = role === 'transportista' ? 'Transporte' : 'Operador';
      const select = page.getByRole('button', { name: new RegExp('^(Usar ' + label + ' y abrir manifiesto|Abrir manifiesto)$') });
      await expect(select).toHaveCount(1); await select.click();
    }
    await expect(page).toHaveURL(manifestUrl);
    return page;
  }
  async function post(page: Page, suffix: string, action: () => Promise<unknown>) {
    const [response] = await Promise.all([page.waitForResponse(r => r.url().endsWith(suffix) && r.request().method() === 'POST'), action()]);
    expect(response.status(), suffix + ' ' + await response.text()).toBe(200);
    return (await response.json()).data;
  }
  try {
    for (const role of ['generador', 'transportista', 'operador'] as const) {
      const context = await browser.newContext({ ...options, baseURL: 'http://127.0.0.1:4177', serviceWorkers: 'block' });
      contexts.push(context); const page = await context.newPage(); pages[role] = page;
      page.on('pageerror', error => errors.push(error.message));
      await login(page, info, role);
    }
    const generator = pages.generador;
    await generator.goto(prefix(info) + '/manifiestos/' + item.id);
    const initial = generator.getByRole('region', { name: 'Aprobaciones de las partes' });
    await expect(initial).toContainText('1 de 3 aprobaciones');
    await expect(initial.getByLabel('Generador: Aprobado', { exact: true })).toBeVisible();
    await expect(initial.getByLabel('Transporte: Pendiente', { exact: true })).toBeVisible();
    await expect(initial.getByLabel('Operador: Pendiente', { exact: true })).toBeVisible();
    await readablePageHeading(generator);
    await generator.screenshot({ path: info.outputPath('partial-approval.png'), animations: 'disabled' });

    const carrier = await openNotice('transportista');
    const carrierPanel = carrier.getByRole('region', { name: 'Aprobaciones de las partes' });
    await post(carrier, '/' + item.id + '/aprobar-parte', () => carrierPanel.getByRole('button', { name: 'Aprobar como transporte', exact: true }).click());
    await expect(carrierPanel).toContainText('2 de 3 aprobaciones');
    await expect(carrierPanel.getByRole('button', { name: 'Iniciar coordinación', exact: true })).toHaveCount(0);
    const operator = await openNotice('operador');
    const panel = operator.getByRole('region', { name: 'Aprobaciones de las partes' });
    await post(operator, '/' + item.id + '/aprobar-parte', () => panel.getByRole('button', { name: 'Aprobar como operador', exact: true }).click());
    await expect(panel).toContainText('3 de 3 · Aprobado');
    for (const name of ['Generador', 'Transporte', 'Operador']) await expect(panel.getByLabel(name + ': Aprobado', { exact: true })).toBeVisible();
    const receipt = operator.getByRole('button', { name: 'Confirmar Recepcion In Situ', exact: true });
    await expect(receipt).toBeDisabled();
    await post(operator, '/' + item.id + '/iniciar-coordinacion', () => panel.getByRole('button', { name: 'Iniciar coordinación', exact: true }).click());
    await expect(receipt).toBeEnabled();
    await operator.screenshot({ path: info.outputPath('three-approved.png'), animations: 'disabled' });
    const received = await post(operator, '/' + item.id + '/recepcion-insitu', () => receipt.click());
    expect(received.manifiesto.estado).toBe('RECIBIDO'); expect(received.manifiesto.fechaRetiro).toBeNull();
    expect(await operator.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
    try {
      const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, isDemoData: true, estado: true } });
      expect(manifest).toMatchObject({ numero: item.numero, isDemoData: true, estado: 'RECIBIDO' });
      const events = await db.eventoManifiesto.findMany({ where: { manifiestoId: item.id } });
      const marker = events.find((event: any) => event.tipo === 'PROPUESTA_PARTES_V1');
      expect(createHash('sha256').update(marker.descripcion).digest('hex')).toBe(item.markerSha256);
      for (const type of ['FIRMA', 'APROBACION_TRANSPORTISTA', 'APROBACION_OPERADOR'])
        expect(events.filter((event: any) => event.tipo === type)).toHaveLength(1);
      expect(await db.trackingGPS.count({ where: { manifiestoId: item.id } })).toBe(0);
      expect(await db.tramoTransporte.count({ where: { manifiestoId: item.id } })).toBe(0);
    } finally { await db.$disconnect(); }
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('rollback-proof.json'), JSON.stringify({ synthetic: true, surface: info.project.name,
      id: item.id, numero: item.numero, originalMarkerPreserved: true, approvals: 3, received: true, noTripOrGps: true, errors }));
  } finally { for (const context of contexts) await context.close(); }
});
