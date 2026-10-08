import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';

// Actual seed function, with in-memory payloads only. No DB/server/producers.
const source = process.env.QA_SEED_BASELINE === '1'
  ? execFileSync('git', ['show', '436d830ce3d38beff230719e799d4ed6af8371b4:frontend/cloud-qa/multiuser.ts'], { cwd: new URL('../../', import.meta.url), encoding: 'utf8' })
  : readFileSync(new URL('./multiuser.ts', import.meta.url), 'utf8');
const compiler = createRequire(import.meta.url)('../node_modules/typescript');
const begin = source.indexOf('async function seedUsers()'), end = source.indexOf('\nasync function files(', begin);
assert.ok(begin > 0 && end > begin);
async function payloads() {
  const users: any[] = [], records: Record<string, any[]> = { usuario: [], generador: [], transportista: [], operador: [] };
  const database = Object.fromEntries(Object.keys(records).map(model => [model, { create: async ({ data }: any) => {
    records[model].push(data); return { ...data, id: model + '-' + records[model].length };
  } }]));
  const bindings = { db: database, users, password: 'synthetic only', path, output: '/synthetic',
    backendRequire: (name: string) => { assert.equal(name, 'bcryptjs'); return { hash: async () => 'synthetic bcrypt placeholder' }; },
    readFile: async (file: string) => { assert.equal(file, '/synthetic/fixture.json'); return JSON.stringify({ wastes: ['synthetic-authorized-waste'] }); }, assert };
  const seed = vm.compileFunction(compiler.transpile(source.slice(begin, end) + '\nreturn seedUsers;', { target: compiler.ScriptTarget.ES2022 }), Object.keys(bindings))(...Object.values(bindings));
  await seed(); return { users, records };
}
test('50 distinct synthetic users cover five groups, with ten inspector flags and external notices off', async () => {
  const { users, records } = await payloads();
  assert.equal(users.length, 50); assert.equal(new Set(users.map(user => user.id)).size, 50);
  assert.equal(new Set(records.usuario.map(user => user.email)).size, 50);
  for (let group = 0; group < 5; group++) assert.equal(users.filter(user => user.group === group).length, 10);
  assert.equal(records.usuario.filter(user => user.esInspector).length, 10);
  assert.ok(records.usuario.every(user => user.activo && user.emailVerified && !user.notifEmail && !user.notifWhatsapp && !user.notifTelegram && user.email.endsWith('@night-qa.invalid')));
  for (const model of ['generador', 'transportista', 'operador']) {
    assert.equal(records[model].length, 10);
    assert.ok(records[model].every(actor => records.usuario.some((_, index) => actor.usuarioId === 'usuario-' + (index + 1))));
  }
});
test('each synthetic fixed operator is actually authorised for the waste used in its manifest', async () => {
  const { records } = await payloads();
  for (const operator of records.operador) {
    assert.deepEqual(operator.modalidades, ['FIJO']);
    assert.ok(operator.vencimientoHabilitacion > new Date('2026-10-08'));
    assert.equal(operator.tratamientos?.create?.tipoResiduoId, 'synthetic-authorized-waste');
    assert.equal(operator.tratamientos.create.activo, true);
    assert.ok(operator.tratamientos.create.metodo.includes('QA'));
  }
});
