// Eventual with two external parties -> two antecedents -> chief opens a field case
// from the first -> inspector signs -> chief links the second -> what happens to the signature.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { guard, login, call, fixture, LAB, OUT } from './common.mjs';

const { db, sentBefore } = await guard();
const sharp = createRequire(LAB + '/backend/package.json')('sharp');
const log = [];
const step = (name, data) => { log.push({ name, ...data }); console.log(name, JSON.stringify(data).slice(0, 400)); };
const must = (r, code, name) => { if (r.status !== code) { step('FALLO ' + name, { status: r.status, body: r.body }); throw new Error(name); } return r.body.data; };

const tag = 'rev-' + randomUUID().slice(0, 8);
const gen = await login(fixture.users.generator.email);
const chief = await login(fixture.users.chief.email);
const insp = await login(fixture.users.inspector.email);

// 1. Generator registers an eventual with transportista and operador both outside the padrón.
const eventualId = randomUUID();
const created = must(await call(gen, 'POST', '/api/manifiestos/baja-intensidad', {
  id: eventualId, motivo: 'Revisión aislada ' + tag, patente: '',
  transportista: { nombre: 'Externo transporte ' + tag, identificacion: 'QA-T-' + tag, domicilio: 'Predio artificial T' },
  operador: { nombre: 'Externo operador ' + tag, identificacion: 'QA-O-' + tag, domicilio: 'Predio artificial O' },
  residuos: [{ corriente: 'Y1', cantidad: 1, unidad: 'kg' }],
}), 201, 'crear eventual');
step('eventual', { id: eventualId, etapa: created.registro.etapa });

// 2. Chief sees two antecedents for the same eventual.
const list = must(await call(chief, 'GET', '/api/inspecciones/antecedentes?search=' + encodeURIComponent(eventualId)), 200, 'antecedentes');
const intakes = list.items.filter(i => i.origenId === eventualId).sort((a, b) => a.tipoActor.localeCompare(b.tipoActor));
step('antecedentes', { n: intakes.length, tipos: intakes.map(i => i.tipoActor), nombres: intakes.map(i => i.actorNombre) });
const [first, second] = intakes; // OPERADOR, TRANSPORTISTA

// 3. Chief opens a spontaneous field case from the first antecedent, assigned to the inspector.
const when = new Date(Date.now() + 9 * 86400000); when.setUTCHours(13, 0, 0, 0);
const inspection = must(await call(chief, 'POST', '/api/inspecciones', {
  tipoInspeccion: 'ESPONTANEA', antecedenteId: first.id, inspectorId: fixture.users.inspector.id,
  clienteId: 'rev-' + randomUUID(), fechaProgramada: when.toISOString(), ubicacion: 'Predio artificial ' + tag,
}), 201, 'abrir expediente');
const id = inspection.id;
step('expediente', { id, numero: inspection.numero, estado: inspection.estado, tipoActor: inspection.tipoActor });

// 4. Inspector goes to the field, fills the act and the checklist.
let current = must(await call(insp, 'GET', '/api/inspecciones/' + id), 200, 'detalle');
current = must(await call(insp, 'POST', `/api/inspecciones/${id}/estado`, { estado: 'EN_CAMPO', version: current.version }), 200, 'en campo');
current = must(await call(insp, 'GET', '/api/inspecciones/' + id), 200, 'detalle2');
current = must(await call(insp, 'PATCH', '/api/inspecciones/' + id, { version: current.version, numeroActa: 'ACTA-' + tag, observaciones: 'Observación original ' + tag }), 200, 'acta');
current = must(await call(insp, 'GET', '/api/inspecciones/' + id), 200, 'detalle3');
current = must(await call(insp, 'PATCH', `/api/inspecciones/${id}/items`, { version: current.version, items: current.items.map(i => ({ id: i.id, resultado: 'CUMPLE' })) }), 200, 'checklist');

// 5. Observations emptied then replaced: identity must stay in the header data.
current = must(await call(insp, 'PATCH', '/api/inspecciones/' + id, { version: current.version, observaciones: '' }), 200, 'vaciar');
let view = must(await call(insp, 'GET', `/api/inspecciones/${id}/firma/vista`), 200, 'vista vacia');
step('vista con observaciones vacías', { origenes: view.acta.origenesEventuales?.map(o => o.actorNombre), pendientes: view.pendientes });
current = must(await call(insp, 'GET', '/api/inspecciones/' + id), 200, 'detalle4');
current = must(await call(insp, 'PATCH', '/api/inspecciones/' + id, { version: current.version, observaciones: 'Reemplazo completo ' + tag }), 200, 'reemplazo');
view = must(await call(insp, 'GET', `/api/inspecciones/${id}/firma/vista`), 200, 'vista');
step('vista antes de firmar', { origenes: view.acta.origenesEventuales?.map(o => o.actorNombre), pendientes: view.pendientes, firmas: view.firmas.length });

// 6. Inspected party signs on the inspector's device.
const raw = Buffer.alloc(300 * 100 * 3, 255); for (let x = 20; x < 280; x++) for (let y = 48; y < 52; y++) raw.fill(0, (y * 300 + x) * 3, (y * 300 + x) * 3 + 3);
const png = 'data:image/png;base64,' + (await sharp(raw, { raw: { width: 300, height: 100, channels: 3 } }).png().toBuffer()).toString('base64');
const signed = must(await call(insp, 'POST', `/api/inspecciones/${id}/firmas`, {
  version: view.version, contenidoSha256: view.contenidoSha256, clienteId: randomUUID(), nombre: 'Persona QA ' + tag, documento: 'QA-123',
  caracter: 'Encargado artificial', tipo: 'INSPECCIONADO', imagen: png, lecturaConfirmada: true,
}), 201, 'firmar');
const afterSign = must(await call(insp, 'GET', `/api/inspecciones/${id}/firma/vista`), 200, 'vista firmada');
step('después de firmar', { firmas: afterSign.firmas.length, hash: afterSign.contenidoSha256 === signed.contenidoSha256 });

// 7. Field closed: inspector sends to review (no longer editable, cannot re-sign).
current = must(await call(insp, 'GET', '/api/inspecciones/' + id), 200, 'detalle5');
const review = process.env.STAY_IN_FIELD ? { status: 'omitido', body: { data: { estado: current.estado } } } : await call(insp, 'POST', `/api/inspecciones/${id}/estado`, { estado: 'EN_REVISION', version: current.version });
step('enviar a revisión', { status: review.status, estado: review.body.data?.estado, message: review.body.message });

// 8. Chief links the second external antecedent of the same eventual to this case.
const fresh = must(await call(chief, 'GET', '/api/inspecciones/antecedentes?search=' + encodeURIComponent(eventualId)), 200, 'antecedentes2').items.find(i => i.id === second.id);
const link = await call(chief, 'POST', `/api/inspecciones/antecedentes/${second.id}/decisiones`, { id: randomUUID(), version: fresh.version, accion: 'VINCULADA', motivo: 'Misma operación, segunda parte externa', inspeccionId: id });
step('vinculación tardía', { status: link.status, estado: link.body.data?.estado, message: link.body.message });

// 9. Effect on the act.
const afterLink = must(await call(insp, 'GET', `/api/inspecciones/${id}/firma/vista`), 200, 'vista tras vincular');
step('vista tras vincular', { origenes: afterLink.acta.origenesEventuales?.map(o => o.actorNombre), firmasVigentes: afterLink.firmas.length, hashCambio: afterLink.contenidoSha256 !== signed.contenidoSha256 });
const pdf = await call(insp, 'GET', `/api/inspecciones/${id}/acta.pdf`);
const copy = await call(insp, 'GET', `/api/inspecciones/${id}/firmas/${signed.id}/acta.pdf`);
step('pdfs', { acta: pdf.status, actaBytes: pdf.body.bytes, copiaFirmada: copy.status, copiaBytes: copy.body.bytes });
const resign = await call(insp, 'POST', `/api/inspecciones/${id}/firmas`, {
  version: afterLink.version, contenidoSha256: afterLink.contenidoSha256, clienteId: randomUUID(), nombre: 'Persona QA ' + tag, documento: 'QA-123',
  caracter: 'Encargado artificial', tipo: 'INSPECCIONADO', imagen: png, lecturaConfirmada: true,
});
step('volver a firmar', { status: resign.status, message: resign.body.message });
for (const ev of [eventualId]) {
  const src = await call(insp, 'GET', `/api/inspecciones/${id}/eventuales/${ev}`);
  step('eventual desde inspección', { status: src.status, partes: src.body.data?.partes });
}
const state = { tag, eventualId, inspectionId: id, numero: inspection.numero, firmaId: signed.id, antecedentes: intakes.map(i => i.id) };
fs.writeFileSync(OUT + '/late-link-' + (process.env.TARGET || 'corte') + (process.env.STAY_IN_FIELD ? '-campo' : '') + '-' + tag + '.json', JSON.stringify({ state, log, sentBefore, sentAfter: await db.emailQueue.count({ where: { estado: 'ENVIADO' } }) }, null, 2));
console.log('STATE', JSON.stringify(state));
await db.$disconnect();
