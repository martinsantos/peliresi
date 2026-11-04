import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-eventual-notices-20261030/fixture.json', 'utf8'));
const phase = process.env.QA_LOCK_PHASE;
test.beforeAll(async () => {
  await assertCloudDatabase();
  expect(fixture.synthetic).toBe(true); expect(fixture.owner).toMatch(/@night-qa\.invalid$/);
  expect(['before', 'after']).toContain(phase);
  expect(process.env.QA_ARTIFACTS).toBe('/work/sitrep/.qa-eventual-edit-lock-20261030');
  expect(process.env.DISABLE_EMAILS).toBe('true'); expect(process.env.PUSH_MANIFEST_NOTICES_ENABLED).toBe('false');
});
async function openForm(page: Page) {
  await page.getByRole('button', { name: /Registrar operación|Continuar borrador/ }).click();
}
async function otherPage(page: Page, info: TestInfo) {
  const other = await page.context().newPage(); await isolatedMapTiles(other, info); return other;
}
async function resumeAfterRelease(page: Page) {
  await expect.poll(async () => page.evaluate(async () => (await navigator.locks.query()).held?.some(lock => lock.name.startsWith('sitrep:inspection-draft:eventual:')) ?? false)).toBe(false);
  await page.getByRole('button', { name: 'Volver a comprobar' }).click();
}
async function fill(page: Page, marker: string) {
  await page.getByLabel('Transportista · Nombre o razón social').fill('QA transporte');
  await page.getByLabel('Operador · Nombre o razón social').fill('QA operador');
  await page.getByLabel('Corriente', { exact: true }).fill('Y1');
  await page.getByLabel('Cantidad', { exact: true }).fill('3');
  await page.getByLabel('Motivo del registro excepcional').fill(marker);
}
test('la edición y el último borrador pasan de una pestaña a otra', async ({ page }, info) => {
  const marker = 'QA edición ' + randomUUID().slice(0, 8);
  await login(page, info, fixture.owner.split('@')[0]);
  const url = prefix(info) + '/manifiestos/baja-intensidad';
  await page.goto(url); await openForm(page);
  await expect(page.getByLabel('Motivo del registro excepcional')).toBeEnabled();
  const other = await otherPage(page, info); await other.goto(url); await openForm(other);
  if (phase === 'before') {
    await expect(other.getByLabel('Motivo del registro excepcional')).toBeEnabled();
    await expect(other.getByText(/Este borrador está abierto en otra pestaña/)).toHaveCount(0);
  } else {
    await expect(other.getByText(/Este borrador está abierto en otra pestaña/)).toBeVisible();
    await expect(other.getByLabel('Motivo del registro excepcional')).toBeDisabled();
    await page.getByLabel('Motivo del registro excepcional').fill(marker);
    await page.close();
    await resumeAfterRelease(other);
    await expect(other.getByLabel('Motivo del registro excepcional')).toBeEnabled();
    await expect(other.getByLabel('Motivo del registro excepcional')).toHaveValue(marker);
    await other.screenshot({ path: info.outputPath('retomar-borrador.png'), animations: 'disabled' });
  }
});
test('el detalle bloquea la segunda edición y recupera la nota al retomarla', async ({ page }, info) => {
  const marker = 'QA nota ' + randomUUID().slice(0, 8);
  await login(page, info, fixture.owner.split('@')[0]);
  const url = prefix(info) + '/manifiestos/baja-intensidad?registro=' + fixture.recordId;
  await page.goto(url); await expect(page.getByLabel('Nota de la acción')).toBeEnabled();
  const other = await otherPage(page, info); await other.goto(url);
  if (phase === 'before') await expect(other.getByLabel('Nota de la acción')).toBeEnabled();
  else {
    await expect(other.getByText(/Este borrador está abierto en otra pestaña/)).toBeVisible();
    await expect(other.getByLabel('Nota de la acción')).toBeDisabled();
    await page.getByLabel('Nota de la acción').fill(marker); await page.close();
    await resumeAfterRelease(other);
    await expect(other.getByLabel('Nota de la acción')).toBeEnabled();
    await expect(other.getByLabel('Nota de la acción')).toHaveValue(marker);
  }
});
test('se informa la incompatibilidad antes de completar el formulario', async ({ page }, info) => {
  await page.context().addInitScript(() => { Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }); });
  await login(page, info, fixture.owner.split('@')[0]);
  await page.goto(prefix(info) + '/manifiestos/baja-intensidad'); await openForm(page);
  expect(await page.evaluate(() => !navigator.locks)).toBe(true);
  if (phase === 'before') {
    await expect(page.getByLabel('Motivo del registro excepcional')).toBeEnabled();
    await expect(page.getByText(/navegador no permite proteger la edición/)).toHaveCount(0);
  } else {
    await expect(page.getByText(/navegador no permite proteger la edición/)).toBeVisible();
    await expect(page.getByLabel('Motivo del registro excepcional')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Guardar operación' })).toBeDisabled();
    if (info.project.name === 'app') for (const width of [320, 393]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: info.outputPath('navegador-no-compatible.png'), animations: 'disabled' });
  }
});
if (phase === 'after') test('otra pestaña comprueba la misma operación tras una respuesta perdida', async ({ page }, info) => {
  const marker = 'QA respuesta perdida ' + randomUUID().slice(0, 8);
  await login(page, info, fixture.owner.split('@')[0]);
  const url = prefix(info) + '/manifiestos/baja-intensidad'; await page.goto(url); await openForm(page);
  const other = await otherPage(page, info); await other.goto(url); await openForm(other);
  await expect(other.getByText(/Este borrador está abierto en otra pestaña/)).toBeVisible();
  await fill(page, marker);
  let committed = '';
  await page.route('**/api/manifiestos/baja-intensidad', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch(); expect(response.status()).toBe(201);
    committed = (await response.json()).data.registro.id; await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Guardar operación' }).click();
  await expect.poll(() => committed).not.toBe('');
  await expect(page.getByText(/podría haberse guardado/i)).toBeVisible();
  await page.close(); await resumeAfterRelease(other);
  await expect(other.getByRole('button', { name: 'Comprobar envío' })).toBeEnabled();
  await other.getByRole('button', { name: 'Comprobar envío' }).click(); await expect(other).toHaveURL(/registro=/);
  const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
  try {
    const rows = await db.registroManifiestoExcepcional.findMany({ where: { datos: { path: ['motivo'], equals: marker } }, select: { id: true } });
    expect(rows).toEqual([{ id: committed }]);
  } finally { await db.$disconnect(); }
});
if (phase === 'after') test('salir durante el envío no elimina la referencia de la otra pestaña', async ({ page }, info) => {
  const marker = 'QA cierre en envío ' + randomUUID().slice(0, 8);
  await login(page, info, fixture.owner.split('@')[0]);
  const url = prefix(info) + '/manifiestos/baja-intensidad'; await page.goto(url); await openForm(page);
  const other = await otherPage(page, info); await other.goto(url); await openForm(other);
  await expect(other.getByText(/Este borrador está abierto en otra pestaña/)).toBeVisible(); await fill(page, marker);
  let committed = '', release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/manifiestos/baja-intensidad', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch(); expect(response.status()).toBe(201);
    committed = (await response.json()).data.registro.id; await held; await route.fulfill({ response });
  });
  try {
    await page.getByRole('button', { name: 'Guardar operación' }).click(); await expect.poll(() => committed).not.toBe('');
    await page.getByRole('button', { name: 'Volver a registros' }).click();
    await resumeAfterRelease(other);
    await expect(other.getByRole('button', { name: 'Comprobar envío' })).toBeEnabled();
    release();
    await expect(page).not.toHaveURL(/registro=/);
    await expect(other.getByText(/podría haberse guardado/i)).toBeVisible();
    // The first window may still be releasing its short submission lock.
    await expect.poll(async () => page.evaluate(async () => (await navigator.locks.query()).held?.some(lock => lock.name.startsWith('sitrep:eventual-submit:')) ?? false)).toBe(false);
    await other.getByRole('button', { name: 'Comprobar envío' }).click(); await expect(other).toHaveURL(/registro=/);
    const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
    try {
      const rows = await db.registroManifiestoExcepcional.findMany({ where: { datos: { path: ['motivo'], equals: marker } }, select: { id: true } });
      expect(rows).toEqual([{ id: committed }]);
    } finally { await db.$disconnect(); }
  } finally { release(); }
});
if (phase === 'after') test('en el detalle se advierte la incompatibilidad antes de escribir', async ({ page }, info) => {
  await page.context().addInitScript(() => { Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }); });
  await login(page, info, fixture.owner.split('@')[0]);
  await page.goto(prefix(info) + '/manifiestos/baja-intensidad?registro=' + fixture.recordId);
  await expect(page.getByText(/navegador no permite proteger la edición/)).toBeVisible();
  await expect(page.getByLabel('Nota de la acción')).toBeDisabled();
});
if (phase === 'after') test('una diferencia confirmada recupera su resultado sin repetirla', async ({ page }, info) => {
  const marker = 'QA diferencia ' + randomUUID().slice(0, 8);
  await login(page, info, fixture.owner.split('@')[0]);
  const url = prefix(info) + '/manifiestos/baja-intensidad?registro=' + fixture.recordId; await page.goto(url);
  await page.getByLabel('Nota de la acción').fill(marker);
  await page.getByRole('button', { name: 'Registrar diferencia' }).click();
  await page.getByLabel('Corriente', { exact: true }).fill('Y12'); await page.getByLabel('Cantidad', { exact: true }).fill('8');
  let actionId = '';
  await page.route('**/api/manifiestos/baja-intensidad/*/eventos', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch(); expect(response.status()).toBe(200);
    actionId = route.request().postDataJSON().id; await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Guardar diferencia' }).click(); await expect.poll(() => actionId).not.toBe('');
  const context = page.context(); await page.close(); const reopened = await context.newPage(); await isolatedMapTiles(reopened, info); await reopened.goto(url);
  await expect(reopened.getByText('La acción ya estaba guardada. Recuperamos la confirmación sin duplicarla.')).toBeVisible();
  const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
  try {
    const row = await db.registroManifiestoExcepcional.findUniqueOrThrow({ where: { id: fixture.recordId }, select: { eventos: true } });
    const matches = (row.eventos as any[]).filter(event => event.id === actionId);
    expect(matches).toHaveLength(1); expect(matches[0].nota).toBe(marker);
  } finally { await db.$disconnect(); }
});
if (phase === 'after') test('la aprobación propia sigue disponible después de crear el eventual', async ({ page }, info) => {
  await login(page, info, fixture.owner.split('@')[0]); const recordId = randomUUID();
  const status = await page.evaluate(async id => {
    const token = localStorage.getItem('sitrep_access_token');
    const external = { nombre: 'QA externo', identificacion: 'QA', domicilio: 'QA' };
    const response = await fetch('/api/manifiestos/baja-intensidad', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, transportista: external, operador: external, patente: 'QA-APROB', motivo: 'QA aprobación artificial', residuos: [{ corriente: 'Y1', cantidad: 1, unidad: 'kg' }] }) });
    return response.status;
  }, recordId);
  expect(status).toBe(201);
  await page.goto(prefix(info) + '/manifiestos/baja-intensidad?registro=' + recordId);
  await page.getByRole('button', { name: 'Aprobar como quien lo creó' }).click();
  await expect(page.getByText('Aprobación de las partes: aprobado')).toBeVisible();
  await expect(page.getByText('La acción quedó registrada.')).toBeVisible();
});
if (phase === 'after') test('cada actividad conserva su borrador de creación y su nota', async ({ page }, info) => {
  const marker = 'QA actividad ' + randomUUID().slice(0, 8);
  await login(page, info, fixture.owner.split('@')[0]);
  const list = prefix(info) + '/manifiestos/baja-intensidad', detail = list + '?registro=' + fixture.recordId;
  await page.goto(list); await openForm(page); await page.getByLabel('Motivo del registro excepcional').fill(marker);
  await page.goto(detail); await page.getByLabel('Nota de la acción').fill('Nota generador ' + marker);
  await page.goto(prefix(info) + '/mi-perfil'); await page.getByRole('button', { name: 'Usar Operador', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Operador · En uso', exact: true })).toBeDisabled();
  await page.goto(list); await openForm(page); await expect(page.getByLabel('Motivo del registro excepcional')).toHaveValue('');
  await page.getByLabel('Motivo del registro excepcional').fill('Operador ' + marker);
  await page.goto(detail); await expect(page.getByLabel('Nota de la acción')).toHaveValue('');
  await page.getByLabel('Nota de la acción').fill('Nota operador ' + marker);
  await page.goto(prefix(info) + '/mi-perfil'); await page.getByRole('button', { name: 'Usar Generador', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Generador · En uso', exact: true })).toBeDisabled();
  await page.goto(list); await openForm(page); await expect(page.getByLabel('Motivo del registro excepcional')).toHaveValue(marker);
  await page.goto(detail); await expect(page.getByLabel('Nota de la acción')).toHaveValue('Nota generador ' + marker);
});
if (phase === 'after') test('la advertencia es accesible en pantallas estrechas', async ({ page }, info) => {
  await page.context().addInitScript(() => { Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }); });
  await login(page, info, fixture.owner.split('@')[0]);
  await page.goto(prefix(info) + '/manifiestos/baja-intensidad'); await openForm(page);
  const notice = page.getByRole('alert').filter({ hasText: 'Este navegador no permite proteger la edición' });
  await expect(notice).toBeVisible();
  for (const width of [320, 393]) {
    await page.setViewportSize({ width, height: 844 });
    const button = notice.getByRole('button', { name: 'Volver a comprobar' }); await button.scrollIntoViewIfNeeded();
    const geometry = await button.evaluate(element => {
      const rect = element.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { height: rect.height, hit: !!hit && (hit === element || element.contains(hit)), overflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(geometry.height).toBeGreaterThanOrEqual(44); expect(geometry.hit).toBe(true); expect(geometry.overflow).toBeLessThanOrEqual(1);
  }
  await page.screenshot({ path: info.outputPath('advertencia-movil.png'), animations: 'disabled' });
});
if (phase === 'after') test('el encabezado mantiene la sección y señala la etapa actual', async ({ page }, info) => {
  await login(page, info, fixture.owner.split('@')[0]);
  const list = prefix(info) + '/manifiestos/baja-intensidad'; await page.goto(list);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 2, name: 'Registros', exact: true })).toBeVisible();
  await openForm(page); await expect(page.getByRole('heading', { level: 2, name: 'Registrar operación', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a registros' }).click();
  await page.getByRole('button', { name: 'Seguimiento de participantes', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Seguimiento de participantes', exact: true })).toBeVisible();
  await page.goto(list + '?registro=' + fixture.recordId);
  await expect(page.getByRole('heading', { level: 2, name: 'Detalle del eventual', exact: true })).toBeVisible();
});
if (phase === 'after') test('web y app del mismo perfil coordinan el mismo borrador', async ({ page }, info) => {
  const marker = 'QA web y app ' + randomUUID().slice(0, 8);
  await login(page, info, fixture.owner.split('@')[0]);
  const path = '/manifiestos/baja-intensidad'; await page.goto(prefix(info) + path); await openForm(page);
  await expect(page.getByLabel('Motivo del registro excepcional')).toBeEnabled();
  const other = await otherPage(page, info); await other.goto((info.project.name === 'app' ? '' : '/app') + path); await openForm(other);
  await expect(other.getByText(/Este borrador está abierto en otra pestaña/)).toBeVisible();
  await expect(other.getByLabel('Motivo del registro excepcional')).toBeDisabled();
  await page.getByLabel('Motivo del registro excepcional').fill(marker); await page.close(); await resumeAfterRelease(other);
  await expect(other.getByLabel('Motivo del registro excepcional')).toHaveValue(marker);
  await expect(other.getByLabel('Motivo del registro excepcional')).toBeEnabled();
});
