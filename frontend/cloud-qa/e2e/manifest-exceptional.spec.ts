import { test, expect } from '@playwright/test';
import { login, prefix, readablePageHeading } from './helpers';
import { createExceptionalJourney, continueExceptionalJourney, reviewExceptionalJourney } from '../exceptional-journey';

test('baja intensidad continues with independent post-facto review and preserved facts', async ({ page, browser }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await login(page, info, 'operador');
  const id = await createExceptionalJourney(page, prefix(info));
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

test('mixed participant keeps identity and grants only the linked actor read access', async ({ page, browser }, info) => {
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
    await expect(participant.getByRole('button', { name: 'Registrar retirado', exact: true })).toHaveCount(0);
    await expect(participant.getByRole('button', { name: 'Aprobar post facto', exact: true })).toHaveCount(0);
    await participant.screenshot({ path: info.outputPath('exceptional-linked-readonly.png') });
  } finally { await context.close(); }
});
