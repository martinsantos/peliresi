import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.SITREP_QA_RUN, 'legacy-integrity-baseline-20261030');
const out = process.env.QA_ARTIFACTS!, fixture = JSON.parse(readFileSync(path.join(out, 'legacy-integrity-fixture.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const login = async (role: string) => {
  const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.33.14.5' },
    body: JSON.stringify({ email: `${role}@night-qa.invalid`, password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(response.status, 200); return (await response.json()).data.tokens.accessToken;
};
try {
  const operator = await login('operador'), carrier = await login('transportista');
  const get = (url: string, token: string) => fetch('http://127.0.0.1:4177/api' + url, { headers: { Authorization: `Bearer ${token}` } });
  const all = await get(`/manifiestos/tareas-partes?search=${fixture.prefix}`, operator);
  assert.equal(all.status, 409, 'One invalid proposal makes the entire agenda fail in the baseline');
  const missing = await get(`/manifiestos/tareas-partes?search=${fixture.cases.missing.numero}`, operator);
  assert.equal(missing.status, 200);
  const row = (await missing.json()).data.items[0];
  assert.equal(row.requiereMiAprobacion, false);
  assert.equal(row.requiereNuevaPropuesta, false);
  assert.notEqual(row.action, 'Propuesta por revisar');
  const details = await get(`/manifiestos/${fixture.cases.mismatch.id}`, carrier);
  assert.equal(details.status, 200);
  const record = (await details.json()).data.manifiesto;
  assert.equal(record.aprobacionOperacion, undefined);
  assert.ok(['FIRMA','APROBACION_TRANSPORTISTA','APROBACION_OPERADOR','INICIO_COORDINACION'].every(tipo => record.eventos.some((event: any) => event.tipo === tipo)));
  const denied = await fetch(`http://127.0.0.1:4177/api/manifiestos/${fixture.cases.mismatch.id}/confirmar-retiro`, { method: 'POST', headers: { Authorization: `Bearer ${carrier}`, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(denied.status, 409);
  assert.equal((await db.manifiesto.findUniqueOrThrow({ where: { id: fixture.cases.mismatch.id } })).estado, 'APROBADO');
  writeFileSync(path.join(out, 'legacy-baseline.json'), JSON.stringify({ synthetic: true, agendaStatus: all.status, missingAction: row.action, mismatchServerStatus: denied.status, mismatchHasAllEvents: true, changed: false }, null, 2));
  console.log('Reproducido: una propuesta inválida bloquea la agenda y una propuesta inconsistente falla al intentar retirar.');
} finally { await db.$disconnect(); }
