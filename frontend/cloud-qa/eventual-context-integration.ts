import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-eventual-context-20261030'; assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const source = JSON.parse(readFileSync('/work/sitrep/.qa-eventual-site-20261030/fixture.json', 'utf8'));
assert.equal(source.synthetic, true); assert.match(source.member, /@night-qa\.invalid$/); assert.match(source.owner, /@night-qa\.invalid$/);
const phase = process.env.QA_EVENTUAL_CONTEXT_PHASE; assert.ok(phase === 'before' || phase === 'after');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient(), base = 'http://127.0.0.1:4177/api';
async function call(token: string | null, route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(base + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
    'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.98.1', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const raw = await response.text(); let data: any; try { data = JSON.parse(raw); } catch { data = {}; }
  return { status: response.status, data: data.data, message: data.message };
}
async function login(email: string) { const r = await call(null, '/auth/login', 'POST', { email, password: 'OnlyLocal-NightQA-2026!' }); assert.equal(r.status, 200); return r.data.tokens.accessToken as string; }
const external = (name: string) => ({ nombre: name, identificacion: 'QA sin alta', domicilio: 'QA artificial' });
try {
  const generatorGrant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: source.grantId } });
  assert.equal(generatorGrant.usuarioId, source.memberId); assert.equal(generatorGrant.activa, true); assert.equal(generatorGrant.todosEstablecimientos, true);
  const operatorActivity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: source.companyId, rol: 'OPERADOR', activa: true } });
  const operatorGrant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: operatorActivity.id, usuarioId: source.memberId } } });
  assert.equal(operatorGrant.activa, true); assert.equal(operatorGrant.todosEstablecimientos, true);
  const member = await login(source.member), owner = await login(source.owner);
  const headers = (activity: string, site: string) => ({ 'X-SITREP-Empresa': source.companyId, 'X-SITREP-Empresa-Actividad': activity, 'X-SITREP-Establecimiento': site });
  const gen = headers(source.activityId, source.north), op = headers(operatorActivity.id, source.south);
  const id = randomUUID(), body = { id, motivo: 'QA eventual creado desde Generador', patente: 'QA-004',
    transportista: { ...external('QA transporte de contexto'), identificacion: 'QA-' + id }, operador: external('QA operador externo de contexto'),
    residuos: [{ corriente: 'Y1', cantidad: 1, unidad: 'kg' }] };
  const created = await call(member, '/manifiestos/baja-intensidad', 'POST', body, gen); assert.equal(created.status, 201);
  const sameContextRetry = await call(member, '/manifiestos/baja-intensidad', 'POST', body, gen);
  assert.equal(sameContextRetry.status, 201); assert.equal(sameContextRetry.data.registro.id, id);
  const before = await call(member, '/manifiestos/baja-intensidad/' + id, 'GET', undefined, gen); assert.equal(before.status, 200);
  writeFileSync(path.join(out, phase + '-fixture.json'), JSON.stringify({ synthetic: true, recordId: id, body, operatorActivityId: operatorActivity.id,
    member: source.member, memberId: source.memberId, companyId: source.companyId, generatorActivityId: source.activityId,
    generatorGrantId: source.grantId, generatorGrantRevision: generatorGrant.revision, north: source.north, south: source.south }, null, 2));
  try {
    await db.autorizacionEmpresa.update({ where: { id: source.grantId }, data: { activa: false, revision: { increment: 1 } } });
    const revoked = await call(member, '/auth/profile', 'GET', undefined, gen); assert.equal(revoked.status, 403);
    const profile = await call(member, '/auth/profile', 'GET', undefined, op);
    assert.equal(profile.status, 200); assert.equal(profile.data.user.rol, 'OPERADOR');
    const detail = await call(member, '/manifiestos/baja-intensidad/' + id, 'GET', undefined, op);
    const list = await call(member, '/manifiestos/baja-intensidad?search=' + encodeURIComponent('BI-' + id), 'GET', undefined, op);
    const tracking = await call(member, '/manifiestos/baja-intensidad/seguimiento?rol=transportista&identificacion=' + encodeURIComponent('QA-' + id), 'GET', undefined, op);
    const reconcile = await call(member, '/manifiestos/baja-intensidad/' + id + '/conciliacion?rol=transportista', 'GET', undefined, op);
    const retry = await call(member, '/manifiestos/baja-intensidad', 'POST', body, op);
    const authorized = await call(owner, '/manifiestos/baja-intensidad/' + id, 'GET', undefined, gen);
    const report = { synthetic: true, phase, recordId: id, detail: detail.status, list: list.status,
      appearsInList: !!list.data?.registros?.some((row: any) => row.id === id), tracking: tracking.status,
      appearsInTracking: !!tracking.data?.registros?.some((row: any) => row.id === id), reconcile: reconcile.status, retry: retry.status,
      authorized: authorized.status, sameContextRetry: sameContextRetry.status, revokedProfile: revoked.status, retryMessage: retry.message || null };
    writeFileSync(path.join(out, phase + '-api.json'), JSON.stringify(report, null, 2));
    assert.equal(report.list, 200); assert.equal(report.tracking, 200); assert.equal(report.authorized, 200);
    if (phase === 'before') { assert.equal(report.detail, 200); assert.equal(report.appearsInList, true); assert.equal(report.appearsInTracking, true); assert.equal(report.reconcile, 200); assert.equal(report.retry, 201); }
    else { assert.equal(report.detail, 404); assert.equal(report.appearsInList, false); assert.equal(report.appearsInTracking, false); assert.equal(report.reconcile, 404); assert.equal(report.retry, 409); }
    console.log(JSON.stringify(report));
  } finally {
    await db.autorizacionEmpresa.update({ where: { id: source.grantId }, data: { activa: generatorGrant.activa, revision: generatorGrant.revision } });
    const restored = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: source.grantId } });
    assert.equal(restored.activa, generatorGrant.activa); assert.equal(restored.revision, generatorGrant.revision);
  }
} finally { await db.$disconnect(); }
