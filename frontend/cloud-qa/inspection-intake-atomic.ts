import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'inspection_intake_20261020');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const f = JSON.parse(readFileSync(process.env.QA_ARTIFACTS + '/intake-fixture.json', 'utf8'));
const id = randomUUID(), marker = 'QA-ROLLBACK-' + id;
try {
  const source = await db.manifiesto.findUniqueOrThrow({ where: { id: f.http.finding.id }, include: { residuos: true } });
  const manifest = await db.manifiesto.create({ data: { numero: marker, estado: 'RECIBIDO', generadorId: source.generadorId, transportistaId: source.transportistaId,
    operadorId: source.operadorId, creadoPorId: source.creadoPorId, isDemoData: true, residuos: { create: source.residuos.map((row: any) => ({ tipoResiduoId: row.tipoResiduoId, cantidad: row.cantidad, unidad: row.unidad, estado: row.estado })) } } });
  const login = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'operator@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) }); assert.equal(login.status, 200);
  const token = (await login.json()).data.tokens.accessToken;
  await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION inspection_intake_20261020.qa_reject_intake() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.evidencia->>'motivo' LIKE 'QA-ROLLBACK-%' THEN RAISE EXCEPTION 'Artificial QA transaction failure'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe('CREATE TRIGGER qa_intake_failure BEFORE INSERT ON antecedentes_fiscalizacion FOR EACH ROW EXECUTE FUNCTION inspection_intake_20261020.qa_reject_intake()');
  const command = { id, motivo: marker, residuos: [{ corriente: 'Y1', cantidad: 12, unidad: 'kg' }, { corriente: 'Y21', cantidad: 3, unidad: 'kg' }] };
  const send = () => fetch(`http://127.0.0.1:3037/api/manifiestos/${manifest.id}/adendas`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
  try { assert.equal((await send()).status, 500); }
  finally { await db.$executeRawUnsafe('ALTER TABLE antecedentes_fiscalizacion DISABLE TRIGGER qa_intake_failure'); }
  assert.equal(await db.adendaManifiesto.findUnique({ where: { id } }), null);
  assert.equal(await db.antecedenteFiscalizacion.count({ where: { origenId: id } }), 0);
  assert.equal(await db.notificacion.count({ where: { datos: { contains: id } } }), 0);
  assert.equal((await send()).status, 201); assert.equal((await send()).status, 201);
  assert.equal(await db.antecedenteFiscalizacion.count({ where: { origenId: id } }), 2);
  const after = await db.manifiesto.findUniqueOrThrow({ where: { id: manifest.id } }); assert.deepEqual(after, manifest);
  writeFileSync(process.env.QA_ARTIFACTS + '/atomic.json', JSON.stringify({ passed: 3, checks: ['forced intake failure rolls back report and notices', 'same command succeeds after restoring only the QA trigger', 'replay keeps one source-role and original manifest'], production: false }, null, 2));
  console.log('Atomic rollback and retry: 3 groups PASS.');
} finally { await db.$disconnect(); }
