import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const output = process.env.QA_ARTIFACTS!;
const fixture = JSON.parse(await readFile(path.join(output, 'fixture.json'), 'utf8'));
assert.equal(fixture.database, 'sitrep_night_qa_20260926');
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const results: string[] = [];
try {
  if (process.argv.includes('--verify-history')) {
    const current = await db.manifiesto.findUniqueOrThrow({ where: { id: 'manifest-qa-legacy' }, include: { residuos: true, eventos: true } });
    assert.equal(JSON.stringify(current), await readFile(path.join(output, 'manifest-legacy-before.json'), 'utf8'));
    await writeFile(path.join(output, 'manifest-history-proof.json'), JSON.stringify({ unchanged: true, syntheticOnly: true, commit: process.env.GITHUB_SHA }));
  } else {
    const base = 'http://127.0.0.1:3037/api';
    const sessions = new Map<string, string>();
    async function token(role: string) {
      if (!sessions.has(role)) {
        const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: role + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
        assert.equal(response.status, 200);
        sessions.set(role, (await response.json()).data.tokens.accessToken);
      }
      return sessions.get(role)!;
    }
    const body = { generadorId: fixture.actors.generador, transportistaId: fixture.actors.transportista,
      operadorId: fixture.actors.operador, modalidad: 'FIJO', residuos: [{ tipoResiduoId: fixture.wastes[0], cantidad: 15, unidad: 'kg' }] };
    async function request(route: string, method: string, data: unknown, status = 200, role = 'admin') {
      const res = await fetch(base + route, { method, headers: { Authorization: 'Bearer ' + await token(role), 'Content-Type': 'application/json' },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
      const json = await res.json(); assert.equal(res.status, status, JSON.stringify(json)); return json;
    }
    const created = (await request('/manifiestos', 'POST', { ...body, vehiculoId: 'manifest-qa-second-vehicle', choferId: 'manifest-qa-second-driver',
      asignacionTransporte: { vehiculo: { patente: 'FORGED' } } }, 201)).data.manifiesto;
    assert.equal(created.asignacionTransporte.vehiculo.patente, 'QA002ZZ');
    assert.equal(created.asignacionTransporte.chofer.apellido, 'Segundo');
    assert.equal(created.asignacionTransporte.transportistaId, body.transportistaId);
    assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: created.id, tipo: 'ASIGNACION_TRANSPORTE' } }), 1);
    results.push('server snapshots explicit second resources and ignores forged snapshot');
    const count = await db.manifiesto.count();
    for (const invalid of [{ vehiculoId: 'night-qa-vehicle-2' }, { choferId: 'night-qa-driver-2' },
      { vehiculoId: 'manifest-qa-inactive-vehicle' }, { choferId: 'manifest-qa-inactive-driver' },
      { vehiculoId: 'missing' }, { choferId: 'missing' }, { vehiculoId: '' }, { choferId: {} }]) {
      await request('/manifiestos', 'POST', { ...body, ...invalid }, 400);
    }
    await request('/manifiestos', 'POST', { ...body, modalidad: 'IN_SITU', transportistaId: undefined, vehiculoId: 'manifest-qa-second-vehicle' }, 400);
    await request('/manifiestos', 'POST', body, 403, 'transportista');
    assert.equal(await db.manifiesto.count(), count);
    results.push('invalid/foreign/inactive/in-situ/unauthorized assignments create no manifest');
    const unassigned = (await request('/manifiestos', 'POST', body, 201)).data.manifiesto;
    assert.equal(unassigned.asignacionTransporte, null);
    const inSitu = (await request('/manifiestos', 'POST', { ...body, modalidad: 'IN_SITU', transportistaId: undefined }, 201)).data.manifiesto;
    assert.equal(inSitu.asignacionTransporte, null); assert.equal(inSitu.transportistaId, null);
    results.push('optional selection and in situ preserve compatibility');
    await db.vehiculo.update({ where: { id: 'manifest-qa-second-vehicle' }, data: { patente: 'QA-EDITADA' } });
    await db.chofer.update({ where: { id: 'manifest-qa-second-driver' }, data: { apellido: 'Editado' } });
    const persisted = (await request('/manifiestos/' + created.id, 'GET', undefined)).data.manifiesto;
    assert.deepEqual(persisted.asignacionTransporte, created.asignacionTransporte);
    for (const [id, assigned] of [[created.id, true], ['manifest-qa-legacy', false]] as const) {
      const response = await fetch(base + '/pdf/manifiesto/' + id, { headers: { Authorization: 'Bearer ' + await token('admin') } });
      assert.equal(response.status, 200); assert.match(response.headers.get('content-type')!, /application\/pdf/);
      const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      const file = path.join(output, assigned ? 'assigned.pdf' : 'legacy.pdf'); await writeFile(file, bytes);
      const text = execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' });
      if (assigned) { assert.match(text, /QA002ZZ/); assert.match(text, /Segundo/); assert.doesNotMatch(text, /QA-EDITADA|Editado|QA0001/); }
      else { assert.match(text, /Sin asignación registrada/); assert.doesNotMatch(text, /QA0001/); }
      const layout = execFileSync('pdftotext', ['-bbox', file, '-'], { encoding: 'utf8' });
      const fieldY = (label: 'Vehiculo' | 'Chofer') => {
        const match = layout.match(new RegExp('<word xMin="[\\d.]+" yMin="([\\d.]+)" xMax="[\\d.]+" yMax="[\\d.]+">' + label + '</word>'));
        assert.ok(match, 'The actual PDF must contain the ' + label + ' label');
        return Number(match[1]);
      };
      assert.ok(Math.abs(fieldY('Vehiculo') - fieldY('Chofer')) < 0.1, 'Vehicle and driver labels must share the same row');
      execFileSync('pdftoppm', ['-f', '1', '-singlefile', '-scale-to', '1200', '-png', file, path.join(output, assigned ? 'assigned-preview' : 'legacy-preview')]);
    }
    await request('/manifiestos/' + created.id, 'GET', undefined, 404, 'generador2');
    results.push('snapshot survives catalogue edits; PDF matches selection; legacy PDF never guesses; outsider denied');
    await request('/manifiestos/' + created.id, 'PUT', { transportistaId: fixture.actors.transportista2 });
    assert.equal((await db.manifiesto.findUniqueOrThrow({ where: { id: created.id } })).asignacionTransporte, null);
    const removed = await db.eventoManifiesto.findMany({ where: { manifiestoId: created.id, tipo: 'ASIGNACION_TRANSPORTE_RETIRADA' } });
    assert.equal(removed.length, 1);
    assert.match(removed[0].descripcion, /QA002ZZ/);
    assert.match(removed[0].descripcion, /Segundo/);
    results.push('draft carrier change invalidates old resources');
    // Restore only the synthetic catalogue probes so each browser starts consistently.
    await db.vehiculo.update({ where: { id: 'manifest-qa-second-vehicle' }, data: { patente: 'QA002ZZ' } });
    await db.chofer.update({ where: { id: 'manifest-qa-second-driver' }, data: { apellido: 'Segundo' } });
    await writeFile(path.join(output, 'manifest-http.json'), JSON.stringify({ commit: process.env.GITHUB_SHA, passed: results, externalDelivery: false }, null, 2));
    console.log(results);
  }
} finally { await db.$disconnect(); }
