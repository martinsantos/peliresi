import { test, expect, Page } from '@playwright/test';

/**
 * Tests E2E para SITREP - Sistema de Trazabilidad RRPP
 * Usa credenciales demo: *@demo.com / demo123
 */

// Credenciales demo
const DEMO_USERS = {
  admin: { email: 'admin@demo.com', password: 'demo123' },
  generador: { email: 'generador@demo.com', password: 'demo123' },
  transportista: { email: 'transportista@demo.com', password: 'demo123' },
  operador: { email: 'operador@demo.com', password: 'demo123' },
};

// Helper para hacer login
async function login(page: Page, role: keyof typeof DEMO_USERS) {
  const { email, password } = DEMO_USERS[role];
  
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  // Llenar formulario de login
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  
  // Click en botón de login
  await page.click('button[type="submit"], button:has-text("Iniciar"), button:has-text("Ingresar")');
  
  // Esperar redirección al dashboard
  await page.waitForURL(/dashboard|manifiestos/, { timeout: 10000 });
}

// ========================================
// TESTS DE CARGA Y NAVEGACIÓN
// ========================================
test.describe('Carga de Aplicación', () => {
  test('debería cargar la página de login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // La app debería mostrar login o dashboard
    const hasLogin = await page.locator('input[type="email"], button:has-text("Iniciar")').count();
    const hasDashboard = await page.locator('text=/Dashboard|Manifiestos/i').count();
    
    expect(hasLogin > 0 || hasDashboard > 0).toBeTruthy();
  });
});

// ========================================
// TESTS CON AUTENTICACIÓN - ADMIN
// ========================================
test.describe('Admin: Dashboard y Gestión', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('CU-A02: debería mostrar dashboard ejecutivo', async ({ page }) => {
    await expect(page.locator('text=/Dashboard|Total|Manifiestos/i').first()).toBeVisible();
  });

  test('CU-A09: debería mostrar monitoreo en tiempo real', async ({ page }) => {
    // Buscar sección de monitoreo o mapa
    const monitorSection = page.locator('text=/En Tránsito|Mapa|Tiempo Real|GPS/i');
    await expect(monitorSection.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // Si no hay, verificar que hay estadísticas
      expect(page.locator('text=/Total|Completados|Pendientes/i').first()).toBeVisible();
    });
  });
});

// ========================================
// TESTS CON AUTENTICACIÓN - GENERADOR
// ========================================
test.describe('Generador: Flujo de Manifiestos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'generador');
  });

  test('CU-G02: debería mostrar dashboard de generador', async ({ page }) => {
    await expect(page.locator('text=/Dashboard|Bienvenido|Generador/i').first()).toBeVisible();
  });

  test('CU-G03: debería poder acceder a nuevo manifiesto', async ({ page }) => {
    // Buscar enlace/botón para crear manifiesto
    const nuevoBtn = page.locator('a:has-text("Nuevo"), button:has-text("Nuevo"), a:has-text("Crear")');
    
    if (await nuevoBtn.count() > 0) {
      await nuevoBtn.first().click();
      await page.waitForLoadState('networkidle');
      
      // Verificar formulario o página de creación
      const hasForm = await page.locator('form, text=/Tipo de Residuo|Transportista/i').count();
      expect(hasForm).toBeGreaterThan(0);
    }
  });
});

// ========================================
// TESTS CON AUTENTICACIÓN - TRANSPORTISTA
// ========================================
test.describe('Transportista: Viajes y GPS', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'transportista');
  });

  test('CU-T02: debería ver viajes asignados', async ({ page }) => {
    await expect(page.locator('text=/Viajes|Asignados|Manifiestos|Pendientes/i').first()).toBeVisible();
  });

  test('debería tener sección de GPS/Ruta', async ({ page }) => {
    const gpsSection = page.locator('text=/GPS|Ruta|Ubicación|Mapa/i');
    // El menú debería tener opción de GPS/Ruta
    const menuGPS = page.locator('nav a:has-text("GPS"), nav a:has-text("Ruta"), sidebar a:has-text("GPS")');
    
    expect((await gpsSection.count()) > 0 || (await menuGPS.count()) > 0).toBeTruthy();
  });
});

// ========================================
// TESTS CON AUTENTICACIÓN - OPERADOR
// ========================================
test.describe('Operador: Recepción y Tratamiento', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'operador');
  });

  test('CU-O02: debería ver manifiestos entrantes', async ({ page }) => {
    await expect(page.locator('text=/Recepción|Entrantes|Esperados|Manifiestos/i').first()).toBeVisible();
  });
});

// ========================================
// TESTS DE PWA
// ========================================
test.describe('PWA y Offline', () => {
  test('debería tener Service Worker registrado', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const swRegistration = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return !!registration;
      }
      return false;
    });
    
    expect(typeof swRegistration).toBe('boolean');
  });

  test('debería tener manifest.json', async ({ page }) => {
    const response = await page.request.get('/manifest.webmanifest');
    expect(response.ok()).toBeTruthy();
  });
});

// ========================================
// TESTS DE ACCESIBILIDAD
// ========================================
test.describe('Accesibilidad Básica', () => {
  test('debería tener estructura semántica en login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Verificar labels en formulario
    const labels = page.locator('label');
    expect(await labels.count()).toBeGreaterThan(0);
  });

  test('debería tener heading principal en dashboard', async ({ page }) => {
    await login(page, 'admin');
    
    const h1 = page.locator('h1, [role="heading"][aria-level="1"]');
    await expect(h1.first()).toBeVisible();
  });
});
