/** Negative API checks on the existing synthetic UI case. Never creates a certificate. */
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:4177/api', id = 'cmvqqdy3y00ncsts65zv1hnj4';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
try {
  const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id }, include: { residuos: { include: { tipoResiduo: true } }, operador: { include: { usuario: true } } } });
  assert.equal(manifest.isDemoData, true);
  assert.equal(manifest.numero, '2026-000159');
  assert.equal(manifest.estado, 'TRATADO');
  assert.equal(manifest.operador.usuario.email, 'operador@night-qa.invalid');
  assert.ok(manifest.residuos.every((row: { cantidadRecibida: number | null }) => row.cantidadRecibida));
  const getAddenda = () => db.adendaManifiesto.findMany({ where: { manifiestoId: id }, orderBy: { id: 'asc' } });
  const before = { manifest: hash(manifest), addenda: hash(await getAddenda()),
    certificates: await db.certificadoManifiesto.count({ where: { manifiestoId: id } }),
    notices: await db.notificacion.count({ where: { manifiestoId: id } }) };
  assert.equal(await db.certificadoManifiesto.count({ where: { manifiestoId: id, tipo: 'FINAL' } }), 0);
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.42.20.1' },
    body: JSON.stringify({ email: 'operador@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(login.status, 200);
  const auth: any = await login.json(), token = auth.data.tokens.accessToken;
  assert.notEqual(auth.data.user.training, true);
  const endpoint = base + '/manifiestos/' + id + '/certificados';
  const ready = await fetch(endpoint, { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(ready.status, 200);
  const listing: any = await ready.json();
  assert.equal(listing.adendasSinResolver, 0);
  assert.deepEqual(listing.problemasHallazgos, []);
  assert.equal(listing.hallazgos.length, 1);
  assert.match(listing.hallazgos[0].id, /^hallazgo:Y12:kg$/);
  assert.equal(listing.hallazgos[0].observado, 1);
  const sharp = backendRequire('sharp');
  const firma = 'data:image/png;base64,' + (await sharp(Buffer.from('<svg width="300" height="100"><rect width="300" height="100" fill="white"/><path d="M10 70 L40 20 L80 75 L120 15 L180 80 L270 30" stroke="black" stroke-width="3" fill="none"/></svg>')).png().toBuffer()).toString('base64');
  const baseCommand = { tipo: 'FINAL', firma, metodo: 'QA tratamiento artificial', nota: 'Prueba sintética sin emisión',
    cantidades: manifest.residuos.map((r: any) => ({ residuoId: r.id, cantidad: r.cantidadRecibida })) };
  const reject = async (body: object, status: number, message: RegExp) => {
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, id: randomUUID() }) });
    const result: any = await response.json();
    assert.equal(response.status, status);
    assert.match(String(result.message), message);
  };
  await reject(baseCommand, 409, /Indicá si cada corriente hallada/);
  await reject({ ...baseCommand, cantidades: [...baseCommand.cantidades, { residuoId: listing.hallazgos[0].id, cantidad: 2 }] }, 409, /observado/);
  await reject({ ...baseCommand, cantidades: [...baseCommand.cantidades, { residuoId: listing.hallazgos[0].id, cantidad: 1 }], exclusionesHallazgos: [listing.hallazgos[0].id] }, 400, /tratado y excluido/);
  await reject({ ...baseCommand, exclusionesHallazgos: ['hallazgo:Y99:kg'] }, 409, /Revisá las corrientes/);
  const after = { manifest: hash(await db.manifiesto.findUniqueOrThrow({ where: { id }, include: { residuos: { include: { tipoResiduo: true } }, operador: { include: { usuario: true } } } })),
    addenda: hash(await getAddenda()), certificates: await db.certificadoManifiesto.count({ where: { manifiestoId: id } }),
    notices: await db.notificacion.count({ where: { manifiestoId: id } }) };
  assert.deepEqual(after, before);
  const result = { at: new Date().toISOString(), manifest: manifest.numero, checks: ['rectificación resuelta y Y12 visible',
    'no permite omitir la decisión', 'no certifica más que lo observado', 'no permite tratar y excluir a la vez',
    'no acepta un hallazgo ajeno', 'sin nuevos certificados ni avisos ni cambios en los antecedentes'] };
  writeFileSync(process.env.QA_ARTIFACTS! + '/certificate-findings-negative.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
