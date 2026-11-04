import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-followup-notice-20261030'; assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const mail = backendRequire(path.join(root, 'backend/dist-qa-followup-notice-20261030/services/notification-mail.service.js'));
async function token(email: string): Promise<string> {
  assert.match(email, /@night-qa\.invalid$/);
  const r = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(r.status, 200); return (await r.json() as any).data.tokens.accessToken;
}
try {
  const [owner, generator, carrier, admin] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'draft-multirole-20261024@night-qa.invalid' }, include: { operador: true } }),
    db.generador.findFirstOrThrow({ where: { usuario: { email: 'generador@night-qa.invalid' } } }),
    db.transportista.findFirstOrThrow({ where: { usuario: { email: 'transportista@night-qa.invalid' } } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
  ]);
  assert.equal(owner.rol, 'GENERADOR'); assert.ok(owner.operador?.activo); assert.match(admin.email, /@night-qa\.invalid$/);
  assert.ok(await db.solicitudInscripcion.findFirst({ where: { usuarioId: owner.id, tipoActor: 'OPERADOR', operadorId: owner.operador.id, estado: 'APROBADA' } }));
  const run = randomUUID();
  const manifest = await db.manifiesto.create({ data: { numero: 'QA-SEGUIMIENTO-' + run.slice(0, 8),
    generadorId: generator.id, transportistaId: carrier.id, operadorId: owner.operador.id, creadoPorId: generator.usuarioId,
    estado: 'RECIBIDO', modalidad: 'FIJO', isDemoData: false, fechaRecepcion: new Date() } });
  const rule = await db.reglaAlerta.create({ data: { id: 'qa-rule-' + run, nombre: 'QA seguimiento', evento: 'TIEMPO_EXCESIVO',
    condicion: '{"tipo":"seguimiento_cierre","diasRecepcion":{"gte":0}}', destinatarios: '["OPERADOR"]', creadoPorId: admin.id } });
  const datos = { tipo: 'seguimiento_cierre', version: 1, estadoDetectado: 'RECIBIDO', casoId: 'qa-case-' + run, reglaId: rule.id };
  await db.alertaGenerada.create({ data: { id: datos.casoId, reglaId: rule.id, manifiestoId: manifest.id, datos: JSON.stringify(datos) } });
  const records = [];
  for (const [key, tipo, payload] of [['seguimiento', 'INFO_GENERAL', datos], ['incidente', 'INCIDENTE_REPORTADO', {}]] as const) {
    const notice = await db.notificacion.create({ data: { id: 'qa-' + key + '-' + run, usuarioId: owner.id, manifiestoId: manifest.id,
      tipo, titulo: 'QA aviso ' + key, mensaje: manifest.numero + ' · registro artificial', datos: JSON.stringify(payload) } });
    const source = { ...notice, email: owner.email, activo: owner.activo, emailVerified: owner.emailVerified, notifEmail: owner.notifEmail, rol: owner.rol };
    assert.equal(await mail.notificationSourceEligible(source, 'alertas'), true);
    if (key === 'seguimiento') {
      try {
        await db.alertaGenerada.update({ where: { id: datos.casoId }, data: { estado: 'DESCARTADA' } });
        assert.equal(await mail.notificationSourceEligible(source, 'alertas'), false);
      } finally { await db.alertaGenerada.update({ where: { id: datos.casoId }, data: { estado: 'PENDIENTE' } }); }
    }
    const rendered = mail.notificationMailContent(source); assert.ok(rendered?.html);
    assert.match(rendered.html, new RegExp('/notificaciones/' + notice.id));
    writeFileSync(path.join(out, key + '-mail.html'), rendered.html);
    records.push({ key, notice: notice.id, title: notice.titulo });
  }
  const access = await token(owner.email), foreign = await token('generador2@night-qa.invalid');
  const get = (pathname: string, bearer: string, activity?: string) => fetch('http://127.0.0.1:3037/api' + pathname, {
    headers: { Authorization: 'Bearer ' + bearer, ...(activity ? { 'X-SITREP-Activity': activity } : {}) } });
  assert.equal((await get('/manifiestos/' + manifest.id, access, 'GENERADOR')).status, 404);
  assert.equal((await get('/manifiestos/' + manifest.id, access, 'OPERADOR')).status, 200);
  for (const item of records) assert.equal((await get('/notificaciones/' + item.notice, foreign)).status, 404);
  writeFileSync(path.join(out, 'fixture.json'), JSON.stringify({ synthetic: true, email: owner.email, manifestId: manifest.id, numero: manifest.numero, records }));
  console.log('Seguimiento e incidente artificiales: rol correcto 200, rol incorrecto y cuenta ajena 404; caso descartado no elegible para correo.');
} finally { await db.$disconnect(); }
