import { expect, test, type Locator, type Page } from '@playwright/test';

const forms = [
  { slug: 'generador', label: 'Generador', steps: 7 },
  { slug: 'transportista', label: 'Transportista', steps: 5 },
  { slug: 'operador', label: 'Operador', steps: 8 },
] as const;

const viewports = [
  { name: 'desktop', width: 1440, height: 900, prefix: '' },
  { name: 'compact', width: 1024, height: 768, prefix: '' },
  { name: 'tablet', width: 768, height: 1024, prefix: '' },
  { name: 'mobile', width: 430, height: 932, prefix: '/app' },
  { name: 'narrow', width: 360, height: 800, prefix: '/app' },
] as const;

async function assertNoControlOverlap(fieldset: Locator): Promise<void> {
  const overlaps = await fieldset.locator(
    'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), select, textarea',
  ).evaluateAll((controls) => {
    const boxes = controls
      .filter((control) => {
        const style = getComputedStyle(control);
        const box = control.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 1 && box.height > 1;
      })
      .map((control) => ({
        name: control.getAttribute('name') || control.getAttribute('aria-label') || control.tagName,
        box: control.getBoundingClientRect(),
      }));

    const collisions: string[] = [];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const overlapX = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
        const overlapY = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
        if (overlapX > 2 && overlapY > 2) collisions.push(`${a.name} overlaps ${b.name}`);
      }
    }
    return collisions;
  });
  expect(overlaps).toEqual([]);
}

async function assertResponsiveFrame(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const wizard = document.querySelector<HTMLElement>('[data-testid="registration-wizard"]');
    const stepper = document.querySelector<HTMLElement>('[data-testid="registration-stepper"]');
    const active = stepper?.querySelector<HTMLElement>('[aria-current="step"]');
    const labels = Array.from(stepper?.querySelectorAll<HTMLElement>('button[data-step-id] span') || [])
      .filter((label) => getComputedStyle(label).display !== 'none')
      .map((label) => label.getBoundingClientRect());
    const labelOverlap = labels.some((box, index) => labels.slice(index + 1).some((other) => (
      Math.min(box.right, other.right) - Math.max(box.left, other.left) > 1
      && Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 1
    )));
    const activeBox = active?.getBoundingClientRect();
    const stepperBox = stepper?.getBoundingClientRect();
    const wizardBox = wizard?.getBoundingClientRect();
    return {
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      wizardLeft: wizardBox?.left ?? -1,
      wizardRight: wizardBox?.right ?? Number.POSITIVE_INFINITY,
      activeVisible: !!activeBox && !!stepperBox
        && activeBox.left >= stepperBox.left - 2
        && activeBox.right <= stepperBox.right + 2,
      labelOverlap,
    };
  });

  expect(metrics.pageOverflow).toBeLessThanOrEqual(1);
  expect(metrics.wizardLeft).toBeGreaterThanOrEqual(0);
  expect(metrics.wizardRight).toBeLessThanOrEqual((page.viewportSize()?.width || 0) + 1);
  expect(metrics.activeVisible).toBe(true);
  expect(metrics.labelOverlap).toBe(false);
  await assertNoControlOverlap(page.locator('[data-testid="registration-wizard"] fieldset'));
}

test.describe('registration wizard responsive matrix', () => {
  test.setTimeout(120_000);

  for (const form of forms) {
    test(`${form.label}: every step remains usable across desktop, tablet and mobile`, async ({ page }, testInfo) => {
      const runtimeErrors: string[] = [];
      const mutations: string[] = [];
      page.on('pageerror', error => runtimeErrors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') runtimeErrors.push(message.text());
      });
      page.on('request', request => {
        if (/\/api\/solicitudes(?:\/|\?|$)/.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
          mutations.push(`${request.method()} ${request.url()}`);
        }
      });

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`${viewport.prefix}/inscripcion/${form.slug}?modo=revision`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('registration-wizard')).toBeVisible();

        for (let step = 1; step <= form.steps; step += 1) {
          const stepButton = page.getByRole('button', { name: new RegExp(`Paso ${step} de ${form.steps}:`) });
          await stepButton.click();
          await expect(stepButton).toHaveAttribute('aria-current', 'step');
          await page.waitForTimeout(120);
          await assertResponsiveFrame(page);
        }

        const screenshotDir = process.env.QA_SCREENSHOT_DIR;
        const shouldCapture = screenshotDir && (
          viewport.name === 'desktop'
          || viewport.name === 'mobile'
          || (form.slug === 'operador' && viewport.name === 'compact')
        );
        if (shouldCapture) {
          await page.getByRole('button', { name: new RegExp(`Paso 1 de ${form.steps}:`) }).click();
          await page.screenshot({
            path: `${screenshotDir}/${form.slug}-${viewport.name}-${testInfo.project.name}.png`,
            fullPage: false,
          });
        }
      }

      expect(runtimeErrors).toEqual([]);
      expect(mutations).toEqual([]);
    });
  }
});
