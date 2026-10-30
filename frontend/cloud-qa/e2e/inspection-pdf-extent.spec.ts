import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
test('downloads a readable long inspection act from the actual interface', async ({ page }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'browser-fixture.json'), 'utf8'));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 500) errors.push(`API ${response.status()}`); });
  await login(page, info);
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`${prefix(info)}/inspecciones/${fixture.inspection.id}`);
  await expect(page.getByRole('heading', { name: fixture.inspection.numero, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Otras descargas' }).click();
  const actButton = page.getByRole('button', { name: /Acta de inspección.*Registro de campo/ });
  await expect(actButton).toBeVisible({ timeout: 10000 });
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await actButton.click({ timeout: 10000 });
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('acta_inspeccion_');
  const file = info.outputPath('acta.pdf');
  await download.saveAs(file);
  expect(readFileSync(file).subarray(0, 4).toString()).toBe('%PDF');
  const layout = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
  for (const marker of ['QAMOTIVOINICIO', 'QAMOTIVOFINAL', 'QAREQUERIMIENTOINICIO', 'QAREQUERIMIENTOFINAL', 'QAOBSFINAL']) {
    expect(layout).toContain(marker);
  }
  const pages = layout.split('\f').filter((value: string) => value.trim());
  expect(pages.length).toBeGreaterThanOrEqual(3);
  for (const p of pages) expect(p).toContain('ACTA DE INSPECCIÓN / CONSTATACIÓN');
  const bbox = execFileSync('pdftotext', ['-bbox', file, '-'], { encoding: 'utf8' });
  const words = [...bbox.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)];
  for (const word of words.filter(match => /^QA(?:MOTIVO|REQUERIMIENTO)/.test(match[5]))) {
    expect(Number(word[4]), word[5]).toBeLessThan(759.89);
  }
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('inspection-before-download.png'), animations: 'disabled', scale: 'css' });
  writeFileSync(info.outputPath('inspection-pdf-proof.json'), JSON.stringify({ synthetic: true, surface: info.project.name,
    pages: pages.length, fieldMarkersPresent: true, headedPages: true, errors }, null, 2));
});
