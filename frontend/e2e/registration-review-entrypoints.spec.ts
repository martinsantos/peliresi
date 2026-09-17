import { expect, test } from '@playwright/test';
import { loginWithCredentials } from './helpers/auth';

const enabled = process.env.QA_CONFIRM_ISOLATED === 'YES'
  && process.env.QA_E2E_CONFIRM === 'YES'
  && process.env.QA_E2E_ENABLED === 'true'
  && process.env.DISABLE_EMAILS === 'true'
  && Boolean(process.env.QA_ADMIN_PASSWORD);

const reviewForms = [
  { label: 'Generador', path: '/inscripcion/generador?modo=revision', lastStep: /Paso 7 de 7: Resumen/i },
  { label: 'Transportista', path: '/inscripcion/transportista?modo=revision', lastStep: /Paso 5 de 5: Resumen/i },
  { label: 'Operador', path: '/inscripcion/operador?modo=revision', lastStep: /Paso 8 de 8: Resumen/i },
] as const;

test.describe('registration review entry points — isolated QA only', () => {
  test.skip(!enabled, 'Requires isolated QA with emails disabled');

  test('public portada exposes review links and review mode skips required fields', async ({ page }, testInfo) => {
    const prefix = testInfo.project.name === 'mobile' ? '/app' : '';
    const portada = testInfo.project.name === 'mobile' ? `${prefix}/login` : '/';
    const browserErrors: string[] = [];
    const solicitudMutations: string[] = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('request', (request) => {
      if (/\/api\/solicitudes(?:\/|\?|$)/.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        solicitudMutations.push(`${request.method()} ${request.url()}`);
      }
    });

    await page.goto(portada);
    for (const reviewForm of reviewForms) {
      await expect(page.getByRole('link', {
        name: new RegExp(`Probar formulario de ${reviewForm.label} sin completar datos`, 'i'),
      })).toHaveAttribute('href', `${prefix}${reviewForm.path}`);
    }
    await page.screenshot({ path: testInfo.outputPath('portada-altas.png'), fullPage: true });

    await page.getByRole('link', { name: /Probar formulario de Generador sin completar datos/i }).click();
    await expect(page.getByText(/Modo revisión de alta/i)).toBeVisible();
    await page.getByPlaceholder('Empresa S.A.').fill('');
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await expect(page.getByRole('button', { name: /Paso 2 de 7: Regulatorio/i })).toHaveAttribute('aria-current', 'step');

    expect(browserErrors).toEqual([]);
    expect(solicitudMutations).toEqual([]);
  });

  test('admin can see and traverse all three non-mutating wizards', async ({ page }, testInfo) => {
    const prefix = testInfo.project.name === 'mobile' ? '/app' : '';
    const browserErrors: string[] = [];
    const solicitudMutations: string[] = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('request', (request) => {
      if (/\/api\/solicitudes(?:\/|\?|$)/.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        solicitudMutations.push(`${request.method()} ${request.url()}`);
      }
    });

    await loginWithCredentials(page, {
      email: process.env.QA_ADMIN_EMAIL || 'qa.admin@sitrep.local',
      password: process.env.QA_ADMIN_PASSWORD || '',
      startPath: `${prefix}/login`,
      clickLoginLink: false,
    });
    await page.goto(`${prefix}/admin/solicitudes`);

    await expect(page.getByRole('heading', { name: 'Formularios de prueba' })).toBeVisible();
    await expect(page.getByText(/no crea cuentas, no guarda solicitudes/i)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('formularios-prueba.png'), fullPage: true });

    for (const reviewForm of reviewForms) {
      const entry = page.getByRole('link', { name: new RegExp(`formulario de prueba de ${reviewForm.label}`, 'i') });
      await expect(entry).toBeVisible();
      await expect(entry).toHaveAttribute('href', `${prefix}${reviewForm.path}`);

      await page.goto(`${prefix}${reviewForm.path}`);
      await expect(page.getByText(/Modo revisión de alta/i)).toBeVisible();
      await page.getByRole('button', { name: reviewForm.lastStep }).click();
      await expect(page.getByRole('button', { name: reviewForm.lastStep })).toHaveAttribute('aria-current', 'step');
      await page.goto(`${prefix}/admin/solicitudes`);
    }

    expect(browserErrors).toEqual([]);
    expect(solicitudMutations).toEqual([]);
  });
});
