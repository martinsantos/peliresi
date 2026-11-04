import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { login, prefix, readableFixedAction, readableWholeWords } from './helpers';

test('PSIP manual capture shows the actual pending action after ordinary vertical scrolling', async ({ page }, info) => {
  page.setDefaultTimeout(15_000);
  // Preserve a pending synthetic requirement from the earlier trial. Never reset
  // a closed record or create a fake UI state to illustrate a pending action.
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'third-browser-fixture.json'), 'utf8'));
  await login(page, info, 'transportista');
  await page.goto(`${prefix(info)}/mis-inspecciones/${fixture.cases['web-desktop'].TRANSPORTISTA}`);
  await expect(page.getByTestId('inspection-next-step')).toContainText('Tenés requerimientos por responder');
  const action = page.getByRole('button', { name: /^Responder requerimiento #/ });
  await action.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await readableWholeWords(action);
  await readableFixedAction(action, page.getByTestId('inspection-next-step'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('psip-responder-focused.png'), animations: 'disabled' });
});
