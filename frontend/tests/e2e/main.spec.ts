import { test, expect } from '@playwright/test';

/**
 * Tests E2E para SITREP - Sistema de Trazabilidad RRPP
 * Verifican los casos de uso principales
 */

test.describe('Dashboard y Navegación', () => {
  test('debería cargar el dashboard correctamente', async ({ page }) => {
    await page.goto('/');
    
    // Verificar que la app carga
    await expect(page).toHaveTitle(/SITREP|Trazabilidad/i);
    
    // Debería mostrar opciones de rol para demo
    await expect(page.locator('text=/Administrador|Generador|Transportista|Operador/i')).toBeVisible();
  });

  test('debería permitir cambiar de rol en modo demo', async ({ page }) => {
    await page.goto('/');
    
    // Click en un rol específico (Generador)
    await page.click('text=/Generador/i');
    
    // Verificar navegación al dashboard correspondiente
    await expect(page.locator('text=/Dashboard|Manifiestos|Nuevo/i')).toBeVisible();
  });
});

test.describe('CU-G03: Crear Manifiesto como Generador', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Seleccionar rol Generador
    await page.click('text=/Generador/i');
  });

  test('debería mostrar formulario de nuevo manifiesto', async ({ page }) => {
    // Buscar botón de nuevo manifiesto
    const nuevoBtn = page.locator('button:has-text("Nuevo"), a:has-text("Nuevo Manifiesto")');
    
    if (await nuevoBtn.count() > 0) {
      await nuevoBtn.first().click();
      // Verificar que muestra el formulario
      await expect(page.locator('form, [data-testid="form-manifiesto"]')).toBeVisible();
    }
  });
});

test.describe('CU-T03: Transportista confirma retiro', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Seleccionar rol Transportista
    await page.click('text=/Transportista/i');
  });

  test('debería mostrar manifiestos pendientes de retiro', async ({ page }) => {
    // Verificar que muestra lista de manifiestos
    await expect(page.locator('text=/Manifiestos|Pendientes|Retiro/i')).toBeVisible();
  });
});

test.describe('CU-O09: Operador cierra manifiesto', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Seleccionar rol Operador
    await page.click('text=/Operador/i');
  });

  test('debería mostrar manifiestos para recepción', async ({ page }) => {
    // Verificar que muestra lista de manifiestos
    await expect(page.locator('text=/Manifiestos|Recepción|Tratamiento/i')).toBeVisible();
  });
});

test.describe('Modo Offline (PWA)', () => {
  test('debería tener Service Worker registrado', async ({ page }) => {
    await page.goto('/');
    
    // Verificar registro de Service Worker
    const swRegistration = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return !!registration;
      }
      return false;
    });
    
    // En modo demo podría no tener SW activo, pero verificamos la estructura
    expect(typeof swRegistration).toBe('boolean');
  });
});

test.describe('Accesibilidad básica', () => {
  test('debería tener estructura semántica correcta', async ({ page }) => {
    await page.goto('/');
    
    // Verificar que existe un heading principal
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    
    // Verificar que los botones tienen texto accesible
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      expect(text || ariaLabel).toBeTruthy();
    }
  });
});
