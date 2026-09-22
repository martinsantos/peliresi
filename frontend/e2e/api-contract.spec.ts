import { expect, test } from '@playwright/test';

const accessToken = process.env.SITREP_QA_ACCESS_TOKEN;

test.describe('read-only production API contract', () => {
  test.skip(!accessToken, 'Set SITREP_QA_ACCESS_TOKEN to run the authenticated API audit');

  test('public health probes are healthy', async ({ request }) => {
    for (const path of ['/api/health', '/api/health/live', '/api/health/ready']) {
      const response = await request.get(path);
      expect(response.status(), `${path}: ${await response.text()}`).toBe(200);
      expect(response.headers()['content-type']).toContain('application/json');
    }
  });

  test('authenticated read endpoints respond without server errors', async ({ request }) => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const endpoints = [
      '/api/auth/profile',
      '/api/manifiestos?limit=1',
      '/api/manifiestos/dashboard',
      '/api/manifiestos/sync-inicial',
      '/api/catalogos/tipos-residuos',
      '/api/catalogos/generadores',
      '/api/catalogos/transportistas',
      '/api/catalogos/operadores',
      '/api/catalogos/vehiculos',
      '/api/catalogos/choferes',
      '/api/actores/generadores?limit=1',
      '/api/actores/transportistas?limit=1',
      '/api/actores/operadores?limit=1',
      '/api/reportes/manifiestos?limit=1',
      '/api/reportes/tratados?limit=1',
      '/api/reportes/transporte?limit=1',
      '/api/analytics/manifiestos-por-mes',
      '/api/analytics/residuos-por-tipo',
      '/api/analytics/manifiestos-por-estado',
      '/api/analytics/tiempo-promedio',
      '/api/centro-control/actividad',
      '/api/centro-control/monitor-live',
      '/api/centro-control/active-days',
      '/api/search?q=alfa',
      '/api/renovaciones?limit=1',
      '/api/inspecciones?limit=1',
      '/api/notificaciones',
      '/api/alertas/reglas',
      '/api/alertas',
      '/api/admin/usuarios?limit=1',
      '/api/admin/email-queue',
      '/api/blockchain/registro?limit=1',
      '/api/solicitudes?limit=1',
    ];

    const failures: string[] = [];
    for (const path of endpoints) {
      const response = await request.get(path, { headers });
      if (response.status() !== 200) failures.push(`${path} -> ${response.status()} ${await response.text()}`);
      else expect(response.headers()['content-type'], path).toContain('application/json');
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('representative detail and document endpoints resolve real records', async ({ request }) => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const manifestsResponse = await request.get('/api/manifiestos?limit=1', { headers });
    expect(manifestsResponse.status()).toBe(200);
    const manifestsBody = await manifestsResponse.json();
    const manifest = manifestsBody?.data?.manifiestos?.[0] || manifestsBody?.data?.items?.[0] || manifestsBody?.data?.[0];
    expect(manifest?.id).toBeTruthy();

    const manifestDetail = await request.get(`/api/manifiestos/${manifest.id}`, { headers });
    expect(manifestDetail.status()).toBe(200);
    const manifestPdf = await request.get(`/api/pdf/manifiesto/${manifest.id}`, { headers });
    expect(manifestPdf.status()).toBe(200);
    expect(manifestPdf.headers()['content-type']).toContain('application/pdf');

    const inspectionsResponse = await request.get('/api/inspecciones?limit=1', { headers });
    expect(inspectionsResponse.status()).toBe(200);
    const inspectionsBody = await inspectionsResponse.json();
    const inspection = inspectionsBody?.data?.items?.[0];
    expect(inspection?.id).toBeTruthy();
    const inspectionDetail = await request.get(`/api/inspecciones/${inspection.id}`, { headers });
    expect(inspectionDetail.status()).toBe(200);
    const inspectionPdf = await request.get(`/api/inspecciones/${inspection.id}/acta.pdf`, { headers });
    expect(inspectionPdf.status()).toBe(200);
    expect(inspectionPdf.headers()['content-type']).toContain('application/pdf');
  });
});
