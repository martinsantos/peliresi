import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'reactivation_20261022');
assert.equal(process.env.MANIFEST_REVIEW_AUTHORITY_BY_ROLE, 'true');
assert.equal(process.env.MANIFEST_EXCEPTIONAL_REVIEWERS, '');
const out = process.env.QA_ARTIFACTS!, fixture = JSON.parse(readFileSync(out + '/fixture.json', 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const authorities = [
  { id: 'adenda-qa-authority', alias: 'adenda-authority', rol: 'ADMIN' },
  { id: 'adenda-qa-admin-g', alias: 'authority-generador', rol: 'ADMIN_GENERADOR' },
  { id: 'adenda-qa-admin-o', alias: 'authority-operador', rol: 'ADMIN_OPERADOR' },
  { id: 'adenda-qa-admin-t', alias: 'authority-transporte', rol: 'ADMIN_TRANSPORTISTA' },
];
const tokens = new Map<string, string>(), base = 'http://127.0.0.1:4177/api', checks: string[] = [];
async function token(alias: string) {
  if (!tokens.has(alias)) {
    const r = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.39.' + (tokens.size + 1) }, body: JSON.stringify({ email: alias + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
    const b = await r.json(); assert.equal(r.status, 200, JSON.stringify(b)); assert.notEqual(b.data.user?.training, true); tokens.set(alias, b.data.tokens.accessToken);
  }
  return tokens.get(alias)!;
}
async function request(alias: string, path: string, method = 'GET', body?: unknown, status = 200) {
  const r = await fetch(base + path, { method, headers: { Authorization: 'Bearer ' + await token(alias), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const b = await r.json(); assert.equal(r.status, status, alias + ' ' + path + ' ' + JSON.stringify(b)); assert.notEqual(r.headers.get('x-sitrep-training'), 'true'); return b.data;
}
async function createCase() {
  const manifest = await db.manifiesto.create({ data: { numero: 'QA-ROLE-' + randomUUID(), estado: 'RECIBIDO', generadorId: fixture.actors.generador, transportistaId: fixture.actors.transportista, operadorId: fixture.actors.operador, creadoPorId: fixture.users.generador, isDemoData: true, modalidad: 'FIJO', residuos: { create: [{ tipoResiduoId: fixture.wastes[0], cantidad: 10, unidad: 'kg', estado: 'SOLIDO' }] } } });
  const endpoint = '/manifiestos/' + manifest.id + '/adendas';
  const adenda = (await request('operador', endpoint, 'POST', { id: randomUUID(), motivo: 'QA hallazgo: cantidad diferente y Y21 omitida', residuos: [{ corriente: 'Y1', cantidad: 12, unidad: 'kg' }, { corriente: 'Y21', cantidad: 3, unidad: 'kg' }] }, 201)).adenda;
  return { manifest, adenda, endpoint };
}
try {
  const phase = process.argv[2];
  if (phase === 'extra-fixtures') {
    const admin = await db.usuario.findUniqueOrThrow({ where: { id: fixture.users.admin } });
    for (const account of authorities) await db.usuario.create({ data: { id: account.id, email: account.alias + '@night-qa.invalid', password: admin.password, rol: account.rol, nombre: 'QA ' + account.alias, activo: true, emailVerified: true, notifEmail: false } });
    await db.usuario.create({ data: { id: 'reactivation-inactive', email: 'inactive-authority@night-qa.invalid', password: admin.password, rol: 'ADMIN_GENERADOR', nombre: 'QA inactivo', activo: false, motivoInactividad: 'SUSPENDIDA', emailVerified: true } });
    const historical = await db.manifiesto.create({ data: { id: 'manifest-qa-legacy', numero: 'QA-LEGACY-UNCHANGED', estado: 'TRATADO', generadorId: fixture.actors.generador, transportistaId: fixture.actors.transportista, operadorId: fixture.actors.operador, creadoPorId: fixture.users.admin, isDemoData: true, residuos: { create: [{ tipoResiduoId: fixture.wastes[0], cantidad: 10, unidad: 'kg', estado: 'SOLIDO' }] } }, include: { residuos: true, eventos: true } });
    writeFileSync(out + '/manifest-legacy-before.json', JSON.stringify(historical));
    const id = 'qa-legacy-exceptional', datos = { id, generador: { nombre: 'QA legado', identificacion: 'QA-LEGACY', domicilio: '' }, transportista: { nombre: '', identificacion: '', domicilio: '' }, patente: 'QA-OLD', motivo: 'QA contrato anterior', residuos: [{ corriente: 'Y1', cantidad: 5, unidad: 'kg' }] };
    await db.registroManifiestoExcepcional.create({ data: { id, operadorId: fixture.actors.operador, creadoPorId: fixture.users.operador, huellaSolicitud: 'qa-legacy-fingerprint', datos, etapa: 'RETIRADO', version: 1, eventos: [{ id: 'qa-legacy-event', version: 0, tipo: 'AVANCE', etapa: 'RETIRADO', nota: '', autorId: fixture.users.operador, fecha: '2026-10-15T12:00:00.000Z' }] } });
    writeFileSync(out + '/fixture.json', JSON.stringify({ ...fixture, database: 'sitrep_night_qa_20260926', externalDelivery: false, capClosed: true }));
    checks.push('additive synthetic authorities and immutable legacy cases; no prior schema changed');
  } else if (phase === 'authority-http') {
    const { manifest, adenda, endpoint } = await createCase();
    const path = endpoint + '/' + adenda.id + '/revisiones';
    const original = JSON.stringify(await db.manifiesto.findUniqueOrThrow({ where: { id: manifest.id }, include: { residuos: true, eventos: true } }));
    for (const alias of ['generador2', 'operador2', 'transportista2']) await request(alias, endpoint, 'GET', undefined, 404);
    await request('operador', path, 'POST', { id: randomUUID(), version: 0, decision: 'APROBADA', nota: 'No autoaprobación' }, 403);
    checks.push('unrelated actors denied and author cannot approve own finding');
    for (const [version, account] of authorities.entries()) {
      assert.equal((await request(account.alias, endpoint)).adendas[0].puedeResolver, true);
      const command = { id: randomUUID(), version, decision: ['OBSERVADA', 'APROBADA', 'RECHAZADA', 'APROBADA'][version], nota: 'QA decisión individual ' + account.rol };
      const result = (await request(account.alias, path, 'POST', command)).adenda;
      assert.equal(result.version, version + 1); assert.equal(result.revisiones[version].autorId, account.id);
      const count = await db.notificacion.count(); await request(account.alias, path, 'POST', command); assert.equal(await db.notificacion.count(), count);
    }
    checks.push('four roles resolve without IDs, retaining individual decisions and exact idempotency');
    const expected = await db.usuario.findMany({ where: { activo: true, rol: { in: ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA'] } }, select: { id: true } });
    const notices = await db.notificacion.findMany({ where: { datos: { contains: adenda.id }, titulo: 'Nueva corriente aprobada post facto' } });
    assert.equal(notices.length, expected.length * 2);
    for (const version of [2, 4]) assert.deepEqual(notices.filter((n: any) => JSON.parse(n.datos).versionAdenda === version).map((n: any) => n.usuarioId).sort(), expected.map((n: any) => n.id).sort());
    checks.push('each approval reaches exactly every active authority and no inactive/actor account');
    assert.equal((await request('admin', endpoint)).adendas[0].puedeResolver, true);
    for (const alias of ['jefe-generadores', 'jefe-transporte', 'jefe-operadores']) assert.equal((await request(alias, endpoint)).adendas[0].puedeResolver, true);
    const g = authorities[1]; await db.usuario.update({ where: { id: g.id }, data: { activo: false } });
    try { await request(g.alias, endpoint, 'GET', undefined, 401); } finally { await db.usuario.update({ where: { id: g.id }, data: { activo: true } }); }
    await db.usuario.update({ where: { id: g.id }, data: { rol: 'GENERADOR' } });
    try { await request(g.alias, endpoint, 'GET', undefined, 404); } finally { await db.usuario.update({ where: { id: g.id }, data: { rol: g.rol } }); }
    checks.push('old tokens immediately lose access after deactivation or role change');
    await request('admin', '/manifiestos/baja-intensidad');
    for (const a of authorities.slice(1)) await request(a.alias, '/manifiestos/baja-intensidad', 'GET', undefined, 403);
    checks.push('eventual review remains ADMIN only; sector roles cannot enter that ledger');
    assert.equal(JSON.stringify(await db.manifiesto.findUniqueOrThrow({ where: { id: manifest.id }, include: { residuos: true, eventos: true } })), original);
    assert.equal((await request('operador', endpoint)).documental.cierreAcreditado, false);
    assert.equal(await db.antecedenteFiscalizacion.count({ where: { origenId: adenda.id } }), 2);
    checks.push('original and physical stage unchanged; hallazgo creates two independent inspection antecedents');
  } else if (phase === 'authority-fixtures') {
    const cases: Record<string, unknown> = {};
    for (const surface of ['web-desktop', 'web-responsive', 'app']) for (const authority of authorities) {
      const { manifest, adenda, endpoint } = await createCase();
      await request('generador', endpoint + '/' + adenda.id + '/revisiones', 'POST', { id: randomUUID(), version: 0, decision: 'APROBADA', nota: 'QA conformidad individual' });
      cases[surface + ':' + authority.alias] = { manifestId: manifest.id, numero: manifest.numero, adendaId: adenda.id };
    }
    writeFileSync(out + '/authority-browser-fixture.json', JSON.stringify({ authorities, cases }));
    checks.push('twelve distinct browser cases created through HTTP with real internal notices');
  } else throw new Error('Unknown phase');
  writeFileSync(out + '/' + phase + '.json', JSON.stringify({ checks, at: new Date().toISOString() }));
  console.log(phase + ': ' + checks.length + ' groups PASS');
} finally { await db.$disconnect(); }
