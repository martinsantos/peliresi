import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { login, prefix } from './helpers';

test('baseline offers pickup for inconsistent approved proposal', async ({ page }, info) => {
  const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'legacy-integrity-fixture.json'), 'utf8'));
  expect(fixture).toMatchObject({ synthetic: true, production: false, externalDelivery: false, capClosed: true });
  await login(page, info, 'transportista');
  await page.goto(`${prefix(info)}/transporte/viaje/${fixture.cases.mismatch.id}`);
  await expect(page.getByRole('heading', { name: 'Confirmar retiro', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar retiro', exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('baseline-pickup-enabled.png'), animations: 'disabled' });
});
