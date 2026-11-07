// Signature and late link fired at the same time: exactly one may win, never both.
// Then the refused antecedent opens its own inspection, as the 409 message suggests.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { guard, login, call, fixture, LAB, OUT } from './common.mjs';

const { db, sentBefore } = await guard();
const sharp = createRequire(LAB + '/backend/package.json')('sharp');
const raw = Buffer.alloc(300 * 100 * 3, 255); for (let x = 20; x < 280; x++) for (let y = 48; y < 52; y++) raw.fill(0, (y * 300 + x) * 3, (y * 300 + x) * 3 + 3);
const png = 'data:image/png;base64,' + (await sharp(raw, { raw: { width: 300, height: 100, channels: 3 } }).png().toBuffer()).toString('base64');
const [gen, chief, insp] = [await login(fixture.users.generator.email), await login(fixture.users.chief.email), await login(fixture.users.inspector.email)];
const rounds = [];
for (let round = 0; round < 4; round++) {
  const tag = 'race-' + randomUUID().slice(0, 8), ev = randomUUID();
  await call(gen, 'POST', '/api/manifiestos/baja-intensidad', { id: ev, motivo: tag, patente: '', residuos: [{ corriente: 'Y1', cantidad: 1, unidad: 'kg' }],
    transportista: { nombre: 'T ' + tag, identificacion: 'T', domicilio: 'T' }, operador: { nombre: 'O ' + tag, identificacion: 'O', domicilio: 'O' } });
  const [a, b] = (await call(chief, 'GET', '/api/inspecciones/antecedentes?search=' + ev)).body.data.items.sort((x, y) => x.tipoActor.localeCompare(y.tipoActor));
  const c = (await call(chief, 'POST', '/api/inspecciones', { tipoInspeccion: 'ESPONTANEA', antecedenteId: a.id, inspectorId: fixture.users.inspector.id, clienteId: 'race-' + randomUUID(), fechaProgramada: new Date(Date.now() + 12 * 864e5).toISOString(), ubicacion: 'Predio ' + tag })).body.data;
  let cur = (await call(insp, 'GET', '/api/inspecciones/' + c.id)).body.data;
  await call(insp, 'POST', `/api/inspecciones/${c.id}/estado`, { estado: 'EN_CAMPO', version: cur.version });
  cur = (await call(insp, 'GET', '/api/inspecciones/' + c.id)).body.data;
  await call(insp, 'PATCH', '/api/inspecciones/' + c.id, { version: cur.version, numeroActa: 'A-' + tag, observaciones: 'Obs ' + tag });
  const view = (await call(insp, 'GET', `/api/inspecciones/${c.id}/firma/vista`)).body.data;
  const bv = (await call(chief, 'GET', '/api/inspecciones/antecedentes?search=' + ev)).body.data.items.find(i => i.id === b.id);
  const [sign, link] = await Promise.all([
    call(insp, 'POST', `/api/inspecciones/${c.id}/firmas`, { version: view.version, contenidoSha256: view.contenidoSha256, clienteId: randomUUID(), nombre: 'Persona ' + tag, documento: 'QA-1', caracter: 'Encargado', tipo: 'INSPECCIONADO', imagen: png, lecturaConfirmada: true }),
    new Promise(res => setTimeout(res, [0, 120, 250, 400][round])).then(() => call(chief, 'POST', `/api/inspecciones/antecedentes/${b.id}/decisiones`, { id: randomUUID(), version: bv.version, accion: 'VINCULADA', motivo: 'Carrera', inspeccionId: c.id })),
  ]);
  const after = (await call(insp, 'GET', `/api/inspecciones/${c.id}/firma/vista`)).body.data;
  const signatures = await db.eventoInspeccion.count({ where: { inspeccionId: c.id, tipo: 'ACTA_FIRMADA' } });
  const r = { round, sign: sign.status, link: link.status, firmasGuardadas: signatures, firmasVigentes: after.firmas.length, origenes: after.acta.origenesEventuales.length };
  // Invariant: a stored signature is always current (never voided by the link).
  r.ok = (sign.status === 201) !== (link.status === 200) && signatures === after.firmas.length;
  if (link.status !== 200) {
    const fresh = (await call(chief, 'GET', '/api/inspecciones/antecedentes?search=' + ev)).body.data.items.find(i => i.id === b.id);
    const opened = await call(chief, 'POST', '/api/inspecciones', { tipoInspeccion: 'ESPONTANEA', antecedenteId: fresh.id, inspectorId: fixture.users.inspector.id, clienteId: 'race-' + randomUUID(), ubicacion: 'Predio ' + tag });
    r.nuevaInspeccion = opened.status + ' ' + (opened.body.data?.numero || opened.body.message);
  }
  rounds.push(r); console.log(JSON.stringify(r));
}
fs.writeFileSync(OUT + '/carrera-firma-vinculo.json', JSON.stringify({ rounds, sentBefore, sentAfter: await db.emailQueue.count({ where: { estado: 'ENVIADO' } }) }, null, 2));
console.log('todas ok', rounds.every(r => r.ok));
await db.$disconnect();
