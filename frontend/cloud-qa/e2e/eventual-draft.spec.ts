import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from '../safety';
import { login, prefix } from './helpers';

const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-eventual-site-20261030/fixture.json', 'utf8'));
const authorizations = JSON.parse(readFileSync('/work/sitrep/.qa-eventual-notices-20261030/fixture.json', 'utf8'));
const phase = process.env.QA_DRAFT_PHASE;
test.beforeAll(async () => {
 await assertCloudDatabase(); expect(fixture.synthetic).toBe(true); expect(fixture.owner).toMatch(/@night-qa\.invalid$/);
 expect(fixture.member).toMatch(/@night-qa\.invalid$/);
 expect(authorizations.synthetic).toBe(true); expect(authorizations.member).toBe(fixture.member); expect(authorizations.companyId).toBe(fixture.companyId);
 expect(['before', 'after']).toContain(phase); expect(process.env.QA_ARTIFACTS).toBe('/work/sitrep/.qa-eventual-draft-20261030');
 expect(process.env.DISABLE_EMAILS).toBe('true'); expect(process.env.PUSH_MANIFEST_NOTICES_ENABLED).toBe('false');
});
async function fill(page: Page, marker: string) {
 await page.getByLabel('Transportista · Nombre o razón social').fill('QA transporte ' + marker);
 await page.getByLabel('Operador · Nombre o razón social').fill('QA planta ' + marker);
 await page.getByLabel('Corriente', { exact: true }).fill('Y1');
 await page.getByLabel('Cantidad', { exact: true }).fill('3');
 await page.getByLabel('Motivo del registro excepcional').fill(marker);
}
async function openForm(page: Page) {
 await page.getByRole('button', { name: phase === 'after' ? /Registrar operación|Continuar borrador/ : 'Registrar operación' }).click();
}
async function logout(page: Page, info: TestInfo) {
 if (info.project.name === 'app') {
  await page.getByRole('button',{name:'Abrir menu',exact:true}).click();
  await page.getByRole('button',{name:'Cerrar Sesión',exact:true}).click();
 } else {
  await page.getByRole('button',{name:/^Mi Cuenta/}).click();
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
 }
 await expect(page).toHaveURL(new RegExp(prefix(info) + '/login$'));
}
test('cierre y reapertura conservan el formulario sólo en su cuenta', async ({ page }, info) => {
 const marker = 'QA Borrador ' + randomUUID().slice(0, 8);
 await login(page, info, fixture.owner.split('@')[0]); await page.goto(prefix(info) + '/manifiestos/baja-intensidad');
 await openForm(page); await fill(page, marker); const context = page.context(); await page.close();
 const reopened = await context.newPage(); await reopened.goto(prefix(info) + '/manifiestos/baja-intensidad'); await openForm(reopened);
 if (phase === 'before') await expect(reopened.getByLabel('Motivo del registro excepcional')).toHaveValue('');
 else {
  await expect(reopened.getByLabel('Motivo del registro excepcional')).toHaveValue(marker);
  await expect(reopened.getByLabel('Transportista · Nombre o razón social')).toHaveValue('QA transporte ' + marker);
  await expect(reopened.getByLabel('Corriente', { exact: true })).toHaveValue('Y1');
  await expect(reopened.getByLabel('Cantidad', { exact: true })).toHaveValue('3');
 }
 await reopened.screenshot({ path: info.outputPath('reopened.png'), animations: 'disabled' });
});
test('una respuesta perdida no debe crear otro eventual al reabrir', async ({ page }, info) => {
 const marker = 'QA Envio ' + randomUUID().slice(0, 8);
 await login(page, info, fixture.owner.split('@')[0]); await page.goto(prefix(info) + '/manifiestos/baja-intensidad');
 await openForm(page); await fill(page, marker);
 let committed = '';
 await page.route('**/api/manifiestos/baja-intensidad', async route => {
  if (route.request().method() !== 'POST') return route.continue();
  const response = await route.fetch(); expect(response.status()).toBe(201);
  committed = (await response.json()).data.registro.id; await route.abort('failed');
 });
 await page.getByRole('button', { name: 'Guardar operación' }).click();
 await expect.poll(() => committed).not.toBe(''); await expect(page.getByRole('alert').first()).toBeVisible();
 const context = page.context(); await page.close(); const reopened = await context.newPage();
 await reopened.goto(prefix(info) + '/manifiestos/baja-intensidad'); await openForm(reopened);
 if (phase === 'before') {
  await expect(reopened.getByLabel('Motivo del registro excepcional')).toHaveValue(''); await fill(reopened, marker);
  await reopened.getByRole('button', { name: 'Guardar operación' }).click();
 } else {
  await expect(reopened.getByText(/podría haberse guardado/i)).toBeVisible();
  const retry = reopened.getByRole('button', { name: 'Comprobar envío' });
  if (info.project.name === 'app') {
   for (const width of [320, 393]) {
    await reopened.setViewportSize({ width, height:844 }); await retry.scrollIntoViewIfNeeded();
    const geometry = await retry.evaluate(element => { const r=element.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
     return { height:r.height, hit:!!hit && (hit===element || element.contains(hit)), overflow:document.documentElement.scrollWidth-innerWidth }; });
    expect(geometry.height).toBeGreaterThanOrEqual(44); expect(geometry.hit).toBe(true); expect(geometry.overflow).toBeLessThanOrEqual(1);
   }
  }
  await retry.click();
 }
 await expect(reopened).toHaveURL(/registro=/);
 const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
 try {
  const rows = await db.registroManifiestoExcepcional.findMany({ where: { datos: { path: ['motivo'], equals: marker } }, select: { id: true } });
  expect(rows.length).toBe(phase === 'before' ? 2 : 1);
  if (phase === 'after') expect(rows[0].id).toBe(committed);
 } finally { await db.$disconnect(); }
 await reopened.screenshot({ path: info.outputPath('send-result.png'), animations: 'disabled' });
});
if (phase === 'after') test('una cuenta multirrol recupera cada borrador en su propia actividad', async ({ page }, info) => {
 const marker = 'QA Rol ' + randomUUID().slice(0, 8);
 await login(page, info, fixture.owner.split('@')[0]); await page.goto(prefix(info) + '/manifiestos/baja-intensidad');
 await openForm(page); await fill(page, marker);
 await page.goto(prefix(info) + '/mi-perfil'); await page.getByRole('button',{name:'Usar Operador',exact:true}).click();
 await expect(page.getByRole('button',{name:'Operador · En uso',exact:true})).toBeDisabled();
 await page.goto(prefix(info) + '/manifiestos/baja-intensidad'); await openForm(page);
 await expect(page.getByLabel('Motivo del registro excepcional')).toHaveValue('');
 await page.getByLabel('Motivo del registro excepcional').fill('QA operador ' + marker);
 await page.goto(prefix(info) + '/mi-perfil'); await page.getByRole('button',{name:'Usar Generador',exact:true}).click();
 await expect(page.getByRole('button',{name:'Generador · En uso',exact:true})).toBeDisabled();
 await page.goto(prefix(info) + '/manifiestos/baja-intensidad'); await openForm(page);
 await expect(page.getByLabel('Motivo del registro excepcional')).toHaveValue(marker);
 await expect(page.getByLabel('Transportista · Nombre o razón social')).toHaveValue('QA transporte ' + marker);
 await page.screenshot({ path:info.outputPath('multi-role-draft.png'), animations:'disabled' });
});
if (phase === 'after') test('otra pestaña no reemplaza un envío pendiente ni crea un duplicado', async ({ page }, info) => {
 const marker = 'QA Pestañas ' + randomUUID().slice(0, 8);
 await login(page, info, fixture.owner.split('@')[0]); await page.goto(prefix(info) + '/manifiestos/baja-intensidad');
 await openForm(page); const other = await page.context().newPage(); await other.goto(prefix(info) + '/manifiestos/baja-intensidad'); await openForm(other);
 await fill(page, marker); await expect(other.getByLabel('Motivo del registro excepcional')).toHaveValue(marker);
 let committed = '';
 await other.route('**/api/manifiestos/baja-intensidad', async route => {
  if (route.request().method() !== 'POST') return route.continue();
  const response = await route.fetch(); expect(response.status()).toBe(201); committed = (await response.json()).data.registro.id; await route.abort('failed');
 });
 await other.getByRole('button',{name:'Guardar operación'}).click(); await expect.poll(() => committed).not.toBe('');
 await expect(page.getByText(/Hay un envío sin confirmar/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Conservar mi versión'})).toHaveCount(0);
 await page.getByRole('button',{name:'Cargar la otra versión'}).click();
 await expect(page.getByText(/podría haberse guardado/i)).toBeVisible();
 await page.getByRole('button',{name:'Comprobar envío'}).click(); await expect(page).toHaveURL(/registro=/);
 const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
 try {
  const rows = await db.registroManifiestoExcepcional.findMany({ where:{ datos:{ path:['motivo'], equals:marker } }, select:{id:true} });
  expect(rows).toEqual([{id:committed}]);
 } finally { await db.$disconnect(); await other.close(); }
});
if (phase === 'after') test('al salir y volver, otra cuenta no ve el borrador y la titular lo recupera', async ({ page }, info) => {
 const marker = 'QA Cuenta ' + randomUUID().slice(0, 8);
 await login(page, info, fixture.owner.split('@')[0]); await page.goto(prefix(info) + '/manifiestos/baja-intensidad');
 await openForm(page); await fill(page, marker); await logout(page, info);
 await login(page, info, fixture.member.split('@')[0]);
 await page.goto(prefix(info) + '/empresas?empresa=' + fixture.companyId);
 await page.getByText('Actuar por esta empresa', { exact:true }).click();
 await page.getByLabel('Actividad autorizada', { exact:true }).selectOption(authorizations.genActivityId);
 await page.getByLabel('Establecimiento para operar', { exact:true }).selectOption(fixture.north);
 await page.getByRole('button',{name:'Usar empresa y establecimiento',exact:true}).click();
 await expect(page.getByRole('link',{name:'Cambiar empresa o sede',exact:true})).toBeVisible();
 await page.goto(prefix(info) + '/manifiestos/baja-intensidad'); await openForm(page);
 await expect(page.getByLabel('Motivo del registro excepcional')).toHaveValue(''); await logout(page, info);
 await login(page, info, fixture.owner.split('@')[0]); await page.goto(prefix(info) + '/manifiestos/baja-intensidad'); await openForm(page);
 await expect(page.getByLabel('Motivo del registro excepcional')).toHaveValue(marker);
});
if (phase === 'after') test('dos pestañas no envían simultáneamente el mismo borrador', async ({ page }, info) => {
 const marker = 'QA Simultáneo ' + randomUUID().slice(0, 8);
 await login(page, info, fixture.owner.split('@')[0]); await page.goto(prefix(info) + '/manifiestos/baja-intensidad'); await openForm(page);
 const other = await page.context().newPage(); await other.goto(prefix(info) + '/manifiestos/baja-intensidad'); await openForm(other);
 await fill(page, marker); await expect(other.getByLabel('Motivo del registro excepcional')).toHaveValue(marker);
 let committed = '', release: () => void = () => {};
 const held = new Promise<void>(resolve => { release = resolve; });
 await page.route('**/api/manifiestos/baja-intensidad', async route => {
  if (route.request().method() !== 'POST') return route.continue();
  const response = await route.fetch(); expect(response.status()).toBe(201); committed = (await response.json()).data.registro.id;
  await held; await route.fulfill({ response });
 });
 try {
  await page.getByRole('button',{name:'Guardar operación'}).click(); await expect.poll(() => committed).not.toBe('');
  const retry = other.getByRole('button',{name:'Comprobar envío'}); await expect(retry).toBeVisible(); await retry.click();
  await expect(other.getByText(/Otra pestaña está enviando este borrador/)).toBeVisible();
  release(); await expect(page).toHaveURL(/registro=/);
  const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
  try {
   const rows = await db.registroManifiestoExcepcional.findMany({ where:{ datos:{ path:['motivo'], equals:marker } }, select:{id:true} });
   expect(rows).toEqual([{id:committed}]);
  } finally { await db.$disconnect(); }
 } finally { release(); await other.close(); }
});
if (phase === 'after') test('un cambio de otra pestaña no borra la referencia de un envío incierto', async ({ page }, info) => {
 const marker = 'QA-Referencia-' + randomUUID().slice(0, 8) + 'X'.repeat(100);
 await login(page, info, fixture.owner.split('@')[0]); await page.goto(prefix(info) + '/manifiestos/baja-intensidad'); await openForm(page); await fill(page, marker);
 let committed = '';
 await page.route('**/api/manifiestos/baja-intensidad', async route => {
  if (route.request().method() !== 'POST') return route.continue();
  const response = await route.fetch(); expect(response.status()).toBe(201); committed = (await response.json()).data.registro.id; await route.abort('failed');
 });
 await page.getByRole('button',{name:'Guardar operación'}).click(); await expect.poll(() => committed).not.toBe('');
 await expect(page.getByText(/podría haberse guardado/i)).toBeVisible();
 await page.evaluate(() => {
  const key = Object.keys(localStorage).find(k => k.startsWith('sitrep:eventual-form:v1:'));
  if (!key) throw Error('No existe borrador artificial');
  const record = JSON.parse(localStorage.getItem(key)!); delete record.value.pendingCreate;
  record.value.motivo = 'QA edición de otra pestaña'; record.revision = 'simulated-stale-tab';
  localStorage.setItem(key, JSON.stringify(record));
 });
 const context = page.context(); await page.close(); const reopened = await context.newPage();
 await reopened.goto(prefix(info) + '/manifiestos/baja-intensidad'); await openForm(reopened);
 await expect(reopened.getByText('Motivo del envío a comprobar: ' + marker)).toBeVisible();
 if (info.project.name === 'app') {
  await reopened.setViewportSize({ width:320, height:844 });
  expect(await reopened.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
 }
 await expect(reopened.getByRole('button',{name:'Guardar operación'})).toHaveCount(0);
 await reopened.getByRole('button',{name:'Comprobar envío'}).click(); await expect(reopened).toHaveURL(/registro=/);
 await expect(reopened.getByText(/Conservamos las copias locales/)).toBeVisible();
 const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
 try {
  const rows = await db.registroManifiestoExcepcional.findMany({ where:{ datos:{ path:['motivo'], equals:marker } }, select:{id:true} });
  expect(rows).toEqual([{id:committed}]);
 } finally { await db.$disconnect(); }
 await reopened.getByRole('button',{name:'Ver registros'}).click(); await openForm(reopened);
 await expect(reopened.getByLabel('Motivo del registro excepcional')).toHaveValue('QA edición de otra pestaña');
 await expect(reopened.getByRole('button',{name:'Guardar operación'})).toBeEnabled();
});
