import { test, expect } from '@playwright/test';
import { login, prefix } from './helpers';

test('an inspection intake notice names its own queue and opens it in the same surface', async ({ page }, info) => {
  await login(page, info, 'admin');
  const token = await page.evaluate(() => localStorage.getItem('sitrep_access_token'));
  let target: { datos: string; titulo: string; mensaje: string } | undefined, noticePage = 1, totalPages = 1;
  do {
    const response = await page.request.get('/api/notificaciones?limit=20&offset=' + (noticePage - 1) * 20, { headers: { Authorization: 'Bearer ' + token } });
    expect(response.status()).toBe(200);
    const data = (await response.json()).data; totalPages = data.totalPaginas;
    target = data.notificaciones.find((notice: { datos: string }) => JSON.parse(notice.datos || '{}').tipo === 'antecedente_fiscalizacion');
    if (target || noticePage >= totalPages) break;
    noticePage++;
  } while (noticePage <= totalPages);
  expect(target).toBeTruthy();
  await page.goto(prefix(info) + '/notificaciones?pagina=' + noticePage);
  const action = page.getByRole('list', { name: 'Avisos', exact: true }).getByRole('button', { name: 'Abrir aviso: ' + target!.titulo, exact: true }).filter({ hasText: target!.mensaje });
  await expect(action).toBeVisible();
  await action.evaluate(element => element.scrollIntoView({ block: 'center' }));
  const destination = action.getByText('Abrir cola de revisión →', { exact: true });
  await expect(destination).toBeInViewport({ ratio: 1 });
  await destination.click({ trial: true });
  await action.screenshot({ path: info.outputPath('notice-destination.png') });
  await expect(action.getByText('Abrir manifiesto y ver qué sigue →', { exact: true })).toHaveCount(0);
  await action.click();
  await expect(page).toHaveURL('http://127.0.0.1:4177' + prefix(info) + '/inspecciones?vista=antecedentes');
  await expect(page.getByRole('region', { name: 'Cola de revisión PSIP', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
