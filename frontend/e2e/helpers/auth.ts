import { expect, type Page } from '@playwright/test';

export const ADMIN_EMAIL = 'admin@dgfa.mendoza.gov.ar';
export const ADMIN_PASS = 'admin123';
export const GENERADOR_EMAIL = 'quimica.mendoza@industria.com';
export const GENERADOR_PASS = 'gen123';
export const TRANSPORTISTA_EMAIL = 'transportes.andes@logistica.com';
export const TRANSPORTISTA_PASS = 'trans123';
export const OPERADOR_EMAIL = 'tratamiento.residuos@planta.com';
export const OPERADOR_PASS = 'op123';

const RATE_LIMIT_TEXT = /Demasiados intentos de autenticaci.n/i;

export async function dismissBlockingOnboarding(page: Page) {
  const skipIntro = page.getByRole('button', { name: /saltar introducci.n/i }).first();
  if (await skipIntro.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skipIntro.click();
    await expect(skipIntro).not.toBeVisible({ timeout: 5000 }).catch(() => {});
  }

  const closeButton = page.getByRole('button', { name: /cerrar/i }).first();
  if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeButton.click();
  }
}

type LoginOptions = {
  email: string;
  password: string;
  onboardingRole?: string;
  startPath?: string;
  clickLoginLink?: boolean;
};

export async function loginWithCredentials(page: Page, options: LoginOptions) {
  await page.addInitScript(() => {
    localStorage.setItem('sitrep_onboarding_ADMIN', 'true');
    localStorage.setItem('sitrep_onboarding_GENERADOR', 'true');
    localStorage.setItem('sitrep_onboarding_TRANSPORTISTA', 'true');
    localStorage.setItem('sitrep_onboarding_OPERADOR', 'true');
  });

  await page.goto(options.startPath ?? '/');
  if (options.clickLoginLink ?? true) {
    const loginBtn = page.getByText(/iniciar sesi.n/i).first();
    await loginBtn.waitFor({ timeout: 15000 });
    await loginBtn.click();
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[placeholder="********"]').first();
    await emailInput.waitFor({ timeout: 15000 });
    await emailInput.fill(options.email);
    await passwordInput.fill(options.password);
    await expect(emailInput).toHaveValue(options.email, { timeout: 5000 });

    await page.getByRole('button', { name: /iniciar|entrar|ingresar/i }).click();

    const reachedAuthOutcome = await page.waitForFunction(
      (rateLimitPattern) => {
        const bodyText = document.body?.innerText || '';
        return (
          new RegExp(rateLimitPattern, 'i').test(bodyText) ||
          !!document.querySelector('aside, main, nav') ||
          /Inicio|Buenos d.as|Accesos R.pidos/i.test(bodyText)
        );
      },
      RATE_LIMIT_TEXT.source,
      { timeout: 25000 },
    ).then(() => true).catch(() => false);

    if (!reachedAuthOutcome) {
      const stillOnLogin = await emailInput.isVisible().catch(() => false);
      if (stillOnLogin && attempt === 0) continue;
      throw new Error(`Login ${options.onboardingRole ?? options.email} did not reach an authenticated state`);
    }

    const rateLimited = await page.getByText(RATE_LIMIT_TEXT).first().isVisible().catch(() => false);
    if (!rateLimited) {
      await expect(page.locator('aside, main, nav').first()).toBeVisible({ timeout: 20000 });
      await dismissBlockingOnboarding(page);
      return;
    }

    if (attempt === 1) break;
    await page.waitForTimeout(65_000);
  }

  throw new Error(`Login ${options.onboardingRole ?? options.email} rate-limited after retry window`);
}

export async function loginAsAdmin(page: Page) {
  await loginWithCredentials(page, { email: ADMIN_EMAIL, password: ADMIN_PASS, onboardingRole: 'ADMIN' });
}

export async function loginAsGenerador(page: Page) {
  await loginWithCredentials(page, { email: GENERADOR_EMAIL, password: GENERADOR_PASS, onboardingRole: 'GENERADOR' });
}

export async function loginAsTransportista(page: Page) {
  await loginWithCredentials(page, { email: TRANSPORTISTA_EMAIL, password: TRANSPORTISTA_PASS, onboardingRole: 'TRANSPORTISTA' });
}

export async function loginAsOperador(page: Page) {
  await loginWithCredentials(page, { email: OPERADOR_EMAIL, password: OPERADOR_PASS, onboardingRole: 'OPERADOR' });
}
