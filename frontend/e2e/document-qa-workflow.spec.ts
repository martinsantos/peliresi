import { test, expect, type APIRequestContext } from '@playwright/test';
import { jsPDF } from 'jspdf';

/**
 * Mutating document workflow for a disposable QA database only.
 *
 * It is intentionally skipped unless every explicit QA gate is present. No
 * demo credential is used and no endpoint in this suite sends email. The
 * database should be recreated after the run because the fixture creates
 * documents, an ATM receipt, a credential and a certificate.
 */
const enabled = process.env.QA_E2E_ENABLED === 'true';
const confirmed = process.env.QA_E2E_CONFIRM === 'YES';
const isolated = process.env.QA_CONFIRM_ISOLATED === 'YES';
const smtpDisabled = process.env.QA_DISABLE_EMAILS === 'true' || process.env.DISABLE_EMAILS === 'true';
const adminEmail = process.env.QA_ADMIN_EMAIL;
const adminPassword = process.env.QA_ADMIN_PASSWORD;
const actorType = (process.env.QA_ACTOR_TYPE || 'generador').toLowerCase();
const actorId = process.env.QA_ACTOR_ID;
const secondActorId = process.env.QA_SECOND_ACTOR_ID;

const runQa = enabled && confirmed && isolated && smtpDisabled && Boolean(adminEmail && adminPassword && actorId);
test.describe('document management — isolated QA workflow', () => {
  test.skip(!runQa, 'Requires QA_E2E_ENABLED=true, QA_E2E_CONFIRM=YES, isolated DB, QA credentials and disabled SMTP');
  test.skip(!['generador', 'operador', 'transportista'].includes(actorType), 'QA_ACTOR_TYPE is invalid');
  test.skip(!secondActorId, 'A second actor is required for cross-owner ATM dedupe');

  let token = '';
  let actorPath = '';
  const qaRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const regulatoryPdf = (label: string) => Buffer.from(new jsPDF().text(`QA ${label} ${qaRunId}`, 15, 20).output('arraybuffer'));
  const pdf = regulatoryPdf('ATM');

  async function api(request: APIRequestContext, method: string, path: string, options: Record<string, unknown> = {}) {
    const headers = { ...(options.headers as Record<string, string> || {}), Authorization: `Bearer ${token}` };
    return request.fetch(path, { ...options, method, headers });
  }

  test.beforeEach(async ({ request }) => {
    const login = await request.post('/api/auth/login', { data: { email: adminEmail, password: adminPassword } });
    expect(login.ok(), 'QA admin login failed').toBeTruthy();
    const body = await login.json();
    token = body.data?.tokens?.accessToken;
    expect(token).toBeTruthy();
    actorPath = `/api/actores/${actorType}/${actorId}`;
  });

  test('ATM upload is idempotent for the same actor and conflicts across actors', async ({ request }) => {
    const multipart = {
      file: { name: `atm-${qaRunId}.pdf`, mimeType: 'application/pdf', buffer: pdf },
      emisor: 'ATM', referencia: `QA-${qaRunId}`, importe: '1250.50', periodo: '2026-08', cuit: '30-12345678-9', fechaPago: '2026-08-12',
    };
    const [first, retry] = await Promise.all([
      api(request, 'POST', `${actorPath}/comprobantes-atm`, { multipart }),
      api(request, 'POST', `${actorPath}/comprobantes-atm`, { multipart }),
    ]);
    expect([200, 201]).toContain(first.status());
    expect([200, 201]).toContain(retry.status());
    expect([first.status(), retry.status()]).toContain(201);
    expect([first.status(), retry.status()]).toContain(200);

    if (secondActorId) {
      const other = await api(request, 'POST', `/api/actores/${actorType}/${secondActorId}/comprobantes-atm`, { multipart });
      expect(other.status()).toBe(409);
    }
  });

  test('rejects corrupt PDF and false MIME without registering a receipt', async ({ request }) => {
    for (const buffer of [Buffer.from('%PDF-1.4\ncorrupt\n%%EOF'), Buffer.from('<script>not a PDF</script>')]) {
      const response = await api(request, 'POST', `${actorPath}/comprobantes-atm`, { multipart: {
        file: { name: 'invalid.pdf', mimeType: 'application/pdf', buffer },
        emisor: 'ATM', referencia: `INVALID-${qaRunId}`, importe: '10.00', periodo: '2026-08', cuit: '30123456789', fechaPago: '2026-08-12',
      } });
      expect(response.status()).toBe(400);
    }
  });

  test('regulatory approval, certificate issuance and public QR verification', async ({ request }) => {
    const list = await api(request, 'GET', `${actorPath}/documentos-regulatorios`);
    expect(list.ok()).toBeTruthy();
    const current = (await list.json()).data || {};
    const requirements = current.requisitos || [];
    const existing = current.documentos || [];
    const uploaded: Array<{ id: string; tipo: string }> = [];
    for (const requirement of requirements) {
      const already = existing.find((doc: any) => doc.tipo === requirement.tipo && doc.estado === 'APROBADO');
      if (already) continue;
      const form = {
        // The storage layer intentionally deduplicates the original SHA-256
        // globally. Give each distinct regulatory requirement its own fixture
        // bytes so this workflow tests approvals rather than false duplicates.
        file: { name: `${requirement.tipo.toLowerCase()}-qa.pdf`, mimeType: 'application/pdf', buffer: regulatoryPdf(requirement.tipo) },
        tipo: requirement.tipo,
        emisor: 'QA-AUTORIDAD',
        numero: `QA-${requirement.tipo}-${qaRunId}`,
        ...(requirement.requiereVigencia ? { vigenteDesde: '2026-08-01', vigenteHasta: '2027-08-01' } : {}),
      };
      const upload = await api(request, 'POST', `${actorPath}/documentos-regulatorios`, { multipart: form });
      expect([200, 201]).toContain(upload.status());
      const document = (await upload.json()).data?.documento;
      if (document?.id) uploaded.push({ id: document.id, tipo: requirement.tipo });
    }
    for (const document of uploaded) {
      const review = await api(request, 'PATCH', `/api/admin/documentos-regulatorios/${document.id}/revisar`, { data: { estado: 'APROBADO' } });
      expect(review.ok(), `review failed for ${document.tipo}`).toBeTruthy();
    }
    const credential = await api(request, 'POST', `/api/admin/actores/${actorType}/${actorId}/credenciales`, { data: { tipo: `HABILITACION_${actorType.toUpperCase()}`, alcance: 'QA' } });
    expect(credential.ok()).toBeTruthy();
    const credentialId = (await credential.json()).data?.credencial?.id;
    expect(credentialId).toBeTruthy();
    const emission = await api(request, 'POST', `/api/admin/credenciales/${credentialId}/emitir-certificado`, { data: {} });
    expect(emission.ok()).toBeTruthy();
    const emitted = (await emission.json()).data?.emision;
    expect(emitted?.tokenFirmado).toBeTruthy();
    const verification = await request.get(`/api/certificados/verificar/${encodeURIComponent(emitted.tokenFirmado)}`);
    expect(verification.ok()).toBeTruthy();
    expect((await verification.json()).data?.serial).toBe(emitted.serial);
    const download = await api(request, 'GET', `/api/certificados/${emitted.id}/download`);
    expect(download.ok()).toBeTruthy();
    expect(download.headers()['content-type']).toMatch(/application\/pdf/i);
  });

  test('PWA shell is available after the API workflow', async ({ page }) => {
    await page.goto('/app/', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveTitle(/404|not found/i);
    await expect(page.locator('#root')).toBeVisible();
  });
});
