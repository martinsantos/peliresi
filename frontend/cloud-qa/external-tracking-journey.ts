import { expect, type Page } from '@playwright/test';

export async function externalTrackingJourney(page: Page, prefix: string, hideKeyboard = async () => {}) {
  const writes: string[] = [];
  const recordWrite = (request: import('@playwright/test').Request) => {
    if (request.url().includes('/api/manifiestos/baja-intensidad') && request.method() !== 'GET') writes.push(request.method());
  };
  page.on('request', recordWrite);
  try {
    await page.goto('http://127.0.0.1:4177' + prefix + '/manifiestos/baja-intensidad');
    await page.getByRole('button', { name: 'Seguimiento de participantes', exact: true }).click();
    await page.getByLabel('Identificación exacta', { exact: true }).fill('QA-TRACKING-SHARED');
    await hideKeyboard();
    await page.getByRole('button', { name: 'Consultar', exact: true }).click();
    const summary = page.getByRole('region', { name: 'Resumen del seguimiento' });
    await expect(summary).toContainText('21 movimientos · Generadores');
    await expect(summary).toContainText('Y1 · 105 kg');
    await expect(summary).toContainText('Y1 · 21 l');
    await expect(page.getByRole('link', { name: 'Ver registro', exact: true })).toHaveCount(20);
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Ver registro', exact: true })).toHaveCount(1);
    await expect(summary).toContainText('Y2 · 84 kg');
    await expect(page.getByRole('button', { name: 'Siguiente', exact: true })).toBeDisabled();
    await page.getByRole('link', { name: 'Ver registro', exact: true }).click();
    await page.getByText('Identidades declaradas', { exact: true }).click();
    await expect(page.getByText('QA seguimiento aislado', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ver registros', exact: true }).click();
    await page.getByRole('button', { name: 'Seguimiento de participantes', exact: true }).click();
    await page.getByLabel('Tipo de participante', { exact: true }).selectOption('transportista');
    await page.getByLabel('Identificación exacta', { exact: true }).fill('QA-TRACKING-SHARED');
    await hideKeyboard();
    await page.getByRole('button', { name: 'Consultar', exact: true }).click();
    await expect(summary).toContainText('1 movimiento · Transportistas');
    await expect(summary).toContainText('Y1 · 5 kg');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole('heading', { name: 'Participantes sin vínculo al padrón', exact: true }).scrollIntoViewIfNeeded();
    expect(writes).toEqual([]);
  } finally { page.off('request', recordWrite); }
}
