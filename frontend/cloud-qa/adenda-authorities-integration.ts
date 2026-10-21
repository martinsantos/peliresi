import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'adenda_authorities_20261021');
const out = process.env.QA_ARTIFACTS!, fixture = JSON.parse(readFileSync(out + '/fixture.json', 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const authorities = [
  { id: 'adenda-qa-authority', alias: 'adenda-authority', rol: 'ADMIN' },
  { id: 'adenda-qa-admin-g', alias: 'authority-generador', rol: 'ADMIN_GENERADOR' },
  { id: 'adenda-qa-admin-o', alias: 'authority-operador', rol: 'ADMIN_OPERADOR' },
  { id: 'adenda-qa-admin-t', alias: 'authority-transporte', rol: 'ADMIN_TRANSPORTISTA' },
];
const tokens = new Map<string, string>();
const base = 'http://127.0.0.1:4177/api', checks: string[] = [];
async function token(alias: string) {
  if (!tokens.has(alias)) {
    const r = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.24.' + (tokens.size + 1) }, body: JSON.stringify({ email: alias + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
    const b = await r.json(); assert.equal(r.status, 200); assert.notEqual(b.data.user?.training, true); tokens.set(alias, b.data.tokens.accessToken);
  }
  return tokens.get(alias)!;
}
async function request(alias: string, path: string, method = 'GET', body?: unknown, status = 200) {
  const r = await fetch(base + path, { method, headers: { Authorization: 'Bearer ' + await token(alias), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const b = await r.json(); assert.equal(r.status, status, alias + ' ' + path + ' ' + JSON.stringify(b)); assert.notEqual(r.headers.get('x-sitrep-training'), 'true'); return b.data;
}
async function createCase() {
  const manifest = await db.manifiesto.create({ data: { numero: 'QA-AUTH-' + randomUUID(), estado: 'RECIBIDO', generadorId: fixture.actors.generador, transportistaId: fixture.actors.transportista, operadorId: fixture.actors.operador, creadoPorId: fixture.users.generador, isDemoData: true, modalidad: 'FIJO', residuos: { create: [{ tipoResiduoId: fixture.wastes[0], cantidad: 10, unidad: 'kg', estado: 'SOLIDO' }] } }, include: { residuos: true, eventos: true } });
  const endpoint = '/manifiestos/' + manifest.id + '/adendas';
  const adenda = (await request('operador', endpoint, 'POST', { id: randomUUID(), motivo: 'QA hallazgo para autoridades: corriente Y21 omitida', residuos: [{ corriente: 'Y1', cantidad: 12, unidad: 'kg' }, { corriente: 'Y21', cantidad: 3, unidad: 'kg' }] }, 201)).adenda;
  return { manifest, adenda, endpoint };
}
try {
  if (process.argv[2] === 'seed') {
    const admin = await db.usuario.findUniqueOrThrow({ where: { id: fixture.users.admin } });
    for (const account of authorities.slice(1)) {
      await db.usuario.create({ data: { id: account.id, email: account.alias + '@night-qa.invalid', password: admin.password, rol: account.rol, nombre: 'QA ' + account.alias, activo: true, emailVerified: true } });
    }
    for (const rol of ['ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA']) await db.usuario.create({ data: { id: 'adenda-qa-unselected-' + rol, email: 'unselected-' + rol.toLowerCase() + '@night-qa.invalid', password: admin.password, rol, nombre: 'QA no designado ' + rol, activo: true, emailVerified: true } });
    await db.usuario.create({ data: { id: 'adenda-qa-inactive', email: 'inactive-authority@night-qa.invalid', password: admin.password, rol: 'ADMIN_GENERADOR', nombre: 'QA inactivo', activo: false, motivoInactividad: 'SUSPENDIDA', emailVerified: true } });
    writeFileSync(out + '/authority-selection-qa.json', JSON.stringify({ authorities, ids: [...authorities.map(a => a.id), 'adenda-qa-inactive', fixture.users.generador2] }));
    checks.push('four designated synthetic roles; separate undesignated, inactive and non-authority controls');
  } else if (process.argv[2] === 'http') {
    const { manifest, adenda, endpoint } = await createCase();
    const path = endpoint + '/' + adenda.id + '/revisiones';
    const originalHash = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
    for (const alias of ['admin', 'unselected-admin_generador', 'unselected-admin_operador', 'unselected-admin_transportista']) {
      const list = await request(alias, endpoint); assert.equal(list.adendas[0].puedeResolver, false);
      await request(alias, path, 'POST', { id: randomUUID(), version: 0, decision: 'APROBADA', nota: 'Debe rechazar por falta de designación' }, 403);
    }
    checks.push('all four undesignated admin roles can read but cannot review');
    await request('generador2', endpoint, 'GET', undefined, 404);
    for (const [version, account] of authorities.entries()) {
      const list = await request(account.alias, endpoint); assert.equal(list.adendas[0].puedeResolver, true);
      const command = { id: randomUUID(), version, decision: ['OBSERVADA', 'APROBADA', 'RECHAZADA', 'APROBADA'][version], nota: 'QA decisión individual: ' + account.rol };
      const result = (await request(account.alias, path, 'POST', command)).adenda;
      assert.equal(result.version, version + 1); assert.equal(result.revisiones[version].autorId, account.id); assert.equal(result.revisiones[version].autor.rol, account.rol);
      const count = await db.notificacion.count(); await request(account.alias, path, 'POST', command); assert.equal(await db.notificacion.count(), count);
    }
    checks.push('four selected roles review independently, retain audit authors and replay without duplicate notices');
    const notices = await db.notificacion.findMany({ where: { datos: { contains: adenda.id }, titulo: 'Nueva corriente aprobada post facto' } });
    assert.equal(notices.length, 8); assert.deepEqual([...new Set(notices.map((n: { usuarioId: string }) => n.usuarioId))].sort(), authorities.map(a => a.id).sort());
    for (const n of notices) { const d = JSON.parse(n.datos); assert.equal(d.adendaId, adenda.id); assert.equal(d.manifiestoId, manifest.id); assert.deepEqual(d.corrientes, ['Y21']); assert.ok([2, 4].includes(d.versionAdenda)); }
    checks.push('two approvals notify exactly four active designated authorities; inactive/nonadmin excluded');
    const g = authorities[1]; await db.usuario.update({ where: { id: g.id }, data: { activo: false } });
    try { await request(g.alias, endpoint, 'GET', undefined, 401); } finally { await db.usuario.update({ where: { id: g.id }, data: { activo: true } }); }
    await db.usuario.update({ where: { id: g.id }, data: { rol: 'GENERADOR' } });
    try { await request(g.alias, endpoint, 'GET', undefined, 404); } finally { await db.usuario.update({ where: { id: g.id }, data: { rol: g.rol } }); }
    checks.push('existing tokens lose authority after deactivation or role change');
    for (const a of authorities) await request(a.alias, '/manifiestos/baja-intensidad', 'GET', undefined, 404);
    assert.equal(createHash('sha256').update(JSON.stringify(await db.manifiesto.findUniqueOrThrow({ where: { id: manifest.id }, include: { residuos: true, eventos: true } }))).digest('hex'), originalHash);
    assert.equal((await request('operador', endpoint)).documental.cierreAcreditado, false);
    checks.push('eventual circuit remains closed; original declaration, physical stage and documentary closure unchanged');
  } else if (process.argv[2] === 'fixtures') {
    const cases: Record<string, unknown> = {};
    for (const surface of ['web-desktop', 'web-responsive', 'app']) for (const authority of authorities) {
      const { manifest, adenda, endpoint } = await createCase();
      await request('generador', endpoint + '/' + adenda.id + '/revisiones', 'POST', { id: randomUUID(), version: 0, decision: 'APROBADA', nota: 'QA generador: conformidad individual con Y21' });
      cases[surface + ':' + authority.alias] = { manifestId: manifest.id, numero: manifest.numero, adendaId: adenda.id };
    }
    writeFileSync(out + '/authority-browser-fixture.json', JSON.stringify({ authorities, cases }));
    checks.push('twelve independent browser cases created through ordinary HTTP findings and party approval');
  } else throw Error('Unknown phase');
  writeFileSync(out + '/authority-' + process.argv[2] + '.json', JSON.stringify({ checks, at: new Date().toISOString() }, null, 2)); console.log(checks.length + ' authority groups PASS');
} finally { await db.$disconnect(); }
