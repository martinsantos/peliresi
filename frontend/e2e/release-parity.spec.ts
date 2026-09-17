import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASS } from './helpers/auth';

test.describe('Release parity — read-only contracts', () => {
  test('authenticated API exposes current catalogs and core resources', async ({ request }) => {
    expect(ADMIN_PASS, 'E2E_ADMIN_PASSWORD is required').toBeTruthy();

    const login = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASS },
    });
    expect(login.ok()).toBeTruthy();

    const loginBody = await login.json();
    const token = loginBody?.data?.tokens?.accessToken;
    expect(token).toBeTruthy();
    const headers = { Authorization: `Bearer ${token}` };

    const [externalActors, manifests, users] = await Promise.all([
      request.get('/api/catalogos/entidades-exteriores', { headers }),
      request.get('/api/manifiestos?limit=1', { headers }),
      request.get('/api/admin/usuarios?limit=1', { headers }),
    ]);

    expect(externalActors.status()).toBe(200);
    expect(manifests.status()).toBe(200);
    expect(users.status()).toBe(200);
    expect(await externalActors.json()).toBeTruthy();
  });

  test('web and PWA publish the current offline assets', async ({ request }) => {
    const responses = await Promise.all([
      request.get('/'),
      request.get('/app/app.html'),
      request.get('/app/manifest-app.json'),
      request.get('/sw-app.js'),
      request.get('/offline.html'),
    ]);

    for (const response of responses) expect(response.status()).toBe(200);
  });
});
