import { test, expect } from '@playwright/test';

/**
 * SITREP E2E Tests - Verificación de Páginas
 *
 * Estos tests verifican que todas las páginas principales
 * cargan correctamente sin errores de runtime
 */

test.describe('Páginas Públicas', () => {
    test('Landing page carga correctamente', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/SITREP/i);
        // Verificar que no hay errores de consola críticos
        const consoleErrors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        await page.waitForLoadState('networkidle');
        expect(consoleErrors.filter(e => e.includes('TypeError'))).toHaveLength(0);
    });

    test('Página de login carga', async ({ page }) => {
        await page.goto('/login');
        await expect(page.locator('form')).toBeVisible();
    });

    test('Demo App carga correctamente', async ({ page }) => {
        await page.goto('/demo-app');
        await expect(page.locator('body')).toBeVisible();
        await page.waitForLoadState('networkidle');
    });
});

test.describe('Dashboard y Manifiestos', () => {
    test('Dashboard carga sin errores de runtime', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error' && msg.text().includes('TypeError')) {
                consoleErrors.push(msg.text());
            }
        });

        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Verificar que la página muestra contenido
        await expect(page.locator('body')).not.toBeEmpty();

        // No debe haber TypeErrors (indica falta de defensive coding)
        expect(consoleErrors).toHaveLength(0);
    });

    test('Lista de manifiestos carga', async ({ page }) => {
        await page.goto('/manifiestos');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('body')).toBeVisible();
    });
});

test.describe('Páginas Administrativas', () => {
    test('Configuración carga sin errores', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto('/configuracion');
        await page.waitForLoadState('networkidle');

        expect(errors.filter(e => e.includes('Cannot read properties'))).toHaveLength(0);
    });

    test('Reportes carga sin errores', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto('/reportes');
        await page.waitForLoadState('networkidle');

        expect(errors.filter(e => e.includes('Cannot read properties'))).toHaveLength(0);
    });

    test('Tracking carga sin errores', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto('/tracking');
        await page.waitForLoadState('networkidle');

        expect(errors.filter(e => e.includes('Cannot read properties'))).toHaveLength(0);
    });

    test('Gestión de Actores carga sin errores', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto('/actores');
        await page.waitForLoadState('networkidle');

        expect(errors.filter(e => e.includes('Cannot read properties'))).toHaveLength(0);
    });

    test('Log de Auditoría carga sin errores', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto('/admin/auditoria');
        await page.waitForLoadState('networkidle');

        expect(errors.filter(e => e.includes('Cannot read properties'))).toHaveLength(0);
    });
});

test.describe('Verificación de Assets', () => {
    test('Assets CSS cargan correctamente', async ({ page }) => {
        const response = await page.goto('/');
        expect(response?.status()).toBe(200);

        // Verificar que los estilos se cargaron
        const styles = await page.evaluate(() => {
            return document.styleSheets.length;
        });
        expect(styles).toBeGreaterThan(0);
    });

    test('Assets JS cargan sin errores 404', async ({ page }) => {
        const failedRequests: string[] = [];
        page.on('response', response => {
            if (response.status() === 404 && response.url().includes('/assets/')) {
                failedRequests.push(response.url());
            }
        });

        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        expect(failedRequests).toHaveLength(0);
    });
});
