import { devices, expect, test, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-cut-8a95517d-concurrency-20261028/fixture.json', 'utf8'));
const phase = process.env.QA_ADENDA_PHASE;
const { PrismaClient } = backendRequire('@prisma/client');
let db: InstanceType<typeof PrismaClient>;

test.beforeAll(async () => {
  await assertCloudDatabase();
  expect(new URL(process.env.DATABASE_URL!).searchParams.get('schema')).toBe('proposal_operations_20261021');
  expect(process.env.QA_ARTIFACTS).toBe('/work/sitrep/.qa-adenda-recovery-20261030');
  expect(process.env.DISABLE_EMAILS).toBe('true');
  expect(process.env.PUSH_MANIFEST_NOTICES_ENABLED).toBe('false');
  expect(fixture.database).toBe('sitrep_night_qa_20260926');
  expect(['before', 'after']).toContain(phase);
  db = new PrismaClient();
  const users = await db.usuario.findMany({ where: { id: { in: ['generador', 'transportista', 'operador'].map(role => fixture.users[role]) } }, select: { email: true } });
  expect(users).toHaveLength(3);
  for (const user of users) expect(user.email).toMatch(/@night-qa\.invalid$/);
});
test.afterAll(async () => { await db?.$disconnect(); });

async function manifest() {
  return db.manifiesto.create({ data: { numero: 'QA-ADENDA-' + randomUUID(), estado: 'RECIBIDO',
    generadorId: fixture.actors.generador, transportistaId: fixture.actors.transportista, operadorId: fixture.actors.operador,
    creadoPorId: fixture.users.generador, isDemoData: true, modalidad: 'FIJO',
    residuos: { create: [{ tipoResiduoId: fixture.wastes[0], cantidad: 10, unidad: 'kg', estado: 'SOLIDO' }] } } });
}
const route = (info: TestInfo, id: string) => prefix(info) + '/manifiestos/' + id + '/adendas';
async function startFinding(page: Page, marker: string) {
  const button = page.getByRole('button', { name: 'Informar hallazgo' }); await expect(button).toBeEnabled(); await button.click();
  await page.getByLabel('Motivo de la adenda').fill(marker);
}
async function anotherPage(page: Page, info: TestInfo) {
  const other = await page.context().newPage(); await isolatedMapTiles(other, info); return other;
}
async function resume(page: Page) {
  await expect.poll(async () => page.evaluate(async () => (await navigator.locks.query()).held?.some(lock => lock.name.startsWith('sitrep:inspection-draft:adenda:')) ?? false)).toBe(false);
  await page.getByRole('button', { name: 'Volver a comprobar' }).click();
}

test('una respuesta perdida conserva el envío exacto y no registra otro', async ({ page }, info) => {
  const item = await manifest(), marker = 'QA hallazgo ' + randomUUID();
  await login(page, info, 'operador'); await page.goto(route(info, item.id)); await startFinding(page, marker);
  let committed = '', posts = 0;
  await page.route('**/api/manifiestos/*/adendas', async intercepted => {
    if (intercepted.request().method() !== 'POST') return intercepted.continue();
    posts++; const response = await intercepted.fetch(); expect(response.status()).toBe(201);
    committed = (await response.json()).data.adenda.id; await intercepted.abort('failed');
  });
  await page.getByRole('button', { name: 'Guardar y solicitar revisión' }).click();
  await expect.poll(() => committed).not.toBe('');
  if (phase === 'before') {
    await expect(page.getByLabel('Motivo de la adenda')).toBeEnabled();
    await page.getByLabel('Motivo de la adenda').fill(marker + ' modificado');
    await page.getByRole('button', { name: 'Guardar y solicitar revisión' }).click();
    await expect.poll(() => posts).toBe(2);
    await expect.poll(() => db.adendaManifiesto.count({ where: { manifiestoId: item.id } })).toBe(2);
  } else {
    await expect(page.getByRole('button', { name: 'Comprobar envío' })).toBeEnabled();
    await expect(page.getByLabel('Motivo de la adenda')).toBeDisabled();
    const context = page.context(); await page.close(); const reopened = await context.newPage(); await isolatedMapTiles(reopened, info); await reopened.goto(route(info, item.id));
    await reopened.getByRole('button', { name: 'Comprobar envío' }).click();
    await expect(reopened.getByText(/La acción quedó registrada/)).toBeVisible();
    expect(posts).toBe(1);
    const rows = await db.adendaManifiesto.findMany({ where: { manifiestoId: item.id }, select: { id: true, motivo: true } });
    expect(rows).toEqual([{ id: committed, motivo: marker }]);
    const notices = await db.notificacion.findMany({ where: { datos: { contains: committed }, titulo: 'Nueva adenda en tu manifiesto' }, select: { usuarioId: true, datos: true, usuario: { select: { email: true } } } });
    const recipients = notices.map((notice: { usuarioId: string }) => notice.usuarioId);
    expect(recipients).toContain(fixture.users.generador); expect(recipients).toContain(fixture.users.transportista);
    for (const role of ['generador2', 'transportista2', 'operador2']) expect(recipients).not.toContain(fixture.users[role]);
    expect(new Set(recipients).size).toBe(recipients.length);
    for (const notice of notices) expect(notice.usuario.email).toMatch(/@night-qa\.invalid$/);
    const representative = notices.find((notice: any) => notice.usuario.email === 'draft-multirole-20261024@night-qa.invalid');
    expect(JSON.parse(representative!.datos!).accesosEmpresa).toEqual(expect.arrayContaining([expect.objectContaining({ rol: 'TRANSPORTISTA' })]));
    await reopened.screenshot({ path: info.outputPath('confirmacion-adenda.png'), animations: 'disabled' });
  }
});

test('sin guardar la referencia el dispositivo no envía la adenda', async ({ page }, info) => {
  const item = await manifest(), marker = 'QA storage ' + randomUUID();
  await login(page, info, 'operador'); await page.goto(route(info, item.id)); await startFinding(page, marker);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key: string, value: string) {
      if (key.startsWith('sitrep:adenda-submission:') || (key.startsWith('sitrep:adenda-form:') && JSON.parse(value).value?.pending)) throw new Error('QA storage unavailable');
      return original.call(this, key, value);
    };
  });
  let posts = 0; await page.route('**/api/manifiestos/*/adendas', async intercepted => {
    if (intercepted.request().method() === 'POST') posts++; await intercepted.continue();
  });
  await page.getByRole('button', { name: 'Guardar y solicitar revisión' }).click();
  if (phase === 'before') await expect.poll(() => posts).toBe(1);
  else {
    await expect(page.getByRole('alert').filter({ hasText: /No se pudo confirmar|Todavía no se envió/ })).toBeVisible();
    expect(posts).toBe(0);
    expect(await db.adendaManifiesto.count({ where: { manifiestoId: item.id } })).toBe(0);
    await expect(page.getByLabel('Motivo de la adenda')).toHaveValue(marker);
  }
});

test('una sola pestaña edita y la otra recupera lo guardado', async ({ page }, info) => {
  const item = await manifest(), marker = 'QA pestañas ' + randomUUID();
  await login(page, info, 'operador'); await page.goto(route(info, item.id)); await startFinding(page, marker);
  const other = await anotherPage(page, info); await other.goto(route(info, item.id));
  if (phase === 'before') await expect(other.getByLabel('Motivo de la adenda')).toBeEnabled();
  else {
    await expect(other.getByText(/Este borrador está abierto en otra pestaña/)).toBeVisible();
    await expect(other.getByLabel('Motivo de la adenda')).toBeDisabled();
    await page.close(); await resume(other);
    await expect(other.getByLabel('Motivo de la adenda')).toHaveValue(marker);
    await expect(other.getByLabel('Motivo de la adenda')).toBeEnabled();
  }
});

if (phase === 'after') test('una revisión conserva otra nota y avisa a las partes', async ({ browser }, info) => {
  const item = await manifest(), base = 'http://127.0.0.1:4177';
  const surface = info.project.name === 'app' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }
    : { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } };
  const actor = await browser.newContext({ ...surface, baseURL: base, serviceWorkers: 'block' });
  const counterpart = await browser.newContext({ ...surface, baseURL: base, serviceWorkers: 'block' });
  try {
    const operator = await actor.newPage(); await login(operator, info, 'operador');
    const ids = [randomUUID(), randomUUID()];
    for (const id of ids) {
      const status = await operator.evaluate(async ({ id, manifestId }) => {
        const token = localStorage.getItem('sitrep_access_token');
        return (await fetch('/api/manifiestos/' + manifestId + '/adendas', { method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, motivo: 'QA adenda para revisar', residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }] }) })).status;
      }, { id, manifestId: item.id });
      expect(status).toBe(201);
    }
    const generator = await counterpart.newPage(); await login(generator, info, 'generador'); await generator.goto(route(info, item.id));
    const first = generator.getByRole('region', { name: 'Adenda ' + ids[0] });
    const second = generator.getByRole('region', { name: 'Adenda ' + ids[1] });
    await first.getByLabel('Motivo de resolución').fill('QA primera decisión');
    await second.getByLabel('Motivo de resolución').fill('QA segunda nota conservada');
    await first.getByRole('button', { name: 'Observar' }).click();
    await expect(generator.getByText(/La acción quedó registrada/)).toBeVisible();
    await expect(second.getByLabel('Motivo de resolución')).toHaveValue('QA segunda nota conservada');
    await generator.reload(); await expect(second.getByLabel('Motivo de resolución')).toHaveValue('QA segunda nota conservada');
    const saved = await db.adendaManifiesto.findUniqueOrThrow({ where: { id: ids[0] } });
    expect(saved.revisiones).toHaveLength(1);
    expect((saved.revisiones as any[])[0]).toMatchObject({ autorId: fixture.users.generador, decision: 'OBSERVADA', nota: 'QA primera decisión' });
    const notices = await db.notificacion.findMany({ where: { datos: { contains: ids[0] }, titulo: 'Adenda observada' }, select: { usuarioId: true, datos: true, usuario: { select: { email: true } } } });
    const recipients = notices.map((notice: { usuarioId: string }) => notice.usuarioId);
    expect(recipients).toContain(fixture.users.operador); expect(recipients).toContain(fixture.users.transportista);
    for (const role of ['generador2', 'transportista2', 'operador2']) expect(recipients).not.toContain(fixture.users[role]);
    expect(new Set(recipients).size).toBe(recipients.length);
    for (const notice of notices) expect(notice.usuario.email).toMatch(/@night-qa\.invalid$/);
    const representative = notices.find((notice: any) => notice.usuario.email === 'draft-multirole-20261024@night-qa.invalid');
    expect(JSON.parse(representative!.datos!).accesosEmpresa).toEqual(expect.arrayContaining([expect.objectContaining({ rol: 'TRANSPORTISTA' })]));
  } finally { await actor.close(); await counterpart.close(); }
});

if (phase === 'after') test('un navegador sin bloqueo seguro informa y no habilita la edición', async ({ page }, info) => {
  const item = await manifest();
  await page.context().addInitScript(() => { Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }); });
  await login(page, info, 'operador'); await page.goto(route(info, item.id));
  const notice = page.getByRole('alert').filter({ hasText: 'Este navegador no permite proteger la edición' });
  await expect(notice).toBeVisible();
  await expect(page.getByRole('button', { name: 'Informar hallazgo' })).toBeDisabled();
  if (info.project.name === 'app') for (const width of [320, 393]) {
    await page.setViewportSize({ width, height: 844 });
    const button = notice.getByRole('button', { name: 'Volver a comprobar' }); await button.scrollIntoViewIfNeeded();
    const metrics = await button.evaluate(element => {
      const rect = element.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { height: rect.height, hit: !!hit && (hit === element || element.contains(hit)), overflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(metrics.height).toBeGreaterThanOrEqual(44); expect(metrics.hit).toBe(true); expect(metrics.overflow).toBeLessThanOrEqual(1);
  }
  await page.screenshot({ path: info.outputPath('navegador-sin-bloqueo.png'), animations: 'disabled' });
});

if (phase === 'after') test('web y app del mismo perfil coordinan el borrador', async ({ page }, info) => {
  const item = await manifest(), marker = 'QA web-app ' + randomUUID();
  await login(page, info, 'operador'); await page.goto(route(info, item.id)); await startFinding(page, marker);
  const other = await anotherPage(page, info);
  await other.goto((info.project.name === 'app' ? '' : '/app') + '/manifiestos/' + item.id + '/adendas');
  await expect(other.getByText(/Este borrador está abierto en otra pestaña/)).toBeVisible();
  await page.close(); await resume(other);
  await expect(other.getByLabel('Motivo de la adenda')).toHaveValue(marker);
  await expect(other.getByLabel('Motivo de la adenda')).toBeEnabled();
});
