// Read-only authorization matrix over the six QA cases (plus a preview-only second inspector).
import fs from 'node:fs';
import { guard, login, call, ensureSecondInspector, fixture, cases, OUT } from './common.mjs';

const { db, sentBefore } = await guard();
const out = { cases: [], users: {}, matrix: [] };

for (const c of cases) {
  const i = await db.inspeccion.findUnique({ where: { id: c.inspeccion }, select: { numero: true, estado: true, tipoActor: true, inspectorId: true, version: true } });
  const links = await db.antecedenteFiscalizacion.findMany({ where: { inspeccionId: c.inspeccion }, select: { id: true, origen: true, origenId: true, tipoActor: true, actorNombre: true, estado: true } });
  const ev = await db.registroManifiestoExcepcional.findUnique({ where: { id: c.eventual }, select: { etapa: true } });
  const signed = await db.eventoInspeccion.count({ where: { inspeccionId: c.inspeccion, tipo: 'ACTA_FIRMADA' } });
  out.cases.push({ numero: c.numero, inspeccion: i, links, eventual: ev, firmas: signed });
}

const second = await ensureSecondInspector(db);
const accounts = { ...Object.fromEntries(Object.entries(fixture.users).filter(([k]) => !['inactiveChief', 'revokedChief'].includes(k)).map(([k, v]) => [k, v.email])), inspector2: second.email };
const tokens = {};
for (const [k, email] of Object.entries(accounts)) {
  const u = await db.usuario.findUnique({ where: { email }, select: { rol: true, esInspector: true, activo: true, inspectionManagementRole: true } });
  out.users[k] = u;
  try { tokens[k] = await login(email); } catch (e) { out.users[k].login = String(e.message).slice(0, 160); }
}

const [a, b] = cases;
const random = 'cmzzzzzzzzzzzzzzzzzzzzzzz';
const randomUuid = '00000000-0000-4000-8000-000000000000';
const paths = {
  detalle: `/api/inspecciones/${a.inspeccion}`,
  detalleInexistente: `/api/inspecciones/${random}`,
  firmaVista: `/api/inspecciones/${a.inspeccion}/firma/vista`,
  firmaVistaInexistente: `/api/inspecciones/${random}/firma/vista`,
  actaPdf: `/api/inspecciones/${a.inspeccion}/acta.pdf`,
  actaPdfInexistente: `/api/inspecciones/${random}/acta.pdf`,
  expedientePdf: `/api/inspecciones/${a.inspeccion}/expediente.pdf`,
  copiaFirmadaFalsa: `/api/inspecciones/${a.inspeccion}/firmas/${random}/acta.pdf`,
  copiaFirmadaInexistente: `/api/inspecciones/${random}/firmas/${random}/acta.pdf`,
  eventualPropio: `/api/inspecciones/${a.inspeccion}/eventuales/${a.eventual}`,
  eventualAjeno: `/api/inspecciones/${a.inspeccion}/eventuales/${b.eventual}`,
  eventualInexistente: `/api/inspecciones/${a.inspeccion}/eventuales/${randomUuid}`,
  eventualEnInspeccionInexistente: `/api/inspecciones/${random}/eventuales/${a.eventual}`,
  intercambios: `/api/inspecciones/${a.inspeccion}/intercambios`,
  correosActa: `/api/inspecciones/${a.inspeccion}/correos-acta`,
  listado: `/api/inspecciones?limit=50`,
  antecedentes: `/api/inspecciones/antecedentes`,
  participacion: `/api/inspecciones/participacion`,
};
const secrets = [a.numero, ...out.cases[0].links.map(l => l.actorNombre)];
for (const [user, token] of Object.entries(tokens)) {
  for (const [name, path] of Object.entries(paths)) {
    const r = await call(token, 'GET', path);
    const text = JSON.stringify(r.body);
    out.matrix.push({ user, name, status: r.status, message: r.body?.message, revela: secrets.filter(s => text.includes(s)), bytes: r.body?.bytes });
  }
}
out.sentAfter = await db.emailQueue.count({ where: { estado: 'ENVIADO' } });
out.sentBefore = sentBefore;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(OUT + '/authz-' + (process.env.TARGET || 'corte') + '.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.cases, null, 1));
console.log(JSON.stringify(out.users));
for (const name of Object.keys(paths)) console.log(name.padEnd(32), out.matrix.filter(m => m.name === name).map(m => `${m.user}:${m.status}${m.revela.length ? '!' + m.revela.length : ''}`).join(' '));
console.log('mail sent before/after', sentBefore, out.sentAfter);
await db.$disconnect();
