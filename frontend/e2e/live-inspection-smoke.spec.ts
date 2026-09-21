import { expect, test } from '@playwright/test';

const token = process.env.SITREP_QA_ACCESS_TOKEN;
const editableId = process.env.SITREP_QA_EDITABLE_INSPECTION_ID || 'cmu61kwhk009z1297m2qkoc7i';
const reportId = process.env.SITREP_QA_REPORT_INSPECTION_ID || 'cmu5o9ub5001u7k6eae8yak4g';

test.skip(!token, 'SITREP_QA_ACCESS_TOKEN is required for the read-only production smoke test.');

test.beforeEach(async ({ page }) => {
  await page.addInitScript((accessToken) => {
    localStorage.setItem('sitrep_access_token', accessToken);
  }, token);
});

test('live inspection UI keeps list, field evidence and report usable', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  const basePath = mobile ? '/app' : '';
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(`${basePath}/inspecciones`);
  await expect(page.getByRole('heading', { name: 'Inspecciones', level: 2 })).toBeVisible();
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await page.goto(`${basePath}/inspecciones/${editableId}`);
  await expect(page.getByText('Checklist regulatorio', { exact: true })).toBeVisible();
  await expect(page.getByTestId('inspection-action-bar')).toHaveCSS('position', 'static');
  const checklist = page.getByText('Checklist regulatorio', { exact: true }).locator('xpath=ancestor::section[1]');
  await checklist.scrollIntoViewIfNeeded();
  const decodedPhoto = checklist.locator('img[data-loaded="true"]').first();
  await expect(decodedPhoto).toBeVisible();
  expect(await decodedPhoto.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  if (process.env.SITREP_QA_SCREENSHOTS === '1') {
    await decodedPhoto.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/sitrep-live-field-${testInfo.project.name}.png`, fullPage: false });
  }

  await page.goto(`${basePath}/inspecciones/${reportId}`);
  await expect(page.getByRole('heading', { name: 'Informe de inspección' })).toBeVisible();
  await expect(page.getByTestId('inspection-action-bar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exportar informe PDF' })).toBeVisible();
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  if (process.env.SITREP_QA_SCREENSHOTS === '1') await page.screenshot({ path: `/tmp/sitrep-live-report-${testInfo.project.name}.png`, fullPage: false });
  expect(consoleErrors).toEqual([]);
});
