import { expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';

export async function reconciliationJourney(page: Page, prefix: string, surface: string, options: {
  hideKeyboard?: () => Promise<void>;
  download?: (click: () => Promise<void>) => Promise<Buffer>;
  evidence?: () => Promise<void>;
} = {}) {
  await page.goto('http://127.0.0.1:4177' + prefix + '/manifiestos/baja-intensidad?vista=seguimiento');
  await page.getByLabel('Identificación exacta', { exact: true }).fill('30-71234567-1');
  await options.hideKeyboard?.();
  await page.getByRole('button', { name: 'Consultar', exact: true }).click();
  const card = page.getByRole('region', { name: /^Movimiento BI-/ }).filter({ has: page.getByRole('heading', { name: 'QA Conciliación ' + surface, exact: true }) });
  await card.getByRole('button', { name: 'Revisar vínculo', exact: true }).click();
  await expect(card.getByText('Sin vínculo confirmado', { exact: true })).toBeVisible();
  await expect(card.getByText('QA Ficha conciliada', { exact: true })).toBeVisible();
  const button = card.getByRole('button', { name: 'Confirmar vínculo', exact: true });
  await expect(button).toBeDisabled();
  await card.getByLabel('Motivo de conciliación').fill('QA revisión de identidad ' + surface);
  await options.hideKeyboard?.();
  await button.click();
  await expect(card.getByText('Vinculado a QA Ficha conciliada', { exact: true })).toBeVisible();
  await page.reload();
  // The query filters are deliberately explicit; URL stores the view, not PII.
  await page.getByLabel('Identificación exacta', { exact: true }).fill('30-71234567-1');
  await options.hideKeyboard?.(); await page.getByRole('button', { name: 'Consultar', exact: true }).click();
  await card.getByRole('button', { name: 'Revisar vínculo', exact: true }).click();
  await expect(card.getByText('Vinculado a QA Ficha conciliada', { exact: true })).toBeVisible();
  const response = page.waitForResponse(r => r.url().includes('/seguimiento/exportar?'));
  const click = () => page.getByRole('button', { name: 'Exportar coincidencias CSV', exact: true }).click();
  let bytes: Buffer;
  if (options.download) bytes = await options.download(click);
  else {
    const wait = page.waitForEvent('download'); await click();
    const download = await wait; expect(download.suggestedFilename()).toBe('participantes-externos.csv');
    const stream = await download.createReadStream(); const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    bytes = Buffer.concat(chunks);
  }
  const exported = await response; expect(exported.status()).toBe(200);
  // CDP decodes text/csv and strips its UTF-8 BOM (run38904379535:
  // server1857 bytes, CDP1854). Compare actual saved bytes with the server's
  // digest and length, not a text-decoded developer-tools representation.
  const headers = exported.headers();
  expect(headers['x-content-sha256']).toMatch(/^[a-f0-9]{64}$/);
  expect(bytes.length).toBe(Number(headers['x-content-bytes']));
  expect(createHash('sha256').update(bytes).digest('hex'), 'Downloaded CSV must be byte-exact').toBe(headers['x-content-sha256']);
  expect(bytes.subarray(0, 3).toString('hex')).toBe('efbbbf');
  const text = bytes.toString('utf8');
  expect(text).toContain('QA Conciliación ' + surface); expect(text).toContain('"VINCULAR"');
  expect(text).toContain('QA Ficha conciliada'); expect(text).toContain('"cantidad_original"');
  await card.getByLabel('Motivo de conciliación').fill('QA rectificación ' + surface);
  await options.hideKeyboard?.();
  await card.getByRole('button', { name: 'Desvincular y conservar historia', exact: true }).click();
  await expect(card.getByText('Sin vínculo confirmado', { exact: true })).toBeVisible();
  await card.getByText('Historial de conciliación (2)', { exact: true }).click();
  await expect(card.getByText('Revisión 1 · Vinculado', { exact: true })).toBeVisible();
  await expect(card.getByText('Revisión 2 · Desvinculado', { exact: true })).toBeVisible();
  await expect(card.getByRole('heading', { name: 'QA Conciliación ' + surface, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await options.evidence?.();
}

export async function compactNoticeProof(page: Page) {
  const notice = page.locator('[data-compact-notice="true"]').first();
  await expect(notice).toBeVisible();
  const geometry = await notice.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const buttons = [...element.querySelectorAll('button')].map(button => {
      const b = button.getBoundingClientRect();
      return { height: b.height, inside: b.left >= rect.left && b.right <= rect.right && b.top >= rect.top && b.bottom <= rect.bottom };
    });
    return { height: rect.height, buttons, overflow: element.scrollWidth - element.clientWidth };
  });
  expect(geometry.height).toBeLessThanOrEqual(60);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.buttons).toHaveLength(2);
  for (const button of geometry.buttons) { expect(button.height).toBeGreaterThanOrEqual(44); expect(button.inside).toBe(true); }
}
