import { test, expect } from '@playwright/test';

/**
 * SITREP E2E Tests - Verificación de APIs
 *
 * Estos tests verifican que los endpoints de la API
 * responden correctamente. Los endpoints protegidos
 * deben retornar 401 sin autenticación.
 */

const BASE_API = '/api';

test.describe('API Endpoints - Públicos', () => {
    test('GET /api/health retorna estado OK', async ({ request }) => {
        const response = await request.get(`${BASE_API}/health`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('status', 'ok');
    });

    test('Endpoint inexistente retorna 404', async ({ request }) => {
        const response = await request.get(`${BASE_API}/endpoint-que-no-existe`);
        expect(response.status()).toBe(404);
    });
});

test.describe('API Endpoints - Protegidos (requieren auth)', () => {
    test('GET /api/manifiestos/dashboard requiere autenticación', async ({ request }) => {
        const response = await request.get(`${BASE_API}/manifiestos/dashboard`);
        // Sin auth debe retornar 401
        expect(response.status()).toBe(401);
    });

    test('GET /api/manifiestos requiere autenticación', async ({ request }) => {
        const response = await request.get(`${BASE_API}/manifiestos`);
        expect(response.status()).toBe(401);
    });

    test('GET /api/actores/generadores requiere autenticación', async ({ request }) => {
        const response = await request.get(`${BASE_API}/actores/generadores`);
        expect(response.status()).toBe(401);
    });

    test('GET /api/actores/transportistas requiere autenticación', async ({ request }) => {
        const response = await request.get(`${BASE_API}/actores/transportistas`);
        expect(response.status()).toBe(401);
    });

    test('GET /api/actores/operadores requiere autenticación', async ({ request }) => {
        const response = await request.get(`${BASE_API}/actores/operadores`);
        expect(response.status()).toBe(401);
    });

    test('GET /api/notificaciones requiere autenticación', async ({ request }) => {
        const response = await request.get(`${BASE_API}/notificaciones`);
        expect(response.status()).toBe(401);
    });

    test('GET /api/alertas/reglas requiere autenticación', async ({ request }) => {
        const response = await request.get(`${BASE_API}/alertas/reglas`);
        expect(response.status()).toBe(401);
    });

    test('GET /api/manifiestos/:id requiere autenticación', async ({ request }) => {
        const response = await request.get(`${BASE_API}/manifiestos/id-inexistente-12345`);
        // Sin auth debe retornar 401 (no 404 porque primero verifica auth)
        expect(response.status()).toBe(401);
    });
});

test.describe('API Response Times', () => {
    test('Health API responde en menos de 1 segundo', async ({ request }) => {
        const start = Date.now();
        const response = await request.get(`${BASE_API}/health`);
        const duration = Date.now() - start;

        expect(response.status()).toBe(200);
        expect(duration).toBeLessThan(1000);
    });

    test('API responde rapidamente incluso para auth error', async ({ request }) => {
        const start = Date.now();
        const response = await request.get(`${BASE_API}/manifiestos/dashboard`);
        const duration = Date.now() - start;

        // Debe responder rápido aunque sea error de auth
        expect(duration).toBeLessThan(2000);
    });
});
