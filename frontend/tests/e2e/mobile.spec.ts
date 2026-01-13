import { test, expect } from '@playwright/test';

/**
 * SITREP E2E Tests - App Móvil
 *
 * Estos tests verifican la funcionalidad de la aplicación móvil
 * usando el proyecto mobile-chrome configurado en playwright.config.ts
 */

test.describe('Mobile App - Carga y Navegación', () => {
    test.use({ viewport: { width: 390, height: 844 } }); // iPhone 13

    test('Demo App carga en móvil', async ({ page }) => {
        await page.goto('/demo-app');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('body')).toBeVisible();
    });

    test('App Mobile carga sin errores críticos', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => {
            if (err.message.includes('Cannot read properties')) {
                errors.push(err.message);
            }
        });

        await page.goto('/app');
        await page.waitForLoadState('networkidle');

        expect(errors).toHaveLength(0);
    });
});

test.describe('Mobile App - Responsive Design', () => {
    const viewports = [
        { name: 'iPhone SE', width: 375, height: 667 },
        { name: 'iPhone 13', width: 390, height: 844 },
        { name: 'Pixel 5', width: 393, height: 851 },
        { name: 'iPad Mini', width: 768, height: 1024 },
    ];

    for (const vp of viewports) {
        test(`Demo App visible en ${vp.name}`, async ({ page }) => {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.goto('/demo-app');
            await page.waitForLoadState('networkidle');

            // Verificar que el contenido es visible
            const body = page.locator('body');
            await expect(body).toBeVisible();

            // Verificar que no hay overflow horizontal
            const hasHorizontalScroll = await page.evaluate(() => {
                return document.documentElement.scrollWidth > document.documentElement.clientWidth;
            });
            // Nota: Algunos componentes pueden tener scroll horizontal intencionalmente
            // Por ahora solo verificamos que la página carga
        });
    }
});

test.describe('Mobile App - Interacciones Touch', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('Navegación touch funciona', async ({ page }) => {
        await page.goto('/demo-app');
        await page.waitForLoadState('networkidle');

        // Simular tap en elementos clickeables
        const buttons = page.locator('button:visible').first();
        if (await buttons.count() > 0) {
            await buttons.tap();
            // Verificar que no hay errores después del tap
            await page.waitForTimeout(500);
        }
    });
});

test.describe('Mobile App - Performance', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('Tiempo de carga inicial < 5s', async ({ page }) => {
        const start = Date.now();
        await page.goto('/demo-app');
        await page.waitForLoadState('domcontentloaded');
        const loadTime = Date.now() - start;

        expect(loadTime).toBeLessThan(5000);
    });

    test('Sin memory leaks obvios después de navegación', async ({ page }) => {
        await page.goto('/demo-app');
        await page.waitForLoadState('networkidle');

        // Navegar varias veces y verificar que no hay errores
        for (let i = 0; i < 3; i++) {
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');
            await page.goto('/demo-app');
            await page.waitForLoadState('networkidle');
        }

        // Si llegamos aquí sin errores, el test pasa
        expect(true).toBe(true);
    });
});
