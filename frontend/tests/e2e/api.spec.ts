import { test, expect } from '@playwright/test';

/**
 * SITREP E2E Tests - Verificación de APIs
 *
 * Estos tests verifican que los endpoints de la API
 * responden correctamente y retornan estructuras válidas
 */

const BASE_API = '/api';

test.describe('API Endpoints - Manifiestos', () => {
    test('GET /api/manifiestos/dashboard retorna estructura válida', async ({ request }) => {
        const response = await request.get(`${BASE_API}/manifiestos/dashboard`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('total');
        expect(data.data).toHaveProperty('porEstado');
        expect(data.data).toHaveProperty('recientes');
        expect(Array.isArray(data.data.recientes)).toBe(true);
    });

    test('GET /api/manifiestos retorna lista paginada', async ({ request }) => {
        const response = await request.get(`${BASE_API}/manifiestos`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('success', true);
        expect(data.data).toHaveProperty('manifiestos');
        expect(Array.isArray(data.data.manifiestos)).toBe(true);
    });
});

test.describe('API Endpoints - Actores', () => {
    test('GET /api/actores/generadores retorna lista', async ({ request }) => {
        const response = await request.get(`${BASE_API}/actores/generadores`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('success', true);
        expect(data.data).toHaveProperty('generadores');
        expect(Array.isArray(data.data.generadores)).toBe(true);
    });

    test('GET /api/actores/transportistas retorna lista', async ({ request }) => {
        const response = await request.get(`${BASE_API}/actores/transportistas`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('success', true);
        expect(data.data).toHaveProperty('transportistas');
        expect(Array.isArray(data.data.transportistas)).toBe(true);
    });

    test('GET /api/actores/operadores retorna lista', async ({ request }) => {
        const response = await request.get(`${BASE_API}/actores/operadores`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('success', true);
        expect(data.data).toHaveProperty('operadores');
        expect(Array.isArray(data.data.operadores)).toBe(true);
    });
});

test.describe('API Endpoints - Notificaciones y Alertas', () => {
    test('GET /api/notificaciones retorna estructura válida', async ({ request }) => {
        const response = await request.get(`${BASE_API}/notificaciones`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('success', true);
    });

    test('GET /api/alertas/reglas retorna lista', async ({ request }) => {
        const response = await request.get(`${BASE_API}/alertas/reglas`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('success', true);
    });
});

test.describe('API Response Times', () => {
    test('Dashboard API responde en menos de 3 segundos', async ({ request }) => {
        const start = Date.now();
        const response = await request.get(`${BASE_API}/manifiestos/dashboard`);
        const duration = Date.now() - start;

        expect(response.status()).toBe(200);
        expect(duration).toBeLessThan(3000);
    });

    test('Actores API responde en menos de 2 segundos', async ({ request }) => {
        const start = Date.now();
        const response = await request.get(`${BASE_API}/actores/generadores`);
        const duration = Date.now() - start;

        expect(response.status()).toBe(200);
        expect(duration).toBeLessThan(2000);
    });
});

test.describe('API Error Handling', () => {
    test('Endpoint inexistente retorna 404', async ({ request }) => {
        const response = await request.get(`${BASE_API}/endpoint-que-no-existe`);
        expect(response.status()).toBe(404);
    });

    test('Manifiesto inexistente retorna error apropiado', async ({ request }) => {
        const response = await request.get(`${BASE_API}/manifiestos/id-inexistente-12345`);
        // Puede ser 404 o 400 dependiendo de la implementación
        expect([400, 404]).toContain(response.status());
    });
});
