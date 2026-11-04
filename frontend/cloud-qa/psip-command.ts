import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const out = process.env.QA_ARTIFACTS!, path = out + '/psip-command-fixture.json';
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-product-ux-20261023/multirol-draft-20261024/multirol-fixture.json', 'utf8'));
assert.equal(fixture.email, 'draft-multirole-20261024@night-qa.invalid');
async function api(route: string, token?: string, body?: unknown, role?: string) {
  const response = await fetch('http://127.0.0.1:3037/api' + route, { method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(role ? { 'X-SITREP-Activity': role } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json(); assert.ok(response.ok, route + ': ' + JSON.stringify(result)); return result.data;
}
try {
  const actor = await db.usuario.findUniqueOrThrow({ where: { id: fixture.userId } }); assert.equal(actor.email, fixture.email);
  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
  let recorded: any;
  if (!existsSync(path)) {
    assert.notEqual(process.env.QA_PSIP_COMMAND_VERIFY, 'true');
    const auth = async (email: string) => (await api('/auth/login', undefined, { email, password: 'OnlyLocal-NightQA-2026!' })).tokens.accessToken;
    const authority = await auth(admin.email), participant = await auth(fixture.email), cases = [];
    for (const [name, role, decision] of [
      ['web-response', 'GENERADOR', false], ['app-response', 'OPERADOR', false],
      ['web-decision', 'GENERADOR', true], ['app-decision', 'OPERADOR', true],
      ['other-activity', 'TRANSPORTISTA', false],
    ] as const) {
      const id = 'qa-psip-command-' + name + '-20261025';
      assert.equal(await db.inspeccion.count({ where: { id } }), 0, 'Never overwrite evidence');
      await db.inspeccion.create({ data: { id, numero: 'QA-COMMAND-' + name.toUpperCase(), tipoActor: role,
        [role.toLowerCase() + 'Id']: fixture.actors[role], inspectorId: admin.id, estado: 'NOTIFICADA',
        observaciones: 'QA recuperación de envío; expediente artificial sin datos ni efectos reales.' } });
      const request = await api('/inspecciones/' + id + '/intercambios', authority, { version: 1, clienteId: 'qa_command_request_' + name,
        tipo: 'REQUERIMIENTO', asunto: 'QA · constancia para ' + name, cuerpo: 'Pedido artificial para comprobar recuperación de respuesta y adjuntos. No cargar datos reales.' });
      if (decision) await api('/inspecciones/' + id + '/intercambios', participant, { version: 2, clienteId: 'qa_command_response_' + name,
        tipo: 'DESCARGO', respondeAId: request.id, asunto: 'QA · respuesta para revisión', cuerpo: 'Constancia artificial preparada para decidir y comprobar recuperación.' }, role);
      cases.push({ id, name, role, decision, initialEntries: decision ? 2 : 1 });
    }
    recorded = { at: new Date().toISOString(), cases, manifests: await db.manifiesto.count() };
    writeFileSync(path, JSON.stringify(recorded, null, 2));
  } else recorded = JSON.parse(readFileSync(path, 'utf8'));
  if (process.env.QA_PSIP_COMMAND_VERIFY !== 'true' && !recorded.cases.some((item: any) => item.name === 'web-response-cut')) {
    const name = 'web-response-cut', id = 'qa-psip-command-' + name + '-20261025';
    assert.equal(await db.inspeccion.count({ where: { id } }), 0);
    const authority = (await api('/auth/login', undefined, { email: admin.email, password: 'OnlyLocal-NightQA-2026!' })).tokens.accessToken;
    await db.inspeccion.create({ data: { id, numero: 'QA-COMMAND-WEB-RESPONSE-CUT', tipoActor: 'GENERADOR', generadorId: fixture.actors.GENERADOR,
      inspectorId: admin.id, estado: 'NOTIFICADA', observaciones: 'QA respuesta HTTP perdida después del registro; artificial.' } });
    await api('/inspecciones/' + id + '/intercambios', authority, { version: 1, clienteId: 'qa_command_request_web_response_cut',
      tipo: 'REQUERIMIENTO', asunto: 'QA · constancia para web-response-cut', cuerpo: 'Pedido artificial para comprobar reapertura tras un resultado incierto.' });
    recorded.cases.push({ id, name, role: 'GENERADOR', decision: false, initialEntries: 1 });
    writeFileSync(path, JSON.stringify(recorded, null, 2));
  }
  const checks = [];
  for (const item of recorded.cases) {
    const row = await db.inspeccion.findUniqueOrThrow({ where: { id: item.id }, include: {
      intercambios: { orderBy: { secuencia: 'asc' }, include: { adjuntos: true } }, eventos: true,
    } });
    const sent = item.name !== 'other-activity';
    if (process.env.QA_PSIP_COMMAND_VERIFY === 'true') {
      assert.equal(row.intercambios.length, item.initialEntries + (sent ? 1 : 0), item.name + ': no duplicate act');
      assert.equal(row.version, row.intercambios.length + 1);
      const entry = row.intercambios.at(-1)!;
      if (sent) {
        assert.match(entry.clienteId || '', /^(exchange|decision)_/);
        assert.equal(entry.adjuntos.length, 1);
        const file = entry.adjuntos[0];
        assert.equal(file.nombreOriginal, 'constancia-qa-command.pdf');
        const expected = createHash('sha256').update('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n').digest('hex');
        assert.equal(file.sha256, expected);
        assert.equal(createHash('sha256').update(readFileSync(process.env.UPLOADS_DIR + '/' + file.storageKey)).digest('hex'), expected);
        assert.equal(row.eventos.filter((event: any) => (event.metadata as any)?.intercambioId === entry.id).length, 1);
        const notices = await db.notificacion.count({ where: { datos: { contains: entry.id } } });
        assert.ok(notices > 0);
        checks.push({ name: item.name, entries: row.intercambios.length, state: row.estado, clientId: entry.clienteId, attachments: 1, notices, sha256: file.sha256 });
      }
    }
  }
  assert.equal(await db.manifiesto.count(), recorded.manifests);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  if (process.env.QA_PSIP_COMMAND_VERIFY === 'true') writeFileSync(out + '/psip-command-verified.json', JSON.stringify({ at: new Date().toISOString(), checks, manifests: recorded.manifests, emailSent: 0, emailAttempts: 0 }, null, 2));
  console.log('Synthetic command cases ' + (checks.length ? 'verified: ' + checks.length : 'ready'));
} finally { await db.$disconnect(); }
