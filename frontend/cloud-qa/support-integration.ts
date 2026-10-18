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
async function call<T>(who: string | null, route: string, method = 'GET', body?: unknown, expected = 200, key?: string, clientIp?: string) {
  const response = await fetch(base + route, { method, headers: {
    ...(who ? { Authorization: 'Bearer ' + tokens[who] } : {}),
    ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(key ? { 'Idempotency-Key': key } : {}),
    ...(clientIp ? { 'X-Forwarded-For': clientIp } : {}),
  }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  if (response.status !== expected) {
    const diagnostic = await response.clone().json().catch(() => ({ message: 'Non-JSON response' })) as { message?: unknown };
    assert.equal(response.status, expected, method + ' ' + route + ' · ' + String(diagnostic.message || '').slice(0, 180));
  }
  const result = await response.json() as { success: boolean; data: T };
  assert.equal(result.success, expected < 400); if (expected >= 400) assert.equal(result.data, undefined);
  return result.data;
}
async function check(name: string, task: () => Promise<void>) {
  try { await task(); results.push({ name, status: 'PASS' }); }
  catch (error) { results.push({ name, status: 'FAIL', error: String(error) }); throw error; }
}
try {
  for (const [index, who] of ['admin', 'generador', 'generador2', 'transportista', 'transportista2', 'operador', 'operador2', 'inspector', 'lector-generadores', 'lector-transporte', 'lector-operadores'].entries()) {
    const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '127.10.4.' + (index + 1) },
      body: JSON.stringify({ email: who + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
    assert.equal(response.status, 200);
    const login = await response.json() as { data: { tokens: { accessToken: string }; user: { id: string } } };
    assert.equal(login.data.user.id, fixture.users[who]); tokens[who] = login.data.tokens.accessToken;
  }
  await check('unaltered additive migration executes on PostgreSQL without changing existing users', async () => {
    const migration = await readFile(path.join(root, 'backend/prisma/migrations/20261006010000_native_support/migration.sql'), 'utf8');
    const upgrade = await readFile(path.join(root, 'backend/prisma/migrations/20261007010000_support_triage_identity/migration.sql'), 'utf8');
    const sql = 'BEGIN; CREATE SCHEMA support_migration_check; SET LOCAL search_path TO support_migration_check; CREATE TABLE usuarios(id TEXT PRIMARY KEY);\n' + migration + `
      INSERT INTO usuarios(id) VALUES ('retained-owner');
      INSERT INTO tickets_soporte(id,"autorId",asunto,contexto,"clienteId",huella,"updatedAt") VALUES ('retained-ticket','retained-owner','Original retained','{}','original-key','hash',now());
      ` + upgrade + `
      DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM tickets_soporte WHERE id='retained-ticket' AND numero=1 AND "autorId"='retained-owner' AND estado='ABIERTO' AND tipo IS NULL AND prioridad='NORMAL') THEN RAISE EXCEPTION 'Upgrade changed existing ticket'; END IF; END $$;
      ROLLBACK;`;
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
  await check('eleven real account logins keep owned tickets isolated across actors, inspectors and sector administrators', async () => {
    for (const who of ['transportista', 'operador', 'inspector', 'lector-generadores', 'lector-transporte', 'lector-operadores']) {
      const own = await call<{ id: string }>(who, '/soporte', 'POST', { ...input, asunto: 'QA propiedad ' + who }, 201, 'matrix-owner-' + who);
      const detail = await call<Ticket & { autorId: string; puedeGestionar: boolean }>(who, '/soporte/' + own.id);
      assert.equal(detail.autorId, fixture.users[who]); assert.equal(detail.puedeGestionar, false);
      await call(who, '/soporte/' + id, 'GET', undefined, 404);
      await call(who, '/soporte/' + own.id + '/acciones', 'POST', { accion: 'CLASIFICAR', version: 1, cuerpo: 'Intento de triaje no autorizado.', categoria: 'QR', tipo: 'PROBLEMA', prioridad: 'ALTA' }, 403, 'matrix-triage-' + who);
    }
  });
  await check('twenty concurrent reports receive unique increasing references without renumbering or cross-user ownership', async () => {
    const who = ['transportista2', 'generador2', 'operador', 'inspector'];
    const created = await Promise.all(Array.from({ length: 20 }, (_, index) => call<{ id: string; referencia: string }>(who[index % who.length], '/soporte', 'POST',
      { ...input, asunto: 'QA correlativo concurrente ' + index }, 201, 'parallel-reference-' + index)));
    assert.equal(new Set(created.map(row => row.id)).size, 20); assert.equal(new Set(created.map(row => row.referencia)).size, 20);
    const numbers = created.map(row => Number(row.referencia.replace('SOP-', ''))).sort((a, b) => a - b);
    for (let index = 1; index < numbers.length; index++) assert.equal(numbers[index], numbers[index - 1] + 1);
    for (let index = 0; index < created.length; index++) assert.equal((await db.ticketSoporte.findUniqueOrThrow({ where: { id: created[index].id } })).autorId, fixture.users[who[index % who.length]]);
  });
  let proxyId = '';
  await check('signed impersonation and renewal record the real administrator but deliver the ticket to the represented user', async () => {
    const impersonation = await call<{ tokens: { accessToken: string; refreshToken: string } }>('admin', '/admin/impersonate/' + fixture.users.generador2, 'POST');
    const renewed = await call<{ accessToken: string; refreshToken: string }>(null, '/auth/refresh-token', 'POST', { refreshToken: impersonation.tokens.refreshToken });
    tokens.proxy = renewed.accessToken;
    tokens.proxyRefresh = renewed.refreshToken;
    const created = await call<{ id: string }>('proxy', '/soporte', 'POST', { ...input, asunto: 'QA reporte durante impersonación' }, 201, 'proxy-create-123'); proxyId = created.id;
    const row = await db.ticketSoporte.findUniqueOrThrow({ where: { id: proxyId } });
    assert.equal(row.autorId, fixture.users.generador2); assert.equal(row.registradoPorId, fixture.users.admin);
    assert.equal((await db.mensajeSoporte.findFirstOrThrow({ where: { ticketId: proxyId } })).autorId, fixture.users.admin);
    const notice = await db.notificacion.findFirstOrThrow({ where: { usuarioId: fixture.users.generador2, datos: { contains: proxyId } } });
    assert.equal(notice.titulo, 'Ticket registrado a tu nombre'); assert.equal(JSON.parse(notice.datos).ruta, '/soporte/' + proxyId);
    assert.equal((await call<Ticket>('generador2', '/soporte/' + proxyId)).id, proxyId);
  });
  await check('signed operator identity does not grant administrator rights to the represented account', async () => {
    await call('proxy', '/soporte?scope=mesa', 'GET', undefined, 403);
    await call('proxy', '/soporte/equipo', 'GET', undefined, 403);
    await call('proxy', '/admin/impersonate/' + fixture.users.operador, 'POST', undefined, 403);
    await call('proxy', '/soporte', 'POST', { ...input, registradoPorId: fixture.users.admin }, 400, 'forge-proxy-id-123');
    await db.usuario.update({ where: { id: fixture.users.admin }, data: { activo: false } });
    try {
      await call('proxy', '/soporte/acceso', 'GET', undefined, 401);
      await call(null, '/auth/refresh-token', 'POST', { refreshToken: tokens.proxyRefresh }, 401);
    } finally { await db.usuario.update({ where: { id: fixture.users.admin }, data: { activo: true } }); }
  });
  await check('triage filters persist a private audit while leaving ticket state unchanged even after closure', async () => {
    const triage = { accion: 'CLASIFICAR', version: 1, cuerpo: 'QA diagnóstico interno reservado.', categoria: 'QR', tipo: 'PROBLEMA', prioridad: 'ALTA' };
    await call('admin', '/soporte/' + proxyId + '/acciones', 'POST', triage, 200, 'triage-proxy-123');
    const own = await call<Ticket & { tipo: string; prioridad: string; eventos: unknown[] }>('generador2', '/soporte/' + proxyId);
    assert.equal(own.estado, 'ABIERTO'); assert.equal(own.tipo, 'PROBLEMA'); assert.equal(own.prioridad, 'ALTA'); assert.equal(own.mensajes.length, 1); assert.equal(own.eventos.length, 0);
    const desk = await call<{ items: Array<{ id: string }> }>('admin', '/soporte?scope=mesa&tipo=PROBLEMA&prioridad=ALTA&clasificado=si');
    assert.ok(desk.items.some(row => row.id === proxyId));
    await call('admin', '/soporte/' + proxyId + '/acciones', 'POST', { accion: 'CERRAR', version: 2, cuerpo: 'QA cierre con resolución visible.' }, 200, 'triage-close-123');
    const closed = await db.ticketSoporte.findUniqueOrThrow({ where: { id: proxyId } });
    await call('admin', '/soporte/' + proxyId + '/acciones', 'POST', { ...triage, version: 3, tipo: 'CONSULTA' }, 200, 'triage-closed-123');
    const after = await db.ticketSoporte.findUniqueOrThrow({ where: { id: proxyId } }); assert.equal(after.estado, 'CERRADO'); assert.equal(after.cerradoAt?.toISOString(), closed.cerradoAt?.toISOString());
    const exact = await call<{ items: Array<{ id: string }> }>('generador2', '/soporte?search=SOP-' + String(after.numero).padStart(6, '0'));
    assert.deepEqual(exact.items.map(row => row.id), [proxyId]);
  });
  await check('audio attachments are private authenticated files delivered unchanged with the public response', async () => {
    const audio = Buffer.alloc(48); audio.write('RIFF', 0); audio.writeUInt32LE(40, 4); audio.write('WAVEfmt ', 8); audio.writeUInt32LE(16, 16);
    audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22); audio.writeUInt32LE(8000, 24); audio.writeUInt32LE(16000, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34); audio.write('data', 36); audio.writeUInt32LE(4, 40);
    const version = (await db.ticketSoporte.findUniqueOrThrow({ where: { id } })).version;
    const form = new FormData(); form.append('accion', 'RESPONDER'); form.append('version', String(version)); form.append('cuerpo', 'QA respuesta pública con audio.');
    form.append('files', new Blob([audio], { type: 'audio/wav' }), 'qa-voice.wav');
    await call('admin', '/soporte/' + id + '/acciones', 'POST', form, 200, 'audio-response-123');
    const own = await call<Ticket>('generador', '/soporte/' + id); const file = own.mensajes.at(-1)!.adjuntos[0];
    const downloaded = await fetch(base + '/soporte/' + id + '/adjuntos/' + file.id, { headers: { Authorization: 'Bearer ' + tokens.generador } });
    assert.equal(downloaded.status, 200); assert.match(downloaded.headers.get('content-type')!, /^audio\/wav/); assert.equal(downloaded.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), audio);
    await call('generador2', '/soporte/' + id + '/adjuntos/' + file.id, 'GET', undefined, 404);
    await call(null, '/soporte/' + id + '/adjuntos/' + file.id, 'GET', undefined, 401);
    assert.ok(await db.notificacion.findFirst({ where: { usuarioId: fixture.users.generador, datos: { contains: id } } }));
  });
  await check('staff handoff history carries the exact from and to identities without leaking its private reason', async () => {
    const detail = await call<Ticket & { eventos: Array<{ accion: string; detalle?: { desde: string; hacia: string } }> }>('admin', '/soporte/' + id);
    const handoff = detail.eventos.find(row => row.accion === 'DERIVAR'); assert.equal(handoff?.detalle?.hacia, 'QA operador2'); assert.equal(handoff?.detalle?.desde, 'QA admin');
    const own = await call<Ticket>('generador', '/soporte/' + id); assert.ok(own.mensajes.every(row => !row.cuerpo.includes('motivo interno')));
  });
  await check('the thirty-write account allowance survives shared NAT while still blocking the same account on its thirty-first write', async () => {
    // The other HTTP suites share loopback and may consume the global IP
    // allowance. This scenario gets ONE fresh synthetic NAT shared by BOTH
    // accounts, preserving the global limiter and the per-account 30 limit.
    const nat = '127.10.40.1';
    const password = (await db.usuario.findUniqueOrThrow({ where: { id: fixture.users.generador } })).password;
    const throttle = await db.usuario.create({ data: { email: 'qa-support-throttle@night-qa.invalid', nombre: 'QA límite soporte', rol: 'GENERADOR', activo: true, emailVerified: true, password } });
    const signed = await call<{ tokens: { accessToken: string } }>(null, '/auth/login', 'POST', { email: throttle.email, password: 'OnlyLocal-NightQA-2026!' }, 200, undefined, nat); tokens.throttle = signed.tokens.accessToken;
    for (let index = 0; index < 30; index++) await call('throttle', '/soporte', 'POST', { asunto: '' }, 400, 'throttle-key-' + index, nat);
    await call('throttle', '/soporte', 'POST', { asunto: '' }, 429, 'throttle-over-123', nat);
    await call('lector-operadores', '/soporte', 'POST', { asunto: '' }, 400, 'other-after-throttle-123', nat);
    assert.equal(await db.ticketSoporte.count({ where: { autorId: throttle.id } }), 0);
  });
} catch (error) { fatal = String(error); throw error; }
finally {
  await db.$disconnect();
  await writeFile(path.join(output, 'support-integration.json'), JSON.stringify({ commit: process.env.GITHUB_SHA, results,
    passed: results.filter(row => row.status === 'PASS').length, failed: results.filter(row => row.status === 'FAIL').length + (fatal && !results.some(row => row.status === 'FAIL') ? 1 : 0), fatal,
    database: fixture.database, port: 55440, compiledApi: true, realLogin: true, externalProvidersDisabled: true }, null, 2));
}
assert.equal(results.length, 20);
