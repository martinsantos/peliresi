import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-eventual-site-20261030');
const out = process.env.QA_ARTIFACTS!, file = path.join(out, 'fixture.json');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:4177/api', phase = process.env.QA_EVENTUAL_SITE_PHASE;
assert.ok(['setup', 'before', 'after', 'restore'].includes(phase || ''));
const source = JSON.parse(readFileSync('/work/sitrep/.qa-operational-ui-current2026103070/onboarding-ux-fixture.json', 'utf8'));
assert.match(source.owner, /@night-qa\.invalid$/); assert.match(source.member, /@night-qa\.invalid$/);
async function call(token: string | null, route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(base + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
    'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.25.91.10', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const raw = await response.text(); let data: any;
  try { data = JSON.parse(raw); } catch { data = {}; }
  return { status: response.status, data: data.data, message: data.message };
}
async function login(email: string) {
  assert.match(email, /@night-qa\.invalid$/);
  const result = await call(null, '/auth/login', 'POST', { email, password: 'OnlyLocal-NightQA-2026!' });
  assert.equal(result.status, 200, 'Synthetic account login'); return result.data.tokens.accessToken as string;
}
const external = (name: string) => ({ nombre: name, identificacion: 'QA sin alta', domicilio: 'QA artificial' });
try {
  if (phase === 'setup') {
    assert.equal(existsSync(file), false, 'Do not overwrite a previous fixture');
    const owner = await db.usuario.findUniqueOrThrow({ where: { email: source.owner } });
    const member = await db.usuario.findUniqueOrThrow({ where: { email: source.member } });
    const activity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: source.companyId, rol: 'GENERADOR', activa: true } });
    const actor = await db.generador.findUniqueOrThrow({ where: { id: activity.actorId } });
    assert.equal(actor.usuarioId, owner.id);
    const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: member.id } } });
    assert.equal(grant.activa, true); assert.equal(grant.todosEstablecimientos, true);
    const north = randomUUID(), south = randomUUID(), marker = randomUUID().slice(0, 8);
    const fixture = { synthetic: true, owner: source.owner, member: source.member, ownerId: owner.id, memberId: member.id,
      companyId: source.companyId, activityId: activity.id, actorId: actor.id, grantId: grant.id,
      original: { todosEstablecimientos: grant.todosEstablecimientos, establecimientoIds: grant.establecimientoIds, revision: grant.revision }, north, south, marker };
    writeFileSync(file, JSON.stringify(fixture, null, 2), { flag: 'wx', mode: 0o600 });
    await db.$transaction(async tx => {
      for (const [id, suffix] of [[north, 'NORTE'], [south, 'SUR']]) await tx.establecimientoEmpresa.create({ data: {
        id, empresaId: fixture.companyId, codigo: 'QA-EVENTUAL-' + marker + '-' + suffix, nombre: 'QA Eventual ' + suffix,
        domicilio: 'Calle artificial ' + suffix, certificados: [] } });
      await tx.autorizacionEmpresa.update({ where: { id: grant.id }, data: { todosEstablecimientos: false, establecimientoIds: [north], revision: { increment: 1 } } });
    });
    console.log('Synthetic company, two sites and scoped representative prepared');
  } else {
    const fixture = JSON.parse(readFileSync(file, 'utf8')); assert.equal(fixture.synthetic, true);
    if (phase === 'restore') {
      const current = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: fixture.grantId } });
      assert.equal(current.usuarioId, fixture.memberId); assert.deepEqual(current.establecimientoIds, [fixture.north]);
      await db.autorizacionEmpresa.update({ where: { id: fixture.grantId }, data: fixture.original });
      const restored = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: fixture.grantId } });
      assert.equal(restored.todosEstablecimientos, fixture.original.todosEstablecimientos);
      assert.deepEqual(restored.establecimientoIds, fixture.original.establecimientoIds);
      assert.equal(restored.revision, fixture.original.revision);
      writeFileSync(path.join(out, 'grant-restored.json'), JSON.stringify({ synthetic: true, restored: true }, null, 2));
      console.log('Synthetic representative grant restored');
    } else {
      const admin = await login('admin@night-qa.invalid'), owner = await login(fixture.owner), member = await login(fixture.member);
      const headers = (site: string) => ({ 'X-SITREP-Empresa': fixture.companyId, 'X-SITREP-Empresa-Actividad': fixture.activityId,
        'X-SITREP-Establecimiento': site });
      const south = headers(fixture.south), north = headers(fixture.north);
      const ownProfile = await call(owner, '/auth/profile', 'GET', undefined, south);
      const memberProfile = await call(member, '/auth/profile', 'GET', undefined, north);
      assert.equal(ownProfile.status, 200); assert.equal(memberProfile.status, 200);
      assert.equal(ownProfile.data.user.empresaContexto.todasSedes, true);
      assert.equal(memberProfile.data.user.empresaContexto.todasSedes, false);
      assert.equal(memberProfile.data.user.empresaContexto.establecimientoId, fixture.north);
      const common = { patente: 'QA-001', motivo: 'Operación de prueba artificial sin alta', residuos: [{ corriente: 'Y1', cantidad: 1, unidad: 'kg' }] };
      const ownerId = randomUUID(), adminId = randomUUID();
      const ownerCreated = await call(owner, '/manifiestos/baja-intensidad', 'POST', { ...common, id: ownerId,
        transportista: external('QA transporte externo'), operador: external('QA operador externo') }, south);
      assert.equal(ownerCreated.status, 201, 'Synthetic site-south creation');
      const adminCreated = await call(admin, '/manifiestos/baja-intensidad', 'POST', { ...common, id: adminId,
        generador: { padronId: fixture.actorId }, transportista: external('QA transporte externo'), operador: external('QA operador externo') });
      assert.equal(adminCreated.status, 201, 'Synthetic administrative creation');
      const detail = await call(member, '/manifiestos/baja-intensidad/' + ownerId, 'GET', undefined, north);
      const list = await call(member, '/manifiestos/baja-intensidad?search=' + encodeURIComponent('BI-' + ownerId), 'GET', undefined, north);
      const tracking = await call(member, '/manifiestos/baja-intensidad/seguimiento', 'GET', undefined, north);
      const reconcile = await call(member, '/manifiestos/baja-intensidad/' + adminId + '/conciliacion?rol=transportista', 'GET', undefined, north);
      const event = await call(member, '/manifiestos/baja-intensidad/' + adminId + '/eventos', 'POST',
        { id: randomUUID(), version: 0, tipo: 'APROBAR_PARTE', parte: 'generador', nota: '' }, north);
      const full = await call(owner, '/manifiestos/baja-intensidad/' + ownerId, 'GET', undefined, south);
      const record = await db.registroManifiestoExcepcional.findUniqueOrThrow({ where: { id: adminId } });
      const ownRecord = await db.registroManifiestoExcepcional.findUniqueOrThrow({ where: { id: ownerId } });
      const memberNotices = await db.notificacion.findMany({ where: { usuarioId: fixture.memberId, datos: { contains: adminId } } });
      const result = { synthetic: true, phase, ownerId, adminId, detail: detail.status, list: list.status,
        containsSouthRecord: !!list.data?.registros?.some((row: any) => row.id === ownerId), tracking: tracking.status,
        reconcile: reconcile.status, decision: event.status, resultingVersion: record.version, fullAccess: full.status,
        siteStored: JSON.stringify(ownRecord.datos).includes(fixture.south), memberNotices: memberNotices.length,
        message: detail.message || null };
      writeFileSync(path.join(out, phase + '-api.json'), JSON.stringify(result, null, 2));
      assert.equal(result.fullAccess, 200); assert.equal(result.siteStored, false);
      if (phase === 'before') {
        assert.equal(result.detail, 200); assert.equal(result.list, 200); assert.equal(result.containsSouthRecord, true);
        assert.equal(result.tracking, 200); assert.equal(result.reconcile, 200); assert.equal(result.decision, 200);
        assert.equal(result.resultingVersion, 1); assert.equal(result.memberNotices, 0);
      } else {
        for (const status of [result.detail, result.list, result.tracking, result.reconcile, result.decision]) assert.equal(status, 403);
        assert.equal(result.resultingVersion, 0); assert.match(result.message || '', /todos los establecimientos/i);
      }
      console.log(JSON.stringify(result));
    }
  }
} finally { await db.$disconnect(); }
