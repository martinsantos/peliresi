import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';

await assertCloudDatabase();
const base = process.env.QA_API_URL;
assert.equal(base, 'http://127.0.0.1:3037/api');
const output = process.env.QA_ARTIFACTS!;
const fixture = JSON.parse(await readFile(path.join(output, 'fixture.json'), 'utf8'));
assert.equal(fixture.database, 'sitrep_night_qa_20260926'); assert.equal(fixture.externalDelivery, false);
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const results: Array<{ name: string; status: string; error?: string }> = [];
let fatal: string | undefined;
const tokens: Record<string, string> = {};
type Ticket = { id: string; version: number; estado: string; mensajes: Array<{ cuerpo: string; interno: boolean; adjuntos: Array<{ id: string }> }> };
async function call<T>(who: string | null, route: string, method = 'GET', body?: unknown, expected = 200, key?: string) {
  const response = await fetch(base + route, { method, headers: {
    ...(who ? { Authorization: 'Bearer ' + tokens[who] } : {}),
    ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(key ? { 'Idempotency-Key': key } : {}),
  }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, expected, method + ' ' + route);
  const result = await response.json() as { success: boolean; data: T };
  assert.equal(result.success, expected < 400); if (expected >= 400) assert.equal(result.data, undefined);
  return result.data;
}
async function check(name: string, task: () => Promise<void>) {
  try { await task(); results.push({ name, status: 'PASS' }); }
  catch (error) { results.push({ name, status: 'FAIL', error: String(error) }); throw error; }
}
try {
  for (const [index, who] of ['admin', 'generador', 'generador2', 'operador2'].entries()) {
    const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '127.10.4.' + (index + 1) },
      body: JSON.stringify({ email: who + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
    assert.equal(response.status, 200);
    const login = await response.json() as { data: { tokens: { accessToken: string }; user: { id: string } } };
    assert.equal(login.data.user.id, fixture.users[who]); tokens[who] = login.data.tokens.accessToken;
  }
  await check('unaltered additive migration executes on PostgreSQL without changing existing users', async () => {
    const migration = await readFile(path.join(root, 'backend/prisma/migrations/20261006010000_native_support/migration.sql'), 'utf8');
    const sql = 'BEGIN; CREATE SCHEMA support_migration_check; SET LOCAL search_path TO support_migration_check; CREATE TABLE usuarios(id TEXT PRIMARY KEY);\n' + migration + '\nROLLBACK;';
    execFileSync('psql', ['-h', '127.0.0.1', '-p', '55440', '-U', 'qa', '-d', 'sitrep_night_qa_20260926', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', timeout: 15000 });
  });
  await check('anonymous sessions and non-support actors cannot open the desk or configure agents', async () => {
    await call(null, '/soporte/acceso', 'GET', undefined, 401);
    await call('generador', '/soporte?scope=mesa', 'GET', undefined, 403);
    await call('generador', '/soporte/equipo', 'GET', undefined, 403);
    await call('generador', '/soporte/candidatos?search=qa', 'GET', undefined, 403);
    await call('generador', '/soporte/equipo/' + fixture.users.operador2, 'PATCH', { habilitado: true }, 403);
  });
  const input = { asunto: 'QA soporte HTTP: problema sintético', descripcion: 'Detalle completamente sintético, sin destinatarios externos.', categoria: 'GENERAL', contexto: { ruta: '/app/manifiestos/case?token=secret#section', rol: 'ADMIN', token: 'secret' } };
  await check('payload cannot forge ticket ownership, role or channel', async () => {
    await call('generador', '/soporte', 'POST', { ...input, autorId: fixture.users.admin }, 400, 'forged-owner-123');
  });
  let id = '';
  await check('concurrent identical creation creates one ticket and one durable set of internal notices', async () => {
    const before = await db.ticketSoporte.count({ where: { autorId: fixture.users.generador } });
    const responses = await Promise.all(Array.from({ length: 3 }, async () => {
      const response = await fetch(base + '/soporte', { method: 'POST', headers: { Authorization: 'Bearer ' + tokens.generador, 'Content-Type': 'application/json', 'Idempotency-Key': 'http-create-same-key-123' }, body: JSON.stringify(input) });
      assert.ok([200, 201].includes(response.status)); return (await response.json()).data;
    }));
    id = responses[0].id; assert.ok(responses.every(row => row.id === id));
    assert.equal(await db.ticketSoporte.count({ where: { autorId: fixture.users.generador } }), before + 1);
    const row = await db.ticketSoporte.findUniqueOrThrow({ where: { id } });
    assert.deepEqual(row.contexto, { ruta: '/app/manifiestos/case' });
    assert.equal(await db.mensajeSoporte.count({ where: { ticketId: id } }), 1);
    assert.equal(await db.notificacion.count({ where: { datos: { contains: id } } }), 1);
  });
  await check('foreign reads and mismatched reused keys do not disclose or duplicate tickets', async () => {
    await call('generador2', '/soporte/' + id, 'GET', undefined, 404);
    await call('generador2', '/soporte/envios/http-create-same-key-123', 'GET', undefined, 404);
    await call('generador', '/soporte', 'POST', { ...input, descripcion: 'Otro contenido distinto a la petición.' }, 409, 'http-create-same-key-123');
  });
  await call('admin', '/soporte/' + id + '/acciones', 'POST', { accion: 'TOMAR', version: 1, cuerpo: '' }, 200, 'http-claim-123');
  await check('stale updates cannot write messages, events or notifications', async () => {
    const before = await db.eventoSoporte.count({ where: { ticketId: id } });
    await call('generador', '/soporte/' + id + '/acciones', 'POST', { accion: 'RESPONDER', version: 1, cuerpo: 'Mensaje con versión antigua.' }, 409, 'http-stale-123');
    assert.equal(await db.eventoSoporte.count({ where: { ticketId: id } }), before);
  });
  const privateForm = new FormData();
  privateForm.append('accion', 'NOTA'); privateForm.append('version', '2'); privateForm.append('cuerpo', 'QA nota privada: no mostrar al actor.');
  privateForm.append('files', new Blob([Buffer.from('%PDF-1.7\nQA support fixture')], { type: 'application/pdf' }), 'qa-note.pdf');
  await call('admin', '/soporte/' + id + '/acciones', 'POST', privateForm, 200, 'http-private-note-123');
  await check('private notes, attachments and history stay server-filtered for the reporter', async () => {
    const own = await call<Ticket & { autor: Record<string, unknown> }>('generador', '/soporte/' + id);
    assert.equal(Object.hasOwn(own.autor, 'email'), false);
    const staff = await call<Ticket>('admin', '/soporte/' + id);
    assert.equal(own.mensajes.length, 1); assert.equal(staff.mensajes.length, 2);
    const file = staff.mensajes.find(message => message.interno)!.adjuntos[0];
    await call('generador', '/soporte/' + id + '/adjuntos/' + file.id, 'GET', undefined, 404);
    const download = await fetch(base + '/soporte/' + id + '/adjuntos/' + file.id, { headers: { Authorization: 'Bearer ' + tokens.admin } });
    assert.equal(download.status, 200); assert.equal(download.headers.get('cache-control'), 'private, no-store');
    assert.match(await download.text(), /^%PDF-1.7/);
  });
  await call('admin', '/soporte/equipo/' + fixture.users.operador2, 'PATCH', { habilitado: true });
  await check('support grant does not expand actor role or legal dossier permissions', async () => {
    const user = await db.usuario.findUniqueOrThrow({ where: { id: fixture.users.operador2 } }); assert.equal(user.rol, 'OPERADOR');
    const directory = await call<Array<{ id: string; email: string }>>('operador2', '/soporte/equipo');
    assert.equal(directory.find(agent => agent.id === user.id)?.email, 'operador2@night-qa.invalid');
    await call('operador2', '/soporte/candidatos?search=qa', 'GET', undefined, 403);
    await call('operador2', '/actores/generadores/' + fixture.actors.generador, 'GET', undefined, 403);
    await call('operador2', '/soporte/equipo/' + fixture.users.generador2, 'PATCH', { habilitado: true }, 403);
  });
  await check('handoff is recorded, notifies the exact active agent and blocks deactivation with open assignments', async () => {
    await call('admin', '/soporte/' + id + '/acciones', 'POST', { accion: 'DERIVAR', version: 3, cuerpo: 'QA motivo interno de derivación.', responsableId: fixture.users.operador2 }, 200, 'http-handoff-123');
    const ticket = await db.ticketSoporte.findUniqueOrThrow({ where: { id } }); assert.equal(ticket.responsableId, fixture.users.operador2);
    const notice = await db.notificacion.findFirstOrThrow({ where: { usuarioId: fixture.users.operador2, datos: { contains: id } } });
    assert.equal(notice.titulo, 'Ticket derivado a tu atención'); assert.equal(JSON.parse(notice.datos).ruta, '/soporte/' + id);
    await call('admin', '/soporte/equipo/' + fixture.users.operador2, 'PATCH', { habilitado: false }, 409);
    assert.equal((await db.agenteSoporte.findUniqueOrThrow({ where: { usuarioId: fixture.users.operador2 } })).habilitado, true);
    const own = await call<Ticket>('generador', '/soporte/' + id); assert.ok(own.mensajes.every(row => !row.interno));
  });
  await check('exact response retry returns the receipt without duplicate messages, events or notices', async () => {
    const response = { accion: 'ESPERAR', version: 4, cuerpo: 'QA verificá si podés abrir la pantalla.' };
    await call('operador2', '/soporte/' + id + '/acciones', 'POST', response, 200, 'http-response-123');
    const counts = [await db.mensajeSoporte.count({ where: { ticketId: id } }), await db.eventoSoporte.count({ where: { ticketId: id } }), await db.notificacion.count({ where: { datos: { contains: id } } })];
    const replay = await call<{ replay: boolean }>('operador2', '/soporte/' + id + '/acciones', 'POST', response, 200, 'http-response-123'); assert.equal(replay.replay, true);
    assert.deepEqual([await db.mensajeSoporte.count({ where: { ticketId: id } }), await db.eventoSoporte.count({ where: { ticketId: id } }), await db.notificacion.count({ where: { datos: { contains: id } } })], counts);
  });
  await check('closure and reporter reopening preserve the same ticket, numbering and history', async () => {
    await call('operador2', '/soporte/' + id + '/acciones', 'POST', { accion: 'CERRAR', version: 5, cuerpo: 'QA resolución sintética documentada.' }, 200, 'http-close-123');
    const number = (await db.ticketSoporte.findUniqueOrThrow({ where: { id } })).numero;
    await call('admin', '/soporte/equipo/' + fixture.users.operador2, 'PATCH', { habilitado: false });
    await call('generador', '/soporte/' + id + '/acciones', 'POST', { accion: 'RESPONDER', version: 6, cuerpo: 'QA el problema persiste: se solicita revisión.' }, 200, 'http-reopen-123');
    const row = await db.ticketSoporte.findUniqueOrThrow({ where: { id } }); assert.equal(row.numero, number); assert.equal(row.estado, 'ABIERTO'); assert.equal(row.version, 7); assert.equal(row.responsableId, null);
    assert.equal(await db.eventoSoporte.count({ where: { ticketId: id } }), 6);
  });
  await check('account and actor deletion preserve support history and roll back every dependent record', async () => {
    const password = (await db.usuario.findUniqueOrThrow({ where: { id: fixture.users.generador } })).password;
    const createAccount = async (suffix: string) => {
      const user = await db.usuario.create({ data: { email: 'qa-support-delete-' + suffix + '@night-qa.invalid', nombre: 'QA baja sintética ' + suffix,
        password, rol: 'TRANSPORTISTA', activo: true, emailVerified: true } });
      const actor = await db.transportista.create({ data: { usuarioId: user.id, razonSocial: 'QA sin actividad ' + suffix, cuit: '99-8000000' + suffix + '-0',
        domicilio: 'QA sintético', telefono: '0000000000', email: user.email, numeroHabilitacion: 'QA DELETE ' + suffix } });
      const vehicle = await db.vehiculo.create({ data: { transportistaId: actor.id, patente: 'QAD' + suffix, marca: 'QA', modelo: 'QA', anio: 2026, capacidad: 1, numeroHabilitacion: 'QA', vencimiento: new Date('2030-01-01') } });
      const driver = await db.chofer.create({ data: { transportistaId: actor.id, nombre: 'QA', apellido: 'Sintético', dni: '0000000' + suffix, licencia: 'QA', vencimiento: new Date('2030-01-01'), telefono: '0000000' } });
      return { user, actor, vehicle, driver };
    };
    const retained = await createAccount('1');
    const loginResponse = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '127.10.4.20' }, body: JSON.stringify({ email: retained.user.email, password: 'OnlyLocal-NightQA-2026!' }) });
    assert.equal(loginResponse.status, 200); tokens.retained = (await loginResponse.json()).data.tokens.accessToken;
    const created = await call<{ id: string }>('retained', '/soporte', 'POST', { ...input, asunto: 'QA conservar historia al intentar baja' }, 201, 'http-delete-history-123');
    for (const route of ['/admin/usuarios/' + retained.user.id, '/actores/transportistas/' + retained.actor.id]) {
      await call('admin', route, 'DELETE', undefined, 400);
      assert.ok(await db.usuario.findUnique({ where: { id: retained.user.id } })); assert.ok(await db.transportista.findUnique({ where: { id: retained.actor.id } }));
      assert.ok(await db.vehiculo.findUnique({ where: { id: retained.vehicle.id } })); assert.ok(await db.chofer.findUnique({ where: { id: retained.driver.id } }));
      assert.ok(await db.ticketSoporte.findUnique({ where: { id: created.id } }));
    }
    const free = await createAccount('2');
    await call('admin', '/soporte/equipo/' + free.user.id, 'PATCH', { habilitado: true });
    await call('admin', '/actores/transportistas/' + free.actor.id, 'DELETE');
    assert.equal(await db.usuario.findUnique({ where: { id: free.user.id } }), null);
    assert.equal(await db.transportista.findUnique({ where: { id: free.actor.id } }), null);
    assert.equal(await db.agenteSoporte.findUnique({ where: { usuarioId: free.user.id } }), null);
    const held = await createAccount('3');
    // A deliberate isolated FK after dependent removals proves REAL rollback,
    // not just a mocked transaction or a pre-flight support guard.
    await db.$executeRawUnsafe('CREATE TABLE support_qa_account_hold ("usuarioId" TEXT PRIMARY KEY REFERENCES usuarios(id) ON DELETE RESTRICT)');
    try {
      await db.$executeRaw`INSERT INTO support_qa_account_hold ("usuarioId") VALUES (${held.user.id})`;
      await call('admin', '/actores/transportistas/' + held.actor.id, 'DELETE', undefined, 400);
      assert.ok(await db.usuario.findUnique({ where: { id: held.user.id } })); assert.ok(await db.transportista.findUnique({ where: { id: held.actor.id } }));
      assert.ok(await db.vehiculo.findUnique({ where: { id: held.vehicle.id } })); assert.ok(await db.chofer.findUnique({ where: { id: held.driver.id } }));
    } finally { await db.$executeRawUnsafe('DROP TABLE support_qa_account_hold'); }
  });
} catch (error) { fatal = String(error); throw error; }
finally {
  await db.$disconnect();
  await writeFile(path.join(output, 'support-integration.json'), JSON.stringify({ commit: process.env.GITHUB_SHA, results,
    passed: results.filter(row => row.status === 'PASS').length, failed: results.filter(row => row.status === 'FAIL').length + (fatal && !results.some(row => row.status === 'FAIL') ? 1 : 0), fatal,
    database: fixture.database, port: 55440, compiledApi: true, realLogin: true, externalProvidersDisabled: true }, null, 2));
}
assert.equal(results.length, 12);
