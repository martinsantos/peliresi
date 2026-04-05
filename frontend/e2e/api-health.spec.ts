import { test, expect } from '@playwright/test';

test.describe('API Health', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('connected');
  });

  test('liveness probe returns 200', async ({ request }) => {
    const response = await request.get('/api/health/live');
    expect(response.ok()).toBeTruthy();
  });

  test('readiness probe returns 200', async ({ request }) => {
    const response = await request.get('/api/health/ready');
    expect(response.ok()).toBeTruthy();
  });

  test('auth endpoint rejects unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/auth/perfil');
    expect(response.status()).toBe(401);
  });

  test('login returns tokens on valid credentials', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        email: 'admin@dgfa.mendoza.gov.ar',
        password: 'admin123',
      },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.tokens.accessToken).toBeTruthy();
    expect(body.data.user).toBeTruthy();
    expect(body.data.user.rol).toBe('ADMIN');
  });

  test('login rejects invalid credentials', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        email: 'bad@email.com',
        password: 'wrong',
      },
    });
    expect(response.ok()).toBeFalsy();
  });
});
