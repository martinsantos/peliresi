import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'gps-anomaly-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:4177/api';
let ruleId: string | undefined;
async function login(user: string, client: number) {
  const response = await fetch(base + '/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.43.13.${client}` },
    body: JSON.stringify({ email: `${user}@night-qa.invalid`, password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(response.status, 200);
  const body: any = await response.json(); assert.notEqual(body.data.user.training, true);
  return body.data.tokens.accessToken as string;
}
async function waitFor(condition: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 75; attempt++) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('La regla sintética no generó su aviso dentro del tiempo de prueba');
}
try {
  const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: fixture.manifest.id }, select: { numero: true, isDemoData: true } });
  assert.equal(manifest.numero, fixture.manifest.numero); assert.equal(manifest.isDemoData, true);
  const generator = await db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, select: { id: true } });
  const admins = await db.usuario.findMany({ where: { rol: 'ADMIN', activo: true, id: { not: fixture.adminId } }, select: { id: true } });
  assert.ok(admins.length > 0, 'Se necesita un segundo administrador artificial para comprobar el destinatario');
  const ruleName = 'QA regla GPS ' + fixture.manifest.numero;
  const rule = await db.reglaAlerta.create({ data: { nombre: ruleName, evento: 'ANOMALIA_GPS', activa: true,
    condicion: JSON.stringify({ manifiestoId: fixture.manifest.id, tipoAnomalia: 'VELOCIDAD_ANORMAL' }),
    destinatarios: '["GENERADOR"]', creadoPorId: fixture.adminId } });
  ruleId = rule.id;
  const [adminToken, generatorToken] = await Promise.all([login('admin', 1), login('generador', 2)]);
  const detect = () => fetch(`${base}/anomalias/detectar/${fixture.manifest.id}`,
    { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } });
  const requests = await Promise.all(Array.from({ length: 8 }, detect));
  assert.ok(requests.every(response => response.status === 200), 'Análisis concurrentes deben responder correctamente');
  const where = { manifiestoId: fixture.manifest.id, tipo: 'ANOMALIA_DETECTADA', titulo: 'GPS: posible velocidad elevada' };
  assert.equal(await db.anomaliaTransporte.count({ where: { manifiestoId: fixture.manifest.id } }), 1);
  const administrative = await db.notificacion.findMany({ where, select: { usuarioId: true } });
  assert.deepEqual(administrative.map((n: { usuarioId: string }) => n.usuarioId).sort(), admins.map((a: { id: string }) => a.id).sort());
  await waitFor(async () => await db.alertaGenerada.count({ where: { reglaId: rule.id, manifiestoId: fixture.manifest.id } }) === 1
    && await db.notificacion.count({ where: { usuarioId: generator.id, manifiestoId: fixture.manifest.id, titulo: ruleName } }) === 1);
  const ruleCase = await db.alertaGenerada.findFirstOrThrow({ where: { reglaId: rule.id, manifiestoId: fixture.manifest.id } });
  assert.equal(Object.hasOwn(JSON.parse(ruleCase.datos), 'avisosConfirmados'), false);
  const inboxResponse = await fetch(base + '/notificaciones?limit=100', { headers: { Authorization: `Bearer ${generatorToken}` } });
  assert.equal(inboxResponse.status, 200);
  const inbox: any = await inboxResponse.json();
  const received = inbox.data.notificaciones.filter((notice: any) => notice.manifiestoId === fixture.manifest.id && notice.titulo === ruleName);
  assert.equal(received.length, 1); assert.match(received[0].mensaje, /Hora de captura no disponible/);
  assert.equal((await detect()).status, 200);
  assert.equal(await db.anomaliaTransporte.count({ where: { manifiestoId: fixture.manifest.id } }), 1);
  assert.equal(await db.notificacion.count({ where }), admins.length);
  assert.equal(await db.alertaGenerada.count({ where: { reglaId: rule.id, manifiestoId: fixture.manifest.id } }), 1);
  assert.equal(await db.notificacion.count({ where: { usuarioId: generator.id, manifiestoId: fixture.manifest.id, titulo: ruleName } }), 1);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const proof = { synthetic: true, concurrentAnalyses: requests.length, anomalyRows: 1, defaultAdminNotices: administrative.length,
    ruleCases: 1, generatorInboxNotices: 1, duplicateOnRepeat: false, emailAttempts: 0, emailsSent: 0, push: false, capClosed: true };
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'gps-alert-atomic-http-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally {
  if (ruleId) await db.reglaAlerta.updateMany({ where: { id: ruleId }, data: { activa: false } });
  await db.$disconnect();
}
