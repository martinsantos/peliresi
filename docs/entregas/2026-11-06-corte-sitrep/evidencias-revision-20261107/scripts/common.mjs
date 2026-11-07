// Shared guard for the review lab. Refuses to run unless every outbound
// channel is off and the API/DB are the isolated preview ones.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

export const LAB = '/qa/alta-ocr-correcciones-20261106';
export const OUT = '/qa/revision-20261107';
// TARGET=rev -> review API 3052 (this branch); default -> cut API 3051.
const REV = process.env.TARGET === 'rev';
const PORT = REV ? '3052' : '3051';
const PIDFILE = REV ? OUT + '/api.pid' : LAB + '/relink-api.pid';
const BACKEND = REV ? OUT + '/backend' : LAB + '/backend';
export const API = 'http://127.0.0.1:' + PORT;
export const fixture = JSON.parse(fs.readFileSync('/qa/inspection-intake-chief-20261105/fixture.json', 'utf8'));
export const cases = JSON.parse(fs.readFileSync(LAB + '/agenda-seis-evidence/agenda.json', 'utf8')).casos;

export async function guard() {
  assert.ok(fixture.synthetic);
  for (const u of Object.values(fixture.users)) assert.ok(u.email.endsWith('@example.invalid'));
  const pid = fs.readFileSync(PIDFILE, 'utf8').trim();
  assert.equal(fs.readlinkSync('/proc/' + pid + '/cwd'), BACKEND);
  const env = Object.fromEntries(fs.readFileSync('/proc/' + pid + '/environ', 'utf8').split('\0').filter(Boolean)
    .map(kv => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]));
  assert.equal(env.PORT, PORT);
  console.log('target', API, BACKEND);
  assert.equal(env.DISABLE_EMAILS, 'true');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.INSPECTION_ACT_MAIL_ENABLED, 'false');
  assert.equal(env.SITREP_PAUSE_BACKGROUND_JOBS, 'true');
  assert.ok(Date.parse(env.TRAINING_DIRECT_LOGIN_UNTIL) < Date.now(), 'CAP must be closed');
  assert.match(env.DATABASE_URL, /127\.0\.0\.1:55441\/sitrep_ephemeral_qa_1a93\?schema=inspection_field_20261103/);
  const { PrismaClient } = createRequire(LAB + '/backend/package.json')('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  const [where] = await db.$queryRaw`SELECT current_database() AS name, current_schema() AS schema`;
  assert.deepEqual(where, { name: 'sitrep_ephemeral_qa_1a93', schema: 'inspection_field_20261103' });
  const sentBefore = await db.emailQueue.count({ where: { estado: 'ENVIADO' } });
  return { db, env, sentBefore };
}

export async function login(email, password = fixture.password) {
  const r = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sitrep-synthetic-preview': '1' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  assert.equal(r.status, 200, 'login ' + email + ' ' + JSON.stringify(j).slice(0, 200));
  return j.data.tokens.accessToken;
}

export async function call(token, method, path, body) {
  const r = await fetch(API + path, { method, headers: { 'x-sitrep-synthetic-preview': '1', authorization: 'Bearer ' + token, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const type = r.headers.get('content-type') || '';
  const payload = type.includes('json') ? await r.json() : { bytes: (await r.arrayBuffer()).byteLength, type };
  return { status: r.status, body: payload };
}

/** Second assigned-elsewhere inspector, artificial and preview-only. */
export async function ensureSecondInspector(db) {
  const email = 'qa-review-20261107-inspector2@example.invalid';
  const src = await db.usuario.findUniqueOrThrow({ where: { id: fixture.users.inspector.id } });
  const existing = await db.usuario.findUnique({ where: { email } });
  if (existing) return existing;
  const { id, email: _e, cuit, createdAt, updatedAt, ...rest } = src;
  return db.usuario.create({ data: { ...rest, email, cuit: null, nombre: 'Inspector', apellido: 'Revisión QA' } });
}
