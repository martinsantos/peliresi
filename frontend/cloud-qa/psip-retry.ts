import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-product-ux-20261023/multirol-draft-20261024/multirol-fixture.json', 'utf8'));
assert.equal(fixture.email, 'draft-multirole-20261024@night-qa.invalid');
const out = process.env.QA_ARTIFACTS!, checks: unknown[] = [];
const pdf = Buffer.from('%PDF-1.4\n% QA synthetic PSIP retry evidence, not a real document.\n%%EOF');
const sha = createHash('sha256').update(pdf).digest('hex');
type Attachment = { name: string; bytes: Buffer };
const attachment = { name: 'constancia-qa.pdf', bytes: pdf };
let requests = 0;
async function call(path: string, token: string, role?: string, body?: Record<string, unknown>, files: Attachment[] = []) {
  const headers: Record<string, string> = { Authorization: 'Bearer ' + token, ...(role ? { 'X-SITREP-Activity': role } : {}) };
  const data = body ? new FormData() : undefined;
  if (data && body) {
    for (const [key, value] of Object.entries(body)) if (value !== undefined) data.set(key, String(value));
    for (const file of files) data.append('files', new Blob([file.bytes], { type: 'application/pdf' }), file.name);
  }
  const response = await fetch('http://127.0.0.1:3037/api' + path, { method: body ? 'POST' : 'GET', headers, body: data });
  const result = await response.json(); requests++;
  return { status: response.status, result };
}
async function login(email: string) {
  const response = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(response.status, 200); requests++;
  return (await response.json()).data.tokens.accessToken as string;
}
function success(response: Awaited<ReturnType<typeof call>>, statuses = [200]) {
  assert.ok(statuses.includes(response.status), JSON.stringify(response));
  return response.result.data;
}
try {
  const user = await db.usuario.findUniqueOrThrow({ where: { id: fixture.userId } });
  assert.equal(user.email, fixture.email);
  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
  const authority = await login(admin.email), participant = await login(fixture.email);
  const manifestCount = await db.manifiesto.count();
  for (const role of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) {
    const id = 'qa-psip-retry-' + role.toLowerCase() + '-20261025';
    const actorId = fixture.actors[role];
    const actor = await db[role.toLowerCase()].findUniqueOrThrow({ where: { id: actorId } });
    assert.equal(actor.usuarioId, fixture.userId);
    let inspection = await db.inspeccion.findUnique({ where: { id } });
    if (!inspection) inspection = await db.inspeccion.create({ data: {
      id, numero: 'QA-PSIP-RETRY-' + role + '-20261025', tipoActor: role,
      [role.toLowerCase() + 'Id']: actorId, inspectorId: admin.id, estado: 'NOTIFICADA',
      observaciones: 'QA reintentos concurrentes; datos artificiales. No enviar documentación real.',
    } });
    assert.equal(inspection[role.toLowerCase() + 'Id'], actorId);
    assert.equal(inspection.inspectorId, admin.id);
    const path = '/inspecciones/' + id + '/intercambios';
    const requestBody = { version: 1, clienteId: 'qa_retry_request_' + role.toLowerCase(), tipo: 'REQUERIMIENTO',
      asunto: 'QA · pedido con reintento ' + role, cuerpo: 'Pedido artificial para comprobar que el mismo envío no se incorpora dos veces.' };
    const first = await Promise.all([call(path, authority, undefined, requestBody, [attachment]), call(path, authority, undefined, requestBody, [attachment])]);
    const requestEntry = success(first[0], [200, 201]);
    assert.equal(success(first[1], [200, 201]).id, requestEntry.id);
    const responseBody = { version: 2, clienteId: 'qa_retry_response_' + role.toLowerCase(), tipo: 'DESCARGO',
      asunto: 'QA · respuesta preservada ' + role, cuerpo: 'Respuesta artificial con un adjunto. Su reintento debe devolver la misma actuación.', respondeAId: requestEntry.id };
    const responses = await Promise.all([call(path, participant, role, responseBody, [attachment]), call(path, participant, role, responseBody, [attachment])]);
    const responseEntry = success(responses[0], [200, 201]);
    assert.equal(success(responses[1], [200, 201]).id, responseEntry.id);
    const decisionBody = { version: 3, clienteId: 'qa_retry_decision_' + role.toLowerCase(), decision: role === 'OPERADOR' ? 'DERIVADA_LEGALES' : 'CERRADA_CONFORME',
      fundamento: 'Decisión artificial suficiente para verificar recuperación sin repetir el cierre ni sus avisos.', ...(role === 'OPERADOR' ? { expedienteLegal: 'QA-LEGAL-20261025' } : {}) };
    const decisions = await Promise.all([call(path + '/decision', authority, undefined, decisionBody, [attachment]), call(path + '/decision', authority, undefined, decisionBody, [attachment])]);
    const decisionEntry = success(decisions[0]); assert.equal(success(decisions[1]).id, decisionEntry.id);
    const entryIds = [requestEntry.id, responseEntry.id, decisionEntry.id];
    const before = await db.notificacion.findMany({ where: { OR: entryIds.map(entry => ({ datos: { contains: entry } })) }, select: { id: true, usuarioId: true, datos: true } });
    assert.ok(before.some(n => n.usuarioId === fixture.userId && n.datos.includes(requestEntry.id)));
    assert.ok(before.some(n => n.usuarioId === admin.id && n.datos.includes(responseEntry.id)));
    assert.ok(before.some(n => n.usuarioId === fixture.userId && n.datos.includes(decisionEntry.id)));
    for (const [body, route, token, activity, expected] of [
      [requestBody, path, authority, undefined, requestEntry.id], [responseBody, path, participant, role, responseEntry.id],
      [decisionBody, path + '/decision', authority, undefined, decisionEntry.id],
    ] as const) assert.equal(success(await call(route, token, activity, body, [attachment])).id, expected);
    const conflicts = [
      await call(path, participant, role, { ...responseBody, cuerpo: 'Este texto cambiado no debe aceptarse como el envío original.' }, [attachment]),
      await call(path, participant, role, responseBody, [{ ...attachment, bytes: Buffer.from('%PDF-changed-bytes') }]),
      await call(path, participant, role, responseBody, [{ ...attachment, name: 'otro-nombre.pdf' }]),
      await call(path, participant, role, responseBody, []),
      await call(path + '/decision', authority, undefined, { ...decisionBody, fundamento: 'Otra decisión no debe confundirse con la original ya registrada.' }, [attachment]),
      await call(path + '/decision', authority, undefined, { ...decisionBody, clienteId: decisionBody.clienteId + '_new' }, [attachment]),
    ];
    for (const response of conflicts) assert.equal(response.status, 409, JSON.stringify(response));
    for (const other of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].filter(r => r !== role)) {
      assert.equal((await call(path, participant, other, responseBody, [attachment])).status, 403);
    }
    const after = await db.notificacion.findMany({ where: { OR: entryIds.map(entry => ({ datos: { contains: entry } })) }, select: { id: true } });
    assert.deepEqual(after.map(n => n.id).sort(), before.map(n => n.id).sort());
    const entries = await db.intercambioInspeccion.findMany({ where: { inspeccionId: id }, orderBy: { secuencia: 'asc' }, include: { adjuntos: true } });
    assert.equal(entries.length, 3);
    entries.forEach((entry, index) => {
      assert.equal(entry.versionExpediente, index + 2); assert.equal(entry.secuencia, index + 1);
      assert.equal(entry.adjuntos.length, 1); assert.equal(entry.adjuntos[0].sha256, sha);
      assert.equal(entry.hashAnterior, index ? entries[index - 1].hashCadena : null);
      assert.equal(createHash('sha256').update(readFileSync(process.env.UPLOADS_DIR + '/' + entry.adjuntos[0].storageKey)).digest('hex'), sha);
    });
    assert.equal(await db.eventoInspeccion.count({ where: { inspeccionId: id, tipo: { startsWith: 'INTERCAMBIO_' } } }), 3);
    const current = await db.inspeccion.findUniqueOrThrow({ where: { id } });
    assert.equal(current.version, 4); assert.equal(current.estado, decisionBody.decision);
    const timeline = success(await call(path, participant, role)); assert.equal(timeline.intercambios.length, 3);
    checks.push({ role, id, version: current.version, state: current.estado, exchanges: entries.length, attachments: 3, noticeCount: before.length,
      concurrency: [first.map(r => r.status), responses.map(r => r.status), decisions.map(r => r.status)], unchangedNoticesAfterRetries: true });
  }
  assert.equal(await db.manifiesto.count(), manifestCount);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  writeFileSync(out + '/psip-retry-http.json', JSON.stringify({ at: new Date().toISOString(), requests, checks, manifestCount, externalDeliveryAttempts: 0,
    limitations: ['HTTP replay and concurrency; browser durable command recovery remains pending.', 'No physical Android or human usability session.'] }, null, 2));
  console.log('PSIP replay integration passed:', checks.length, 'roles;', requests, 'HTTP requests; no external deliveries.');
} finally { await db.$disconnect(); }
