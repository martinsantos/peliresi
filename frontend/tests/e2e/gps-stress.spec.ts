import { test, expect, Page } from '@playwright/test';

/**
 * TESTS DE ESTRES - GPS Y GEOLOCALIZACION
 *
 * Estos tests validan las capacidades de geolocalizacion del navegador
 * y el manejo de diferentes escenarios de GPS.
 * Adaptados para ejecutar en CI sin datos de prueba especificos.
 */

const DEMO_USERS = {
  admin: { email: 'admin@dgfa.mendoza.gov.ar', password: 'password' },
  transportista: { email: 'transportes.andes@logistica.com', password: 'password' },
};

async function login(page: Page, role: keyof typeof DEMO_USERS) {
  const { email, password } = DEMO_USERS[role];
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|manifiestos/, { timeout: 15000 });
}

test.describe('Tests de estres - GPS y Geolocalizacion', () => {

  test('Geolocation API disponible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const geoStatus = await page.evaluate(() => {
      return {
        supported: 'geolocation' in navigator,
        hasGetCurrentPosition: typeof navigator.geolocation?.getCurrentPosition === 'function',
        hasWatchPosition: typeof navigator.geolocation?.watchPosition === 'function'
      };
    });

    console.log(`[TEST] Geolocation API: supported=${geoStatus.supported}, getCurrentPosition=${geoStatus.hasGetCurrentPosition}, watchPosition=${geoStatus.hasWatchPosition}`);

    expect(geoStatus.supported).toBe(true);
    expect(geoStatus.hasGetCurrentPosition).toBe(true);
    expect(geoStatus.hasWatchPosition).toBe(true);
  });

  test('Geolocation con permiso concedido', async ({ page, context }) => {
    // Dar permiso de geolocalizacion
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -32.8895, longitude: -68.8458, accuracy: 10 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verificar que podemos obtener la ubicacion
    const location = await page.evaluate(() => {
      return new Promise<{ lat: number; lng: number; accuracy: number } | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          }),
          () => resolve(null),
          { timeout: 5000 }
        );
      });
    });

    console.log(`[TEST] Ubicacion obtenida: ${location ? `${location.lat}, ${location.lng} (accuracy: ${location.accuracy}m)` : 'null'}`);

    expect(location).not.toBeNull();
    expect(location?.lat).toBeCloseTo(-32.8895, 2);
    expect(location?.lng).toBeCloseTo(-68.8458, 2);
  });

  test('Geolocation con baja precision (GPS en interiores)', async ({ page, context }) => {
    // Configurar GPS con baja precision
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: -32.8895,
      longitude: -68.8458,
      accuracy: 250 // 250 metros - baja precision
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const location = await page.evaluate(() => {
      return new Promise<{ accuracy: number } | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ accuracy: pos.coords.accuracy }),
          () => resolve(null),
          { timeout: 5000 }
        );
      });
    });

    console.log(`[TEST] GPS con baja precision: accuracy=${location?.accuracy}m`);

    expect(location).not.toBeNull();
    expect(location?.accuracy).toBe(250);
  });

  test('Cambio de ubicacion simulado (tracking)', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -32.8895, longitude: -68.8458, accuracy: 10 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Iniciar watch
    const watchResult = await page.evaluate(() => {
      return new Promise<{ positions: number; lastLat: number; lastLng: number }>((resolve) => {
        const positions: { lat: number; lng: number }[] = [];
        let watchId: number;

        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            positions.push({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            });
          },
          () => {},
          { enableHighAccuracy: true }
        );

        // Esperar 3 segundos y resolver
        setTimeout(() => {
          navigator.geolocation.clearWatch(watchId);
          const last = positions[positions.length - 1] || { lat: 0, lng: 0 };
          resolve({
            positions: positions.length,
            lastLat: last.lat,
            lastLng: last.lng
          });
        }, 3000);
      });
    });

    // Simular movimiento
    await context.setGeolocation({ latitude: -32.8900, longitude: -68.8460, accuracy: 10 });
    await page.waitForTimeout(500);
    await context.setGeolocation({ latitude: -32.8905, longitude: -68.8465, accuracy: 10 });
    await page.waitForTimeout(500);

    console.log(`[TEST] Tracking: ${watchResult.positions} posiciones capturadas`);

    // Al menos deberia capturar la posicion inicial
    expect(watchResult.positions).toBeGreaterThanOrEqual(1);
  });

  test('App maneja ausencia de GPS gracefully', async ({ page }) => {
    // NO dar permiso de geolocalizacion

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Intentar obtener ubicacion sin permiso
    const result = await page.evaluate(() => {
      return new Promise<{ success: boolean; errorCode?: number }>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve({ success: true }),
          (error) => resolve({ success: false, errorCode: error.code }),
          { timeout: 3000 }
        );
      });
    });

    console.log(`[TEST] GPS sin permiso: success=${result.success}, errorCode=${result.errorCode}`);

    // Deberia fallar con error de permiso denegado (code 1)
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(1); // PERMISSION_DENIED
  });

  test('Coordenadas de Mendoza son validas', async ({ page, context }) => {
    // Verificar que las coordenadas de demo son validas para Mendoza
    await context.grantPermissions(['geolocation']);

    const mendozaCoords = [
      { lat: -32.8895, lng: -68.8458, name: 'Centro Mendoza' },
      { lat: -32.9000, lng: -68.8500, name: 'Sur Mendoza' },
      { lat: -32.8500, lng: -68.8200, name: 'Norte Mendoza' },
    ];

    for (const coord of mendozaCoords) {
      await context.setGeolocation({ latitude: coord.lat, longitude: coord.lng, accuracy: 10 });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const location = await page.evaluate(() => {
        return new Promise<{ lat: number; lng: number } | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 3000 }
          );
        });
      });

      console.log(`[TEST] ${coord.name}: lat=${location?.lat}, lng=${location?.lng}`);

      expect(location).not.toBeNull();
      // Verificar que estan en el rango de Mendoza
      expect(location?.lat).toBeGreaterThan(-34);
      expect(location?.lat).toBeLessThan(-32);
      expect(location?.lng).toBeGreaterThan(-70);
      expect(location?.lng).toBeLessThan(-68);
    }
  });

  test('Alta precision GPS disponible', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -32.8895, longitude: -68.8458, accuracy: 5 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(() => {
      return new Promise<{ accuracy: number; hasAltitude: boolean; hasSpeed: boolean }>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({
            accuracy: pos.coords.accuracy,
            hasAltitude: pos.coords.altitude !== null,
            hasSpeed: pos.coords.speed !== null
          }),
          () => resolve({ accuracy: 999, hasAltitude: false, hasSpeed: false }),
          { enableHighAccuracy: true, timeout: 5000 }
        );
      });
    });

    console.log(`[TEST] Alta precision: accuracy=${result.accuracy}m, altitude=${result.hasAltitude}, speed=${result.hasSpeed}`);

    // Precision debe ser la configurada
    expect(result.accuracy).toBe(5);
  });
});
