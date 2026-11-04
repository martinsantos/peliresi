import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-eventual-site-20261030');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const out = process.env.QA_ARTIFACTS!, f = JSON.parse(readFileSync(path.join(out, 'fixture.json'), 'utf8'));
assert.equal(f.synthetic, true); assert.match(f.owner, /@night-qa\.invalid$/);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:4177/api';
async function call(token: string | null, route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(base + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
    'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.96.1', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json(); return { status: response.status, data: data.data };
}
async function login(email: string) { const r = await call(null, '/auth/login', 'POST', { email, password: 'OnlyLocal-NightQA-2026!' }); assert.equal(r.status, 200); return r.data.tokens.accessToken as string; }
try {
  const owner = await db.usuario.findUniqueOrThrow({ where: { id: f.ownerId } });
  assert.equal(owner.email, f.owner); assert.equal(owner.rol, 'GENERADOR'); assert.equal(owner.activo, true);
  const actor = await db.operador.findUniqueOrThrow({ where: { usuarioId: owner.id } });
  const activity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: f.companyId, rol: 'OPERADOR', actorId: actor.id, activa: true } });
  const admin = await login('admin@night-qa.invalid'), token = await login(f.owner), id = randomUUID();
  const created = await call(admin, '/manifiestos/baja-intensidad', 'POST', { id, motivo: 'QA multirrol eventual sin alta', patente: 'QA-002',
    generador: { nombre: 'QA generador externo', identificacion: '', domicilio: '' },
    transportista: { nombre: 'QA transporte externo', identificacion: '', domicilio: '' }, operador: { padronId: actor.id },
    residuos: [{ corriente: 'Y1', cantidad: 1, unidad: 'kg' }] });
  assert.equal(created.status, 201);
  const headers = { 'X-SITREP-Empresa': f.companyId, 'X-SITREP-Empresa-Actividad': activity.id, 'X-SITREP-Establecimiento': f.south };
  const profile = await call(token, '/auth/profile', 'GET', undefined, headers);
  assert.equal(profile.status, 200); assert.equal(profile.data.user.rol, 'OPERADOR'); assert.equal(profile.data.user.operador.id, actor.id);
  const detail = await call(token, '/manifiestos/baja-intensidad/' + id, 'GET', undefined, headers); assert.equal(detail.status, 200);
  const notices = await db.notificacion.findMany({ where: { usuarioId: owner.id, datos: { contains: id } } });
  assert.equal(notices.length, 0);
  const report = { synthetic: true, ownerBaseRole: 'GENERADOR', involvedRole: 'OPERADOR', detail: detail.status, notices: notices.length, record: id };
  writeFileSync(path.join(out, 'multirol-gap.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
