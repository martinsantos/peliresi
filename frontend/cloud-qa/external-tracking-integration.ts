import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient(), base = 'http://127.0.0.1:3037/api';
const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
async function login(role: string) {
  const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: role + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(response.status, 200); return (await response.json()).data.tokens.accessToken as string;
}
async function query(token: string, params: Record<string, string> = {}, status = 200) {
  const response = await fetch(base + '/manifiestos/baja-intensidad/seguimiento?' + new URLSearchParams(params),
    { headers: token ? { Authorization: 'Bearer ' + token } : {} });
  const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body));
  if (status === 200) assert.equal(response.headers.get('cache-control'), 'private, no-store');
  return body.data;
}
try {
  const operator = await login('operador'), other = await login('operador2'), admin = await login('admin');
  const generator = await login('generador'), carrier = await login('transportista'), sector = await login('jefe-operadores');
  const pending = await login('multirol-pending-apk');
  // This fixture is synthetic, read-only in every UI surface, and deliberately
  // includes homonyms, distinct units and an unvalidated identification.
  const identity = 'QA-TRACKING-SHARED';
  const participant = { nombre: 'QA Participante homónimo', identificacion: identity, domicilio: 'QA nube, sin domicilio real' };
  const waste = [{ corriente: 'Y1', cantidad: 2, unidad: 'kg' }, { corriente: 'Y1', cantidad: 3, unidad: 'kg' },
    { corriente: 'Y1', cantidad: 1, unidad: 'l' }, { corriente: 'Y2', cantidad: 4, unidad: 'kg' }];
  // Each record is created by the account of its own operator, as the API does.
  async function seed(generador: object, transportista: object, operadorId = fixture.actors.operador, creadoPorId = fixture.users.operador) {
    const id = randomUUID();
    await db.registroManifiestoExcepcional.create({ data: { id, operadorId, creadoPorId,
      huellaSolicitud: id, datos: { id, generador, transportista, patente: 'QA-TRACK', motivo: 'QA seguimiento aislado', residuos: waste }, eventos: [] } });
    return id;
  }
  const ids: string[] = [];
  for (let i = 0; i < 21; i++) ids.push(await seed(participant, { ...participant, identificacion: 'QA-OTHER-CARRIER' }));
  await seed({ ...participant, identificacion: 'QA-DIFFERENT-ID' }, participant);
  await seed({ ...participant, padronId: fixture.actors.generador }, { ...participant, padronId: fixture.actors.transportista });
  await seed(participant, participant, fixture.actors.operador2, fixture.users.operador2);
  // Spec v2: a generator-created eventual with an external operator and the shared carrier identity.
  const fromGenerator = randomUUID();
  await db.registroManifiestoExcepcional.create({ data: { id: fromGenerator, operadorId: null, creadoPorId: fixture.users.generador,
    autorRol: 'GENERADOR', autorActorId: fixture.actors.generador, huellaSolicitud: fromGenerator, eventos: [],
    datos: { id: fromGenerator, generador: { ...participant, padronId: fixture.actors.generador }, transportista: participant,
      operador: { nombre: 'QA planta sin alta', identificacion: 'QA-TRACK-OPERATOR', domicilio: '' },
      patente: 'QA-TRACK', motivo: 'QA seguimiento aislado', residuos: waste } } });
  const anonymous = await Promise.all([1, 2].map(() => seed({ nombre: '', identificacion: '', domicilio: '' }, { nombre: '', identificacion: '', domicilio: '' })));
  const snapshot = async () => ({
    records: await db.registroManifiestoExcepcional.findMany({ orderBy: { id: 'asc' } }),
    manifests: await db.manifiesto.findMany({ orderBy: { id: 'asc' }, include: { residuos: true, eventos: true } }),
    users: await db.usuario.count(), notifications: await db.notificacion.count(),
  });
  const before = await snapshot();
  const filter = { identificacion: identity };
  const first = await query(operator, filter), second = await query(operator, { ...filter, page: '2' });
  assert.equal(first.total, 21); assert.equal(first.registros.length, 20); assert.equal(second.registros.length, 1);
  assert.deepEqual(new Set([...first.registros, ...second.registros].map(r => r.id)), new Set(ids));
  assert.deepEqual(first.cantidades, [
    { corriente: 'Y1', unidad: 'kg', cantidad: '105' }, { corriente: 'Y1', unidad: 'l', cantidad: '21' },
    { corriente: 'Y2', unidad: 'kg', cantidad: '84' },
  ]);
  assert.deepEqual(second.cantidades, first.cantidades); assert.equal(second.total, 21);
  assert.ok(first.primera && first.ultima && first.registros.every(r => r.operador && r.participante.identificacion === identity));
  assert.equal((await query(operator, { ...filter, rol: 'transportista' })).total, 1);
  assert.equal((await query(other, filter)).total, 1); assert.equal((await query(admin, filter)).total, 22);
  assert.equal((await query(operator, { identificacion: "' OR 1=1 --" })).total, 0);
  assert.equal((await query(operator, { identificacion: identity.toLowerCase() })).total, 0);
  const all = await query(operator);
  const allRows = [...all.registros, ...(await query(operator, { page: '2' })).registros];
  assert.ok(anonymous.every(id => allRows.some(r => r.id === id)), 'unknown identities remain distinct movements');
  // Spec v2 §5 (B): creator and registered parties read tracking of their own records only.
  assert.equal((await query(generator, filter)).total, 0, 'generator is registered there, never external');
  const generatorCarrier = await query(generator, { ...filter, rol: 'transportista' });
  assert.equal(generatorCarrier.total, 1); assert.equal(generatorCarrier.registros[0].id, fromGenerator);
  assert.equal(generatorCarrier.registros[0].operador, 'QA planta sin alta');
  assert.equal((await query(generator, { rol: 'operador', identificacion: 'QA-TRACK-OPERATOR' })).total, 1);
  assert.equal((await query(operator, { rol: 'operador', identificacion: 'QA-TRACK-OPERATOR' })).total, 0);
  assert.equal((await query(admin, { rol: 'operador', identificacion: 'QA-TRACK-OPERATOR' })).total, 1);
  assert.equal((await query(admin, { ...filter, rol: 'transportista' })).total, 3);
  for (const token of [carrier]) assert.equal((await query(token, { ...filter, rol: 'transportista' })).total, 0);
  await query(sector, {}, 403);
  await query(pending, {}, 403);
  await query('', {}, 401);
  await query(operator, { operadorId: fixture.actors.operador2 }, 400);
  await query(operator, { page: '0' }, 400);
  assert.deepEqual(await snapshot(), before, 'tracking cannot change records, users, history or notices');
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'external-tracking-http.json'), JSON.stringify({ passed: true, cases: [
    '21 movements across two pages with whole-result totals', 'distinct roles, waste types and units',
    'homonyms not merged; unknown identities preserved; registered participants excluded',
    'operator scope, reviewer overview and unauthorized roles denied', 'creator and registered parties see only their own records; external operator tracked', 'exact identifier and SQL literal safety',
    'all records, manifests, users and notices unchanged by read-only queries',
  ] }, null, 2));
} finally { await db.$disconnect(); }
