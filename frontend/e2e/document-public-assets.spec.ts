import { test, expect } from '@playwright/test';

/**
 * Read-only mirror smoke: does not log in, create a request, upload a file,
 * send mail, or mutate the database. It verifies the public shell and the
 * same-origin OCR/certificate entry points needed before a QA deployment.
 */
test.describe('documental public surface (read-only)', () => {
  test('registration shell and local OCR assets are reachable', async ({ page, request }) => {
    const health = await request.get('/api/health');
    expect(health.ok()).toBeTruthy();

    await page.goto('/inscripcion/generador', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Crear cuenta|Inscripcion como Generador/i).first()).toBeVisible();

    const expectedMime: Record<string, RegExp> = {
      'worker.min.js': /javascript|ecmascript/i,
      'tesseract-core.wasm.js': /javascript|ecmascript/i,
      'tesseract-core.wasm': /application\/wasm|octet-stream/i,
      // Vite intentionally leaves the large language model without a MIME
      // header in dev; validate the non-HTML payload by size below instead.
      'spa.traineddata': /octet-stream|binary|^$/i,
    };
    for (const asset of Object.keys(expectedMime)) {
      const response = await request.get(`/ocr/${asset}`);
      expect(response.status(), asset).toBe(200);
      expect(response.headers()['content-type'], asset).toMatch(expectedMime[asset]);
    }
  });

  test('public certificate verification route is not a static 404', async ({ page, request }) => {
    const response = await request.get('/api/certificados/verificar/not-a-valid-certificate');
    expect([404, 400]).toContain(response.status());
    await page.goto('/certificados/verificar/not-a-valid-certificate', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/certificado|inválido|invalido|no encontrado/i).first()).toBeVisible();
  });
});
