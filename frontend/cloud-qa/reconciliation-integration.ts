import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient(), base = 'http://127.0.0.1:3037/api/manifiestos/baja-intensidad';
const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
async function login(name: string) {
  const res = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: name + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(res.status, 200); return (await res.json()).data.tokens.accessToken;
}
async function request(token: string, route: string, status = 200, body?: object) {
  const res = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const bytes = Buffer.from(await res.arrayBuffer()), text = bytes.toString('utf8');
  assert.equal(res.status, status, text);
  if (res.headers.get('content-type')?.includes('text/csv')) {
    assert.equal(bytes.length, Number(res.headers.get('x-content-bytes')));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), res.headers.get('x-content-sha256'));
    assert.equal(bytes.subarray(0, 3).toString('hex'), 'efbbbf');
    return text;
  }
  return JSON.parse(text).data;
}
try {
  const admin = await login('admin'), operator = await login('operador'), other = await login('operador2'), outsider = await login('generador');
  const originalUser = await db.usuario.findUniqueOrThrow({ where: { id: fixture.users.generador } });
  const user = await db.usuario.create({ data: { email: 'reconciliation-actor@night-qa.invalid', nombre: 'QA Conciliado',
    password: originalUser.password, rol: 'GENERADOR', activo: true, emailVerified: true, notifEmail: false,
    notifWhatsapp: false, notifTelegram: false, notifNuevoRegistro: false } });
  const actor = await db.generador.create({ data: { usuarioId: user.id, razonSocial: 'QA Ficha conciliada', cuit: '30712345671',
    domicilio: 'QA nube', telefono: '000000', email: user.email, numeroInscripcion: 'QA-CONC', categoria: 'GRAN_GENERADOR' } });
  async function seed(name: string, identity = '30-71234567-1', owner = fixture.users.operador, residues?: object[]) {
    const id = randomUUID();
    await db.registroManifiestoExcepcional.create({ data: { id, operadorId: fixture.actors.operador, creadoPorId: owner,
      huellaSolicitud: id, datos: { id, generador: { nombre: name, identificacion: identity, domicilio: 'Original QA' },
        transportista: { nombre: 'QA externo', identificacion: 'dudoso' }, motivo: 'QA conciliación',
        residuos: residues || [{ corriente: 'Y1', cantidad: 7, unidad: 'kg' }] }, eventos: [] } });
    return id;
  }
  const id = await seed('QA Conciliación HTTP');
  for (const surface of ['web-desktop', 'web-responsive', 'app', 'apk']) await seed('QA Conciliación ' + surface);
  const doubtful = await seed('QA Dudoso', '30712345670'), self = await seed('QA Autor', '30-71234567-1', fixture.users.admin);
  const injection = await seed('=HYPERLINK("https://invalid")', 'QA-CSV-INJECTION');
  await seed('QA límite', 'QA-EXPORT-LIMIT', undefined, Array.from({ length: 10001 }, () => ({ corriente: 'Y1', cantidad: 1, unidad: 'kg' })));
  const snapshot = async () => ({ records: await db.registroManifiestoExcepcional.findMany({ orderBy: { id: 'asc' } }),
    manifests: await db.manifiesto.findMany({ orderBy: { id: 'asc' }, include: { residuos: true, eventos: true } }),
    notifications: await db.notificacion.count(), users: await db.usuario.count() });
  const before = await snapshot();
  const route = '/' + id + '/conciliacion';
  const view = await request(admin, route + '?rol=generador');
  assert.equal(view.candidato.id, actor.id); assert.equal(view.revision, 0); assert.equal(view.puedeRevisar, true);
  assert.equal((await request(operator, route + '?rol=generador')).puedeRevisar, false);
  await request(other, route + '?rol=generador', 404); await request(outsider, route + '?rol=generador', 404); // spec v2 §5: not a party of this record
  const command = { id: randomUUID(), revision: 0, rol: 'generador', accion: 'VINCULAR', actorId: actor.id, motivo: 'QA revisión explícita' };
  await request(operator, route, 403, command);
  await request(admin, '/' + self + '/conciliacion', 403, command);
  assert.equal((await request(admin, '/' + doubtful + '/conciliacion?rol=generador')).candidato, null);
  await request(admin, '/' + doubtful + '/conciliacion', 409, command);
  await request(admin, route, 409, { ...command, actorId: fixture.actors.generador });
  const attempts = await Promise.all([command, { ...command, id: randomUUID() }].map(async body => {
    const res = await fetch(base + route, { method: 'POST', headers: { Authorization: 'Bearer ' + admin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, body };
  }));
  assert.deepEqual(attempts.map(a => a.status).sort(), [200, 409]);
  const winner = attempts.find(a => a.status === 200)!.body;
  await request(admin, route, 200, winner); // retry does not append twice
  await request(admin, route, 409, { ...winner, motivo: 'Contenido cambiado' });
  const linked = await request(admin, route + '?rol=generador');
  assert.equal(linked.historial.length, 1); assert.equal(linked.vinculo.ficha.cuit, actor.cuit);
  const linkedToken = await login('reconciliation-actor');
  await request(linkedToken, '/' + id, 404); // identity link never becomes access grant
  const csv = await request(operator, '/seguimiento/exportar?rol=generador&identificacion=QA-TRACKING-SHARED');
  assert.equal(csv.split('\r\n').length, 85, 'all 21 original movements and 4 waste rows, not only visible page');
  const linkedCsv = await request(admin, '/seguimiento/exportar?rol=generador&identificacion=30-71234567-1');
  assert.ok(linkedCsv.includes('"VINCULAR"') && linkedCsv.includes('"QA Ficha conciliada"') && linkedCsv.includes('"QA Conciliación HTTP"'));
  const formulaCsv = await request(operator, '/seguimiento/exportar?identificacion=QA-CSV-INJECTION');
  assert.ok(formulaCsv.includes('"\'=HYPERLINK(') && formulaCsv.includes(injection));
  // Spec v2 §5: a generator exports only its own records; sector administrators stay denied.
  const outsiderCsv = await request(outsider, '/seguimiento/exportar?rol=generador&identificacion=30-71234567-1');
  assert.equal(outsiderCsv.split('\r\n').length, 1, 'header only: none of these records belongs to that generator');
  await request(await login('jefe-operadores'), '/seguimiento/exportar', 403);
  await request(operator, '/seguimiento/exportar?page=2', 400);
  await request(operator, '/seguimiento/exportar?identificacion=QA-EXPORT-LIMIT', 422);
  await request(admin, route, 409, { ...command, id: randomUUID() });
  await request(admin, route, 200, { id: randomUUID(), revision: 1, rol: 'generador', accion: 'DESVINCULAR', motivo: 'QA rectificación sin borrar' });
  const unlinked = await request(admin, route + '?rol=generador');
  assert.equal(unlinked.vinculo, null); assert.equal(unlinked.historial.length, 2); assert.equal(unlinked.historial[1].ficha.id, actor.id);
  assert.deepEqual(await snapshot(), before, 'all original records, quantities, users, notices and legacy manifests unchanged');
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'reconciliation-http.json'), JSON.stringify({ passed: true, cases: [
    'checksum and exact CUIT candidate, doubtful identity remains pending', 'reviewer-only confirmation, own-author and foreign operator denied',
    'concurrent commands produce one revision, identical retry idempotent, changed retry conflicts',
    'link and revoke append history, never grant participant access', 'whole-filter export with original and reconciled snapshots',
    'CSV formula protection, role scope, explicit limit error instead of truncation', 'original records, legacy manifests, users and notices unchanged',
  ] }, null, 2));
} finally { await db.$disconnect(); }
