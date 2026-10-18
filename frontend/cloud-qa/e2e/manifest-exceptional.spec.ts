import { test, expect } from '@playwright/test';
import { login, prefix, readablePageHeading } from './helpers';
import { approveExceptionalJourney, createExceptionalJourney, continueExceptionalJourney, reviewExceptionalJourney } from '../exceptional-journey';

test('baja intensidad continues with independent post-facto review and preserved facts', async ({ page, browser }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await login(page, info, 'operador');
  const id = await createExceptionalJourney(page, prefix(info));
  await approveExceptionalJourney(page, 'quien lo creó');
  await expect(page.getByText('Aprobación de las partes: aprobado', { exact: true })).toBeVisible();
  await continueExceptionalJourney(page);
  await page.getByRole('status', { name: 'Estado operativo' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('exceptional-operator.png') });
  await readablePageHeading(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const context = await browser.newContext({ viewport: page.viewportSize()! });
  try {
    const reviewer = await context.newPage();
    reviewer.on('pageerror', e => errors.push(e.message));
    reviewer.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await login(reviewer, info, 'admin');
    await reviewExceptionalJourney(reviewer, prefix(info), id);
    await reviewer.getByRole('heading', { name: 'Revisión posterior', exact: true }).scrollIntoViewIfNeeded();
    await reviewer.screenshot({ path: info.outputPath('exceptional-post-facto.png') });
    expect(await reviewer.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await expect(reviewer.locator('vite-error-overlay')).toHaveCount(0);
    await expect(reviewer).toHaveTitle(/SITREP/i);
  } finally { await context.close(); }
  await page.reload();
  await expect(page.getByRole('region', { name: 'Revisión diferencia 1' })).toContainText('Observada');
  expect(errors).toEqual([]);
});

test('mixed participant keeps identity; the linked actor approves its own slot before anything advances', async ({ page, browser }, info) => {
  await login(page, info, 'operador');
  const id = await createExceptionalJourney(page, prefix(info), async () => {}, 'Transportista');
  const context = await browser.newContext({ viewport: page.viewportSize()! });
  try {
    const participant = await context.newPage();
    await login(participant, info, 'transportista');
    await participant.goto('http://127.0.0.1:4177' + prefix(info) + '/manifiestos/baja-intensidad?registro=' + id);
    await expect(participant.getByRole('status', { name: 'Estado operativo' })).toHaveText('Operación: Registrado');
    await participant.getByText('Identidades declaradas', { exact: true }).click();
    await expect(participant.locator('details')).toContainText('QA Transporte 1');
    await expect(participant.locator('details')).toContainText('Vinculado al padrón');
    // Spec v2 §3: a registered party with an account approves its slot; facts stay locked until all approve.
    await expect(participant.getByRole('button', { name: 'Registrar retirado', exact: true })).toBeDisabled();
    await expect(participant.getByRole('button', { name: 'Aprobar como quien lo creó', exact: true })).toHaveCount(0);
    await approveExceptionalJourney(participant, 'transportista');
    await expect(participant.getByText('Aprobación de las partes: pendiente', { exact: true })).toBeVisible();
    await expect(participant.getByRole('button', { name: 'Registrar retirado', exact: true })).toBeDisabled();
    await expect(participant.getByRole('button', { name: 'Aprobar post facto', exact: true })).toHaveCount(0);
    await participant.screenshot({ path: info.outputPath('exceptional-linked-readonly.png') });
  } finally { await context.close(); }
});

test('a generator starts an eventual with every other party external, approves alone and advances', async ({ page }, info) => {
  await login(page, info, 'generador');
  await createExceptionalJourney(page, prefix(info));
  await expect(page.getByRole('button', { name: 'Registrar retirado', exact: true })).toBeDisabled();
  await approveExceptionalJourney(page, 'quien lo creó');
  await expect(page.getByText('Aprobación de las partes: aprobado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar retirado', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Estado operativo' })).toHaveText('Operación: Retirado');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('eventual-generator-alone.png') });
});

test('a generator links a registered operator, who approves before the generator advances', async ({ page, browser }, info) => {
  await login(page, info, 'generador');
  const id = await createExceptionalJourney(page, prefix(info), async () => {}, 'Operador');
  await approveExceptionalJourney(page, 'quien lo creó');
  await expect(page.getByText('Aprobación de las partes: pendiente', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar retirado', exact: true })).toBeDisabled();
  const context = await browser.newContext({ viewport: page.viewportSize()! });
  try {
    const operator = await context.newPage();
    await login(operator, info, 'operador');
    await operator.goto('http://127.0.0.1:4177' + prefix(info) + '/manifiestos/baja-intensidad?registro=' + id);
    await approveExceptionalJourney(operator, 'operador');
    await expect(operator.getByText('Aprobación de las partes: aprobado', { exact: true })).toBeVisible();
    await operator.screenshot({ path: info.outputPath('eventual-operator-approved.png') });
  } finally { await context.close(); }
  await page.reload();
  await page.getByRole('button', { name: 'Registrar retirado', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Estado operativo' })).toHaveText('Operación: Retirado');
});
