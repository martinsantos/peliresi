import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'eventual_usability_20261022');
const out = process.env.QA_ARTIFACTS!, fixture = JSON.parse(readFileSync(out + '/fixture.json', 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:4177/api', tokens = new Map<string, string>(), checks: string[] = [];
async function request(alias: string, path: string, method = 'GET', body?: unknown, expected = 200) {
  if (!tokens.has(alias)) {
    const r = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.47.' + (tokens.size + 1) }, body: JSON.stringify({ email: alias + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
    assert.equal(r.status, 200); tokens.set(alias, (await r.json()).data.tokens.accessToken);
  }
  const r = await fetch(base + path, { method, headers: { Authorization: 'Bearer ' + tokens.get(alias), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await r.json(); assert.equal(r.status, expected, JSON.stringify(result)); return result.data;
}
const endpoint = '/manifiestos/baja-intensidad';
const external = { nombre: 'QA Externo', identificacion: 'QA-EXTERNAL', domicilio: 'QA sin datos reales' };
try {
  const sets: Record<string, string[]> = {};
  for (const linked of ['generador', 'transportista']) {
    const body = { id: randomUUID(), generador: external, transportista: external, patente: 'QA-LIST', motivo: 'QA listado con varias páginas', residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }], [linked]: { ...external, padronId: fixture.actors[linked] } };
    const { registro: original } = await request('operador', endpoint, 'POST', body, 201);
    await request('operador', endpoint + '/' + original.id + '/eventos', 'POST', { id: randomUUID(), version: 0, tipo: 'APROBAR_PARTE', parte: 'creador', nota: '' });
    await request(linked, endpoint + '/' + original.id + '/eventos', 'POST', { id: randomUUID(), version: 1, tipo: 'APROBAR_PARTE', parte: linked, nota: '' });
    const approved = await db.registroManifiestoExcepcional.findUniqueOrThrow({ where: { id: original.id } });
    await request('operador', endpoint + '/' + original.id + '/eventos', 'POST', { id: randomUUID(), version: 2, tipo: 'AVANCE', etapa: 'RETIRADO', nota: 'QA retiro artificial' });
    const retired = await db.registroManifiestoExcepcional.findUniqueOrThrow({ where: { id: original.id } });
    sets[linked] = [];
    for (let index = 0; index < 24; index++) {
      const id = randomUUID(), template = index % 2 ? retired : approved;
      await db.registroManifiestoExcepcional.create({ data: { ...template, id, huellaSolicitud: 'QA-list-' + id, datos: { ...template.datos, id, patente: 'QA-LIST-' + index, generador: { ...template.datos.generador, nombre: 'QA Listado ' + linked + ' ' + index } }, createdAt: new Date(Date.now() - index * 1000) } });
      sets[linked].push(id);
    }
  }
  for (const [alias, expected] of [['generador', 24], ['transportista', 24], ['operador', 48], ['admin', 48]] as const) {
    const ids: string[] = [];
    for (let page = 1; page <= Math.ceil(expected / 20); page++) {
      const result = await request(alias, endpoint + '?search=qa%20listado&page=' + page);
      assert.equal(result.total, expected); assert.equal(result.page, page);
      ids.push(...result.registros.map((r: { id: string }) => r.id));
    }
    assert.equal(new Set(ids).size, expected);
    const retired = await request(alias, endpoint + '?search=qa%20listado&etapa=RETIRADO&page=999');
    assert.equal(retired.total, expected / 2); assert.equal(retired.page, Math.ceil(expected / 2 / 20));
    assert.ok(retired.registros.every((r: { etapa: string }) => r.etapa === 'RETIRADO'));
    checks.push(alias + ': every page, case-insensitive search, stage and page clamp');
  }
  for (const alias of ['generador2', 'transportista2', 'operador2']) assert.equal((await request(alias, endpoint + '?search=qa%20listado')).total, 0);
  for (const alias of ['jefe-generadores', 'jefe-transporte', 'jefe-operadores']) await request(alias, endpoint + '?search=qa', 'GET', undefined, 403);
  checks.push('unrelated parties empty; sector administrations denied');
  assert.equal((await request('operador', endpoint + '?search=' + encodeURIComponent('BI-' + sets.generador[0]))).total, 1);
  assert.equal((await request('operador', endpoint + '?search=%25')).total, 0);
  assert.equal((await request('operador', endpoint + '?search=%27%20OR%20true--')).total, 0);
  for (const query of ['page=0', 'page=1.5', 'etapa=APROBADO', 'search[x]=y']) await request('operador', endpoint + '?' + query, 'GET', undefined, 400);
  checks.push('full BI reference, literal wildcard/SQL text and invalid-filter rejection');
  writeFileSync(out + '/eventual-list-fixture.json', JSON.stringify({ sets }));
  writeFileSync(out + '/eventual-http.json', JSON.stringify({ checks, at: new Date().toISOString() }));
  console.log(checks.length + ' HTTP groups PASS');
} finally { await db.$disconnect(); }
