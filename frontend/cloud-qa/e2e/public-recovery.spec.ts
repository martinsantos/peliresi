import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { prefix, readableFixedAction } from './helpers';

test('public recovery: framed controls, real offline failure and non-enumerating retry', async ({ page, context }, info) => {
  const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
  expect(fixture.database).toBe('sitrep_night_qa_20260926');
  expect(fixture.externalDelivery).toBe(false);
  const attempts: Array<{ payload: unknown; url: string }> = [];
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/auth/forgot-password')) {
      expect(new URL(request.url()).hostname).toBe('127.0.0.1');
      attempts.push({ payload: request.postDataJSON(), url: request.url() });
    }
  });
  await page.goto(prefix(info) + '/recuperar');
  const heading = page.getByRole('heading', { name: 'Recuperar contraseña', exact: true });
  await expect(heading).toBeVisible();
  const frame = page.locator('main.auth-form-panel');
  await expect(frame).toBeVisible();
  const spacing = await heading.evaluate(element => {
    const form = element.closest('main')!;
    const bounds = form.getBoundingClientRect();
    const content = element.parentElement!.getBoundingClientRect();
    return { left: content.left - bounds.left, right: bounds.right - content.right,
      insideViewport: content.left >= 0 && content.right <= innerWidth,
      padding: getComputedStyle(form).padding };
  });
  expect(spacing.left).toBeGreaterThanOrEqual(16);
  expect(spacing.right).toBeGreaterThanOrEqual(16);
  expect(spacing.insideViewport).toBe(true);
  const email = page.getByRole('button', { name: 'Email', exact: true });
  const cuit = page.getByRole('button', { name: 'CUIT', exact: true });
  await readableFixedAction(email, frame);
  await readableFixedAction(cuit, frame);
  await readableFixedAction(page.getByRole('link', { name: 'Volver al login' }), frame);
  await expect(email).toHaveAttribute('aria-pressed', 'true');
  await cuit.click();
  await expect(cuit).toHaveAttribute('aria-pressed', 'true');
  await expect(email).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('CUIT', { exact: true })).toHaveAttribute('inputmode', 'numeric');
  await email.click();
  // A deliberately nonexistent synthetic mailbox: no reset token, account or
  // outbound delivery is needed to exercise the real non-enumerating API.
  const identifier = 'qa-recovery-unregistered-' + process.env.GITHUB_RUN_ID + '@night-qa.invalid';
  await page.getByLabel('Email', { exact: true }).fill(identifier);
  await context.setOffline(true);
  try {
    await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(/Intentá de nuevo/);
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue(identifier);
    await page.screenshot({ path: info.outputPath('recovery-offline.png'), animations: 'disabled', scale: 'css' });
  } finally { await context.setOffline(false); }
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/auth/forgot-password'));
  await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Revisá tu email', exact: true })).toBeVisible();
  await expect(page.getByText('Si el email existe en el sistema, recibirás un enlace para restablecer tu contraseña.', { exact: true })).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts.map(attempt => attempt.payload)).toEqual([{ email: identifier }, { email: identifier }]);
  await page.screenshot({ path: info.outputPath('recovery-retry.png'), animations: 'disabled', scale: 'css' });
  await info.attach('recovery-real-attempts', { body: JSON.stringify({ spacing, attempts, expectedOfflineFailure: true,
    businessAPIIntercepted: false, sessionsInjected: false, externalDelivery: false, accountCreated: false }), contentType: 'application/json' });
  await page.getByRole('link', { name: 'Volver al login' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
