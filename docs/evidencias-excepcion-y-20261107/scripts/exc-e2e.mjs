// End-to-end (API) of the generator Y-exception rule on the isolated preview, artificial accounts only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const X = '/qa/excepcion-y-20261107';
const API = 'http://127.0.0.1:3053';
const fixture = JSON.parse(fs.readFileSync('/qa/inspection-intake-chief-20261105/fixture.json', 'utf8'));
assert.ok(fixture.synthetic && Object.values(fixture.users).every(u => u.email.endsWith('@example.invalid')));
const pid = fs.readFileSync(X + '/api.pid', 'utf8').trim();
assert.equal(fs.readlinkSync('/proc/' + pid + '/cwd'), X + '/backend');
const env = Object.fromEntries(fs.readFileSync('/proc/' + pid + '/environ', 'utf8').split('\0').filter(Boolean).map(kv => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]));
for (const [k, v] of Object.entries({ PORT: '3053', DISABLE_EMAILS: 'true', PUSH_MANIFEST_NOTICES_ENABLED: 'false', SITREP_PAUSE_BACKGROUND_JOBS: 'true', GENERATOR_Y_EXCEPTIONS_ENABLED: 'true' })) assert.equal(env[k], v, k);
assert.ok(Date.parse(env.TRAINING_DIRECT_LOGIN_UNTIL) < Date.now());
assert.match(env.DATABASE_URL, /127\.0\.0\.1:55441\/sitrep_ephemeral_qa_1a93\?schema=inspection_field_20261103/);
const req = createRequire(X + '/backend/package.json');
const db = new (req('@prisma/client').PrismaClient)({ datasources: { db: { url: env.DATABASE_URL.replace(/&connection_limit=\d+/, '') + '&connection_limit=1' } } });
const sharp = req('sharp');
const sentBefore = await db.emailQueue.count({ where: { estado: 'ENVIADO' } });

const H = { 'x-sitrep-synthetic-preview': '1' };
async function login(email) { const r = await fetch(API + '/api/auth/login', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: fixture.password }) }); const j = await r.json(); assert.equal(r.status, 200, email + ' ' + j.message); return j.data.tokens.accessToken; }
async function call(t, method, path, body) { const r = await fetch(API + path, { method, headers: { ...H, authorization: 'Bearer ' + t, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); const type = r.headers.get('content-type') || ''; return { status: r.status, body: type.includes('json') ? await r.json() : {} }; }
const log = [];
const step = (name, data) => { log.push({ name, ...data }); console.log(name.padEnd(46), JSON.stringify(data).slice(0, 330)); };
const expectStatus = (r, code, name) => { step(name, { status: r.status, message: r.body?.message }); assert.equal(r.status, code, name + ': ' + JSON.stringify(r.body).slice(0, 300)); return r.body?.data; };

const [gen, carrier, oper, sector] = [await login(fixture.users.generator.email), await login(fixture.users.carrier.email), await login(fixture.users.operator.email), await login(fixture.users.sector.email)];
const g = fixture.actors.generator, c = fixture.actors.carrier, o = fixture.actors.operator;
const original = (await db.generador.findUniqueOrThrow({ where: { id: g.id }, select: { corrientesControl: true } })).corrientesControl;
// Preview-only artificial catalogue (idempotent): three Y streams the practice operator may treat.
for (const codigo of ['Y8', 'Y12', 'Y34']) {
  const tipo = await db.tipoResiduo.upsert({ where: { codigo }, update: {}, create: { codigo, nombre: 'Corriente de práctica ' + codigo, categoria: 'QA', peligrosidad: 'QA', descripcion: 'Catálogo artificial de preview' } });
  await db.tratamientoAutorizado.upsert({ where: { operadorId_tipoResiduoId_metodo: { operadorId: o.id, tipoResiduoId: tipo.id, metodo: 'QA-PRACTICA' } }, update: { activo: true }, create: { operadorId: o.id, tipoResiduoId: tipo.id, metodo: 'QA-PRACTICA', descripcion: 'Tratamiento artificial de preview' } });
}
const supported = await db.tratamientoAutorizado.findMany({ where: { operadorId: o.id, activo: true }, select: { tipoResiduoId: true, tipoResiduo: { select: { codigo: true } } } });
const types = ['Y8', 'Y34', 'Y12'].map(code => [code, supported.find(s => s.tipoResiduo.codigo === code)?.tipoResiduoId]).filter(([, id]) => id);
assert.ok(types.length >= 3, 'el operador artificial necesita al menos tres corrientes Y habilitadas');
const [[A, idA], [U1, idU1], [U2, idU2]] = types;
const raw = Buffer.alloc(300 * 100 * 3, 255); for (let x = 20; x < 280; x++) for (let y = 48; y < 52; y++) raw.fill(0, (y * 300 + x) * 3, (y * 300 + x) * 3 + 3);
const firma = 'data:image/png;base64,' + (await sharp(raw, { raw: { width: 300, height: 100, channels: 3 } }).png().toBuffer()).toString('base64');
const date = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
const propose = (typeId) => call(gen, 'POST', '/api/manifiestos', { idempotencyKey: randomUUID(), transportistaId: c.id, operadorId: o.id, modalidad: 'FIJO', fechaEstimadaRetiro: date, residuos: [{ tipoResiduoId: typeId, cantidad: 5, unidad: 'kg' }] });
const approveAll = async (id, label) => {
  expectStatus(await call(gen, 'POST', `/api/manifiestos/${id}/firmar`, { firma }), 200, label + ' · generador firma');
  expectStatus(await call(carrier, 'POST', `/api/manifiestos/${id}/aprobar-parte`, {}), 200, label + ' · transporte aprueba');
  return expectStatus(await call(oper, 'POST', `/api/manifiestos/${id}/aprobar-parte`, {}), 200, label + ' · operador aprueba');
};

try {
  // Clean starting point for the artificial generator: ficha = A only, no open exception.
  await db.generador.update({ where: { id: g.id }, data: { corrientesControl: A } });
  await db.excepcionCorrienteGenerador.updateMany({ where: { generadorId: g.id, cerradaAt: null }, data: { cerradaAt: new Date(), cierre: { motivo: 'REINICIO_QA', fuente: 'CONTROL' } } });
  step('punto de partida', { ficha: A, noInscriptas: [U1, U2] });

  // 1. Authorized current: unchanged three-party flow.
  const m1 = expectStatus(await propose(idA), 201, '1. manifiesto con ' + A + ' (inscripta)').manifiesto;
  expectStatus(await call(gen, 'GET', `/api/manifiestos/${m1.id}/excepcion-corriente`), 200, '1. estado').estado === 'AUTORIZADAS' || assert.fail('estado');
  const a1 = await approveAll(m1.id, '1');
  assert.equal(a1.manifiesto.estado, 'APROBADO');

  // 2. First Y outside the ficha: created, but no party approves until the authority grants.
  const m2 = expectStatus(await propose(idU1), 201, '2. manifiesto con ' + U1 + ' (no inscripta)').manifiesto;
  const s2 = expectStatus(await call(gen, 'GET', `/api/manifiestos/${m2.id}/excepcion-corriente`), 200, '2. estado para el generador');
  assert.equal(s2.estado, 'REQUIERE_EXCEPCION'); assert.equal(s2.puedeOtorgar, false);
  expectStatus(await call(gen, 'POST', `/api/manifiestos/${m2.id}/firmar`, { firma }), 409, '2. generador firma antes de la excepción');
  expectStatus(await call(carrier, 'POST', `/api/manifiestos/${m2.id}/aprobar-parte`, {}), 409, '2. transporte aprueba antes de la excepción');
  expectStatus(await call(gen, 'POST', `/api/manifiestos/${m2.id}/excepcion-corriente`, { motivo: 'El generador intenta otorgarse la excepción' }), 403, '2. el generador intenta otorgarla');
  expectStatus(await call(carrier, 'POST', `/api/manifiestos/${m2.id}/excepcion-corriente`, { motivo: 'La contraparte intenta otorgar la excepción' }), 403, '2. la contraparte intenta otorgarla');
  assert.equal(expectStatus(await call(sector, 'GET', `/api/manifiestos/${m2.id}/excepcion-corriente`), 200, '2. estado para la autoridad').puedeOtorgar, true);
  const grantBody = { motivo: 'Excepción única: generación puntual verificada por la autoridad' };
  const e2 = expectStatus(await call(sector, 'POST', `/api/manifiestos/${m2.id}/excepcion-corriente`, grantBody), 201, '2. la autoridad otorga la excepción').excepcion;
  const e2again = expectStatus(await call(sector, 'POST', `/api/manifiestos/${m2.id}/excepcion-corriente`, grantBody), 201, '2. reintento del otorgamiento');
  assert.equal(e2again.excepcion.id, e2.id);
  assert.equal((await approveAll(m2.id, '2')).manifiesto.estado, 'APROBADO');
  assert.equal(await db.excepcionCorrienteGenerador.count({ where: { generadorId: g.id, cerradaAt: null } }), 1);

  // 3. With that exception open: a different Y, and the same Y again, cannot even be created.
  expectStatus(await propose(idU2), 409, '3. otra Y no inscripta (' + U2 + ') con excepción abierta');
  expectStatus(await propose(idU1), 409, '3. la misma Y (' + U1 + ') en otro manifiesto');
  const urgent = await db.notificacion.count({ where: { prioridad: 'URGENTE', datos: { contains: 'CREACION_BLOQUEADA' } } });
  step('3. alerta URGENTE a la autoridad', { alertas: urgent });
  assert.ok(urgent >= 1);

  // 4. Reception finding on an approved manifest: a new Y while one is open is refused to everyone.
  const ad = randomUUID();
  expectStatus(await call(carrier, 'POST', `/api/manifiestos/${m1.id}/adendas`, { id: ad, motivo: 'Se observó otra corriente al retirar', residuos: [{ corriente: A, cantidad: 5, unidad: 'kg' }, { corriente: U2, cantidad: 1, unidad: 'kg' }] }), 201, '4. adenda con ' + U2 + ' (excepción abierta)');
  expectStatus(await call(sector, 'POST', `/api/manifiestos/${m1.id}/adendas/${ad}/revisiones`, { id: randomUUID(), version: 0, nota: 'Intento de aprobar con excepción abierta', decision: 'APROBADA' }), 409, '4. la autoridad intenta aprobarla');
  const observed = expectStatus(await call(sector, 'POST', `/api/manifiestos/${m1.id}/adendas/${ad}/revisiones`, { id: randomUUID(), version: 0, nota: 'Se requiere el alta de la corriente', decision: 'OBSERVADA' }), 200, '4. observarla sigue permitido');
  assert.equal(observed.adenda.estadoRevision, 'OBSERVADA');

  // 5. Alta of U1 in the ficha closes the exception (history kept): the generator has its exception available again.
  expectStatus(await call(sector, 'PUT', `/api/actores/generadores/${g.id}`, { corrientesControl: A + ', ' + U1 }), 200, '5. alta de ' + U1 + ' en la ficha');
  const closed = await db.excepcionCorrienteGenerador.findUniqueOrThrow({ where: { id: e2.id } });
  step('5. excepción cerrada por alta', { cerradaAt: !!closed.cerradaAt, cierre: closed.cierre?.motivo });
  assert.ok(closed.cerradaAt);

  // 6. A rectification of the finding: the counterpart cannot grant; the authority can, using the single exception.
  const ad2 = randomUUID();
  expectStatus(await call(carrier, 'POST', `/api/manifiestos/${m1.id}/adendas`, { id: ad2, rectificaId: ad, motivo: 'Rectificación con la corriente observada', residuos: [{ corriente: A, cantidad: 5, unidad: 'kg' }, { corriente: U2, cantidad: 1, unidad: 'kg' }] }), 201, '6. rectificación con ' + U2);
  expectStatus(await call(oper, 'POST', `/api/manifiestos/${m1.id}/adendas/${ad2}/revisiones`, { id: randomUUID(), version: 0, nota: 'Conforme como contraparte', decision: 'APROBADA' }), 409, '6. la contraparte intenta aprobar');
  expectStatus(await call(sector, 'POST', `/api/manifiestos/${m1.id}/adendas/${ad2}/revisiones`, { id: randomUUID(), version: 0, nota: 'Excepción por hallazgo verificado', decision: 'APROBADA' }), 200, '6. la autoridad aprueba y otorga');

  // 7. Generator history, as seen by the generator itself.
  const h = expectStatus(await call(gen, 'GET', `/api/actores/generadores/${g.id}/excepciones-corriente`), 200, '7. historial del generador');
  step('7. historial', { ficha: h.fichaCorrientes, disponible: h.disponible, excepciones: h.excepciones.map(e => `${e.origen}:${e.corrientes.join('+')}:${e.estado}`) });
  assert.deepEqual(h.excepciones.filter(e => [e2.id].includes(e.id)).map(e => e.estado), ['CERRADA']);
  assert.equal(h.disponible, false);
  expectStatus(await call(carrier, 'GET', `/api/actores/generadores/${g.id}/excepciones-corriente`), 404, '7. otro actor no ve el historial');

  const notices = await db.notificacion.findMany({ where: { datos: { contains: 'excepcion_corriente_generador' } }, select: { datos: true } });
  const withMail = notices.filter(n => JSON.parse(n.datos).correoVersion !== undefined).length;
  const intake = await db.antecedenteFiscalizacion.findFirst({ where: { origenId: ad }, select: { motivos: true } });
  step('8. avisos y antecedentes', { avisos: notices.length, conCorreo: withMail, motivosAntecedenteAdenda: intake?.motivos || null });
  assert.equal(withMail, 0);
} finally {
  // Leave the artificial generator as found: original ficha; any exception left open is closed as QA cleanup.
  await db.generador.update({ where: { id: g.id }, data: { corrientesControl: original } });
  await db.excepcionCorrienteGenerador.updateMany({ where: { generadorId: g.id, cerradaAt: null }, data: { cerradaAt: new Date(), cierre: { motivo: 'FIN_QA', fuente: 'CONTROL' } } });
  const sentAfter = await db.emailQueue.count({ where: { estado: 'ENVIADO' } });
  fs.writeFileSync(X + '/e2e-excepcion.json', JSON.stringify({ log, sentBefore, sentAfter }, null, 2));
  console.log('correos enviados antes/después', sentBefore, sentAfter);
  await db.$disconnect();
}
