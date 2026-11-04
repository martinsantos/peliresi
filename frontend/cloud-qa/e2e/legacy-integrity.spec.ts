import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { login, prefix } from './helpers';

const fixture = async () => JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'legacy-integrity-fixture.json'), 'utf8'));

test('a damaged proposal no longer hides the agenda or invents an action', async ({ page }, info) => {
  const f = await fixture(); expect(f).toMatchObject({ synthetic: true, production: false, externalDelivery: false, capClosed: true });
  await login(page, info, 'operador');
  const response = await page.evaluate(async (search) => {
    const token = localStorage.getItem('sitrep_access_token');
    const result = await fetch('/api/manifiestos/tareas-partes?search=' + encodeURIComponent(search) + '&limit=50', { headers: { Authorization: `Bearer ${token}` } });
    return { status: result.status, body: await result.json() };
  }, f.prefix);
  expect(response.status).toBe(200);
  const rows = response.body.data.items;
  for (const key of ['missing', 'invalid', 'mismatch', 'origin', 'badEvidence']) expect(rows.find((row: any) => row.id === f.cases[key].id)).toMatchObject({ requiereRevisionPropuesta: true, requiereMiAprobacion: false, partes: null });
  expect(rows.find((row: any) => row.id === f.cases.ordinary.id)).toMatchObject({ requiereRevisionPropuesta: false, requiereMiAprobacion: true });
  await page.goto(`${prefix(info)}/dashboard`);
  const queue = page.getByRole('region', { name: 'Agenda de manifiestos' });
  await expect(queue).toBeVisible();
  await queue.getByRole('button', { name: 'Filtrar', exact: true }).click();
  await queue.getByLabel('Buscar manifiesto en agenda').fill(f.cases.invalid.numero);
  const bad = queue.getByRole('link', { name: new RegExp(f.cases.invalid.numero) });
  await expect(bad).toContainText('Propuesta por revisar');
  await queue.getByLabel('Buscar manifiesto en agenda').fill(f.cases.ordinary.numero);
  await expect(queue.getByRole('link', { name: new RegExp(f.cases.ordinary.numero) })).toContainText('Te toca aprobar');
  await queue.getByLabel('Buscar manifiesto en agenda').fill(f.cases.invalid.numero);
  await expect(bad).toContainText('Propuesta por revisar');
  await expect(queue.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('agenda-mixed-cases.png'), animations: 'disabled' });
  await bad.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Contactá a Ambiente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Firmar Manifiesto' })).toHaveCount(0);
  await page.goto(`${prefix(info)}/manifiestos/${f.cases.origin.id}`);
  await expect(page.getByRole('alert').filter({ hasText: 'Contactá a Ambiente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar recepción en origen' })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('origin-review.png'), animations: 'disabled' });
});

test('carrier cannot start an inconsistent proposal but can start a complete one', async ({ page }, info) => {
  const f = await fixture(); await login(page, info, 'transportista');
  const check = await page.evaluate(async ({ invalid, badEvidence, valid }) => {
    const token = localStorage.getItem('sitrep_access_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const read = async (id: string) => (await (await fetch('/api/manifiestos/' + id, { headers })).json()).data.manifiesto;
    const bad = await read(invalid), badApproval = await read(badEvidence), good = await read(valid);
    const attempt = await fetch('/api/manifiestos/' + invalid + '/confirmar-retiro', { method: 'POST', headers, body: '{}' });
    const after = await read(invalid);
    const otherAttempt = await fetch('/api/manifiestos/' + badEvidence + '/confirmar-retiro', { method: 'POST', headers, body: '{}' });
    return { bad: bad.aprobacionOperacion, badApproval: badApproval.aprobacionOperacion, good: good.aprobacionOperacion, status: attempt.status, otherStatus: otherAttempt.status, after: after.estado };
  }, { invalid: f.cases.mismatch.id, badEvidence: f.cases.badEvidence.id, valid: f.cases.valid.id });
  expect(check).toEqual({ bad: 'INCONSISTENTE', badApproval: 'INCONSISTENTE', good: 'LISTA', status: 409, otherStatus: 409, after: 'APROBADO' });
  await page.goto(`${prefix(info)}/transporte/viaje/${f.cases.mismatch.id}`);
  await expect(page.getByRole('heading', { name: 'Revisar aprobaciones' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Contactá a Ambiente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar retiro', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('carrier-review.png'), animations: 'disabled' });
  await page.goto(`${prefix(info)}/transporte/viaje/${f.cases.badEvidence.id}`);
  await expect(page.getByRole('alert').filter({ hasText: 'Contactá a Ambiente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar retiro', exact: true })).toHaveCount(0);
  await page.goto(`${prefix(info)}/transporte/viaje/${f.cases.valid.id}`);
  await expect(page.getByRole('button', { name: 'Confirmar retiro', exact: true })).toBeEnabled();
});

test('an unrelated actor cannot read the synthetic manifest', async ({ page }, info) => {
  const f = await fixture(); await login(page, info, 'generador2');
  const result = await page.evaluate(async ({ id, search }) => {
    const token = localStorage.getItem('sitrep_access_token');
    const headers = { Authorization: `Bearer ${token}` };
    const detail = await fetch('/api/manifiestos/' + id, { headers });
    const agenda = await fetch('/api/manifiestos/agenda-partes?incluirPendientes=true&search=' + encodeURIComponent(search), { headers });
    return { status: detail.status, agendaStatus: agenda.status, rows: (await agenda.json()).data.items };
  }, { id: f.cases.invalid.id, search: f.prefix });
  expect(result.status).toBe(404); expect(result.agendaStatus).toBe(200); expect(result.rows).toEqual([]);
});

test('scheduled rows distinguish a review from a coordinated operation', async ({ page }, info) => {
  const f = await fixture(); await login(page, info, 'operador');
  const response = await page.evaluate(async (search) => {
    const token = localStorage.getItem('sitrep_access_token');
    const headers = { Authorization: `Bearer ${token}` };
    const url = '/api/manifiestos/agenda-partes?search=' + encodeURIComponent(search);
    const result = await fetch(url + '&incluirPendientes=true', { headers });
    const legacy = await fetch(url, { headers });
    return { status: result.status, body: await result.json(), legacyStatus: legacy.status, legacyBody: await legacy.json() };
  }, f.prefix);
  expect(response.status).toBe(200); expect(response.legacyStatus).toBe(200);
  const rows = response.body.data.items;
  for (const key of ['mismatch','badEvidence']) expect(rows.find((row: any) => row.id === f.cases[key].id).aprobacionOperacion).toBe('INCONSISTENTE');
  expect(rows.find((row: any) => row.id === f.cases.valid.id).aprobacionOperacion).toBe('LISTA');
  expect(rows.find((row: any) => row.id === f.cases.missing.id).aprobacionOperacion).toBe('SIN_PROPUESTA');
  expect(rows.find((row: any) => row.id === f.cases.ordinary.id).aprobacionOperacion).toBe('FALTAN_APROBACIONES');
  for (const key of ['missing','ordinary']) expect(response.legacyBody.data.items.some((row: any) => row.id === f.cases[key].id)).toBe(false);
  await page.goto(`${prefix(info)}/manifiestos?vista=programados`);
  const agenda = page.getByRole('region', { name: 'Manifiestos programados' });
  await agenda.getByLabel('Buscar manifiesto programado').fill(f.prefix);
  await expect(agenda.getByRole('link', { name: new RegExp(f.cases.mismatch.numero) })).toContainText('Propuesta por revisar');
  await expect(agenda.getByRole('link', { name: new RegExp(f.cases.valid.numero) })).toContainText('Coordinación iniciada');
  await expect(agenda.getByRole('link', { name: new RegExp(f.cases.missing.numero) })).toContainText('Propuesta por revisar');
  await expect(agenda.getByRole('link', { name: new RegExp(f.cases.ordinary.numero) })).toContainText('Faltan aprobaciones');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const assertRefreshUsable = async () => {
    const button = agenda.getByRole('button', { name: 'Actualizar programados', exact: true });
    await button.scrollIntoViewIfNeeded();
    const bounds = await button.evaluate(element => {
      const rect = element.getBoundingClientRect(), parent = element.parentElement!.getBoundingClientRect();
      const points = [rect.left + 3, rect.left + rect.width / 2, rect.right - 3];
      return { width: rect.width, height: rect.height,
        contained: rect.left >= parent.left && rect.right <= parent.right && rect.left >= 0 && rect.right <= innerWidth,
        clickable: points.every(x => { const hit = document.elementFromPoint(x, rect.top + rect.height / 2); return hit === element || element.contains(hit); }) };
    });
    expect(bounds.width).toBeGreaterThanOrEqual(44); expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.contained).toBe(true); expect(bounds.clickable).toBe(true);
    const refresh = page.waitForResponse(response => response.url().includes('/manifiestos/agenda-partes') && response.request().method() === 'GET');
    await button.click(); expect((await refresh).status()).toBe(200);
  };
  if (info.project.name === 'web-desktop') for (const width of [320, 393, 768, 1365, 1920]) {
    await page.setViewportSize({ width, height: 850 });
    await assertRefreshUsable();
    const row = agenda.getByRole('link', { name: new RegExp(f.cases.mismatch.numero) });
    await row.scrollIntoViewIfNeeded();
    const bounds = await row.evaluate(element => {
      const text = [...element.querySelectorAll('span')].find(span => span.textContent === 'Propuesta por revisar');
      if (!text) throw new Error('Missing review label');
      const parent = element.getBoundingClientRect(), label = text.getBoundingClientRect();
      const hit = document.elementFromPoint(label.left + label.width / 2, label.top + label.height / 2);
      return { inside: label.left >= parent.left && label.right <= parent.right && label.top >= parent.top && label.bottom <= parent.bottom, visible: hit === text || text.contains(hit), height: parent.height };
    });
    expect(bounds.inside, `status contained at ${width}px`).toBe(true);
    expect(bounds.visible, `status unobscured at ${width}px`).toBe(true);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `overflow at ${width}px`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath(`scheduled-${width}px.png`), animations: 'disabled' });
  }
  if (info.project.name === 'app') await assertRefreshUsable();
  await page.screenshot({ path: info.outputPath('scheduled-review.png'), animations: 'disabled' });
});
