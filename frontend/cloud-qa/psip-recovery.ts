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
const out = process.env.QA_ARTIFACTS!, path = out + '/psip-recovery-fixture.json';
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
  if (!existsSync(path)) {
    assert.notEqual(process.env.QA_PSIP_RECOVERY_VERIFY, 'true');
    const login = async (email: string) => (await api('/auth/login', undefined, { email, password: 'OnlyLocal-NightQA-2026!' })).tokens.accessToken;
    const authority = await login(admin.email), participant = await login(actor.email), cases = [];
    for (const [name, role, decision] of [['web', 'GENERADOR', false], ['app', 'OPERADOR', false], ['decision', 'GENERADOR', true]] as const) {
      const id = 'qa-psip-recovery-' + name + '-20261025';
      assert.equal(await db.inspeccion.count({ where: { id } }), 0, 'Preserve all prior evidence');
      await db.inspeccion.create({ data: { id, numero: 'QA-RECOVERY-' + name.toUpperCase(), tipoActor: role,
        [role.toLowerCase() + 'Id']: fixture.actors[role], inspectorId: admin.id, estado: 'NOTIFICADA',
        observaciones: 'QA borradores alternativos y confirmación por lectura. Datos artificiales.' } });
      const request = await api('/inspecciones/' + id + '/intercambios', authority, { version: 1, clienteId: 'qa_recovery_request_' + name,
        tipo: 'REQUERIMIENTO', asunto: 'QA · constancia para ' + name, cuerpo: 'Pedido artificial para comprobar versiones entre pestañas y confirmación al reabrir.' });
      if (decision) await api('/inspecciones/' + id + '/intercambios', participant, { version: 2, clienteId: 'qa_recovery_response_' + name,
        tipo: 'DESCARGO', respondeAId: request.id, asunto: 'QA · respuesta para revisión', cuerpo: 'Respuesta artificial que permite comprobar una decisión y su confirmación.' }, role);
      cases.push({ id, name, role, decision, initialEntries: decision ? 2 : 1 });
    }
    writeFileSync(path, JSON.stringify({ at: new Date().toISOString(), cases }, null, 2));
  }
  const recorded = JSON.parse(readFileSync(path, 'utf8'));
  if (process.env.QA_PSIP_RECOVERY_VERIFY !== 'true' && !recorded.cases.some((item: any) => item.name === 'web-fixed')) {
    const name = 'web-fixed', id = 'qa-psip-recovery-' + name + '-20261025';
    assert.equal(await db.inspeccion.count({ where: { id } }), 0);
    const authority = (await api('/auth/login', undefined, { email: admin.email, password: 'OnlyLocal-NightQA-2026!' })).tokens.accessToken;
    await db.inspeccion.create({ data: { id, numero: 'QA-RECOVERY-WEB-FIXED', tipoActor: 'GENERADOR',
      generadorId: fixture.actors.GENERADOR, inspectorId: admin.id, estado: 'NOTIFICADA', observaciones: 'QA repetición después de corregir la copia textual redundante; artificial.' } });
    await api('/inspecciones/' + id + '/intercambios', authority, { version: 1, clienteId: 'qa_recovery_request_web_fixed',
      tipo: 'REQUERIMIENTO', asunto: 'QA · constancia para web-fixed', cuerpo: 'Pedido artificial para repetir recuperación sin una alternativa textual redundante.' });
    recorded.cases.push({ id, name, role: 'GENERADOR', decision: false, initialEntries: 1 });
    writeFileSync(path, JSON.stringify(recorded, null, 2));
  }
  if (process.env.QA_PSIP_RECOVERY_VERIFY === 'true') {
    const requests = JSON.parse(readFileSync(out + '/psip-recovery-requests.json', 'utf8'));
    const cases = [];
    for (const item of recorded.cases) {
      const row = await db.inspeccion.findUniqueOrThrow({ where: { id: item.id }, include: { intercambios: { orderBy: { secuencia: 'asc' }, include: { adjuntos: true } }, eventos: true } });
      const posts = requests.filter((request: any) => request.method === 'POST' && request.path.startsWith('/api/inspecciones/' + item.id + '/intercambios'));
      assert.equal(posts.length, 1, 'Acknowledgement must not resend: ' + item.name);
      assert.equal(row.intercambios.length, item.initialEntries + 1);
      assert.equal(row.version, row.intercambios.length + 1);
      const entry = row.intercambios.at(-1)!;
      assert.equal(entry.adjuntos.length, 1);
      assert.equal(entry.adjuntos[0].sha256, 'cfa3181c1ee36e8bce5e39f84959f4558ea7ba32c0e4539a8ab3c8ce8c716ec6');
      assert.equal(entry.adjuntos[0].bytes, 69);
      assert.equal(createHash('sha256').update(readFileSync(process.env.UPLOADS_DIR + '/' + entry.adjuntos[0].storageKey)).digest('hex'), entry.adjuntos[0].sha256);
      assert.equal(row.eventos.filter((event: any) => event.metadata?.intercambioId === entry.id).length, 1);
      const recipients = await db.notificacion.findMany({ where: { datos: { contains: entry.id } }, select: { usuarioId: true } });
      const notices = recipients.length;
      assert.ok(notices > 0);
      assert.equal(new Set(recipients.map((notice: any) => notice.usuarioId)).size, notices, 'One notice per authorized recipient');
      cases.push({ name: item.name, entries: row.intercambios.length, version: row.version, posts: posts.length, attachmentHash: entry.adjuntos[0].sha256, attachmentBytes: 69, diskHashVerified: true, notices, uniqueRecipients: notices });
    }
    assert.equal(await db.manifiesto.count(), 526);
    assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
    writeFileSync(out + '/psip-recovery-verified.json', JSON.stringify({ at: new Date().toISOString(), cases }, null, 2));
    console.log(JSON.stringify(cases));
  } else console.log(recorded.cases.length + ' artificial PSIP recovery cases ready.');
} finally { await db.$disconnect(); }
