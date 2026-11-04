import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const out = process.env.QA_ARTIFACTS!, path = out + '/legacy-exchange-fixture.json';
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-product-ux-20261023/multirol-draft-20261024/multirol-fixture.json', 'utf8'));
assert.equal(fixture.email, 'draft-multirole-20261024@night-qa.invalid');
const mode = process.env.QA_LEGACY_EXCHANGE_MODE || 'fixture';
async function api(route: string, token?: string, body?: unknown) {
  const response = await fetch('http://127.0.0.1:3037/api' + route, { method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json(); assert.ok(response.ok, route + ': ' + JSON.stringify(result)); return result.data;
}
try {
  const actor = await db.usuario.findUniqueOrThrow({ where: { id: fixture.userId } }); assert.equal(actor.email, fixture.email);
  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
  if (!existsSync(path)) {
    assert.equal(mode, 'fixture');
    const authority = (await api('/auth/login', undefined, { email: admin.email, password: 'OnlyLocal-NightQA-2026!' })).tokens.accessToken;
    const cases = [];
    for (const role of ['GENERADOR', 'OPERADOR']) {
      const id = 'qa-legacy-exchange-' + role.toLowerCase() + '-20261025';
      assert.equal(await db.inspeccion.count({ where: { id } }), 0, 'Do not overwrite evidence');
      await db.inspeccion.create({ data: { id, numero: 'QA-ANTERIOR-' + role, tipoActor: role,
        [role.toLowerCase() + 'Id']: fixture.actors[role], inspectorId: admin.id, estado: 'NOTIFICADA',
        observaciones: 'QA recuperación de respuesta anterior. Datos artificiales.' } });
      const request = await api('/inspecciones/' + id + '/intercambios', authority, { version: 1, clienteId: 'qa_legacy_exchange_' + role,
        tipo: 'REQUERIMIENTO', asunto: 'QA · constancia de ' + role, cuerpo: 'Pedido artificial para recuperar una respuesta anterior con su adjunto sin presentarla automáticamente.' });
      cases.push({ id, role, requestId: request.id });
    }
    writeFileSync(path, JSON.stringify({ userId: actor.id, email: actor.email, cases }, null, 2));
  }
  const recorded = JSON.parse(readFileSync(path, 'utf8'));
  if (mode !== 'fixture') {
    const cases = [];
    for (const item of recorded.cases) {
      const row = await db.inspeccion.findUniqueOrThrow({ where: { id: item.id }, include: { intercambios: { orderBy: { secuencia: 'asc' }, include: { adjuntos: true } }, eventos: true } });
      assert.equal(row.intercambios.length, mode === 'before' ? 1 : 2);
      assert.equal(row.version, mode === 'before' ? 2 : 3);
      if (mode === 'after') {
        const entry = row.intercambios[1]; assert.equal(entry.autorId, actor.id); assert.equal(entry.respondeAId, item.requestId);
        assert.equal(entry.cuerpo, 'QA · respuesta antigua de ' + item.role + ' con su constancia.');
        assert.equal(entry.adjuntos.length, 1);
        const attachment = entry.adjuntos[0], expected = readFileSync(out + '/respuesta-anterior.pdf');
        assert.equal(attachment.bytes, expected.length); assert.equal(attachment.sha256, createHash('sha256').update(expected).digest('hex'));
        assert.equal(createHash('sha256').update(readFileSync(process.env.UPLOADS_DIR + '/' + attachment.storageKey)).digest('hex'), attachment.sha256);
        assert.equal(row.eventos.filter((event: any) => event.metadata?.intercambioId === entry.id).length, 1);
      }
      cases.push({ id: item.id, role: item.role, version: row.version, entries: row.intercambios.length, attachments: row.intercambios.reduce((sum: number, entry: any) => sum + entry.adjuntos.length, 0) });
    }
    assert.equal(await db.manifiesto.count(), 526); assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
    writeFileSync(out + '/legacy-exchange-' + mode + '.json', JSON.stringify({ at: new Date().toISOString(), cases }, null, 2));
    console.log(JSON.stringify(cases));
  } else console.log('Two artificial requests ready; no responses sent.');
} finally { await db.$disconnect(); }
