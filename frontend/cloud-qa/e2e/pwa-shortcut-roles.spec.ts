import { expect, test } from '@playwright/test';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
const roles = [
  { account: 'admin', label: 'Administrador' },
  { account: 'generador', label: 'Generador' },
  { account: 'transportista', label: 'Transportista' },
  { account: 'operador', label: 'Operador' },
];
for (const role of roles) test(`${role.label}: inicio, QR y avisos conservan el rol`, async ({ page }, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true,
      value: { getUserMedia: () => Promise.reject(new DOMException('Permiso simulado', 'NotAllowedError')) } });
  });
  await login(page, info, role.account);
  if (info.project.name === 'app') {
    const response = await page.request.get('/app/manifest-app.json');
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.shortcuts.map((entry: { name: string }) => entry.name)).toEqual(['Inicio', 'Escanear QR', 'Avisos']);
    expect(manifest.shortcuts.map((entry: { url: string }) => entry.url)).toEqual([
      '/app/dashboard?source=shortcut-home', '/app/escaner-qr?source=shortcut-qr', '/app/notificaciones?source=shortcut-notices',
    ]);
  }
  const base = prefix(info);
  await page.goto(`${base}/dashboard?source=shortcut-home`);
  await expect(page.getByRole('banner').getByLabel('Función actual')).toHaveText(role.label);
  await page.goto(`${base}/escaner-qr?source=shortcut-qr`);
  await expect(page.getByRole('heading', { name: 'Acceso a camara denegado' })).toBeVisible();
  await page.goto(`${base}/notificaciones?source=shortcut-notices`);
  await expect(page.getByTestId('notification-inbox')).toBeVisible();
  await expect(page.getByRole('banner').getByLabel('Función actual')).toHaveText(role.label);
  await page.screenshot({ path: info.outputPath('avisos.png'), animations: 'disabled' });
  if (info.project.name === 'app' && ['generador', 'operador'].includes(role.account)) {
    await page.goto('/app/centro-control?source=shortcut-control');
    await expect(page.getByRole('heading', { name: 'Acceso no disponible' })).toBeVisible();
    await expect(page.getByText(`Rol activo: ${role.label}`)).toBeVisible();
    await page.getByRole('button', { name: 'Ir a Inicio' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);
  }
});
