import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = new URL('../../docs/manual/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), 'utf8');
const context = { window: {} as any };
runInNewContext(read('help-data.js'), context);
const { profiles, guides } = context.window.SITREP_HELP;
function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'JPEG signature');
  let index = 2;
  while (index + 8 < bytes.length) {
    assert.equal(bytes[index++], 0xff, 'JPEG marker');
    while (bytes[index] === 0xff) index++;
    const marker = bytes[index++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    const size = bytes.readUInt16BE(index);
    assert.ok(size >= 2 && index + size <= bytes.length, 'JPEG segment');
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: bytes.readUInt16BE(index + 3), width: bytes.readUInt16BE(index + 5) };
    }
    index += size;
  }
  throw new Error('JPEG dimensions not found');
}
test('PSIP explains the existing follow-up loop for both parties without promising external delivery', () => {
  const guide = guides.find((item: any) => item.id === 'psip-flujo-inspecciones');
  assert.ok(guide); assert.ok(guide.steps.length >= 7);
  assert.deepEqual(Array.from(guide.audiences), ['administrador', 'inspector', 'generador', 'transportista', 'operador', 'auditor']);
  const content = JSON.stringify(guide);
  for (const text of ['Notificada', 'En descargo', 'Requiere subsanación', 'Cerrada conforme', 'los correos se simulan', 'push sigue apagado', 'fuera de plazo', 'responsable', 'CAP sigue cerrado']) assert.ok(content.includes(text), text);
  assert.match(content, /genera un aviso en la campana/);
  assert.match(content, /Leer el aviso no responde ni aprueba/);
  assert.ok(guide.steps.filter((step: any) => step.image).length >= 3);
});
test('PSIP screenshots are original synthetic preview captures from successful browser tests', () => {
  const proof = JSON.parse(read('psip-capture-provenance.json'));
  assert.equal(proof.synthetic, true); assert.equal(proof.productionCapture, false); assert.equal(proof.edited, false);
  assert.equal(proof.files.length, 3); assert.equal(proof.browserTestsPassed, 18);
  const guide = guides.find((item: any) => item.id === 'psip-flujo-inspecciones');
  for (const item of proof.files) {
    const bytes = readFileSync(new URL('screenshots/' + item.file, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
    assert.equal(bytes.readUInt32BE(16), item.width); assert.equal(bytes.readUInt32BE(20), item.height);
    const step = guide.steps.find((value: any) => value.image === 'screenshots/' + item.file);
    assert.ok(step); assert.match(step.caption, /Datos sintéticos/);
  }
});
test('simultaneous loads and device notices have unedited synthetic captures and distinct delivery semantics',()=>{
  const proof=JSON.parse(read('fleet-gps-capture-provenance.json'));
  assert.equal(proof.synthetic,true);assert.equal(proof.productionCapture,false);assert.equal(proof.edited,false);assert.equal(proof.browserTestsPassed,2);
  const loads=guides.find((g:any)=>g.id==='transporte-cargas-simultaneas'),notices=guides.find((g:any)=>g.id==='manifiestos-avisos');
  assert.equal(loads.steps.filter((s:any)=>s.image).length,2);
  assert.ok(notices.steps.some((s:any)=>s.image==='screenshots/mobile/device-notifications-20261019.png'));
  assert.match(JSON.stringify(loads),/las cargas ya elegidas/);assert.match(JSON.stringify(loads),/otras cargas siguen viajando/);
  assert.match(JSON.stringify(notices),/un aviso guardado no acredita una entrega externa/);
  for(const item of proof.files){const bytes=readFileSync(new URL('screenshots/'+item.file,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);assert.equal(bytes.readUInt32BE(16),item.width);assert.equal(bytes.readUInt32BE(20),item.height);}
});
test('handoff guide uses original synthetic captures and distinguishes delegated GPS from user access',()=>{
  const proof=JSON.parse(read('transport-handoff-capture-provenance.json'));
  assert.equal(proof.synthetic,true);assert.equal(proof.productionCapture,false);assert.equal(proof.edited,false);assert.equal(proof.gpsEmulated,true);
  const guide=guides.find((g:any)=>g.id==='transporte-relevo');assert.ok(guide);
  assert.equal(guide.steps.filter((s:any)=>s.image).length,3);
  assert.match(JSON.stringify(guide),/transportista del manifiesto original/);assert.match(JSON.stringify(guide),/No necesita una cuenta/);
  for(const item of proof.files){const bytes=readFileSync(new URL('screenshots/'+item.file,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);assert.equal(bytes.readUInt32BE(16),item.width);assert.equal(bytes.readUInt32BE(20),item.height);}
});

test('new operational guides include relevant reusable captures, not text-only walkthroughs', () => {
  const minimums: Record<string, number> = {
    'capacitacion-por-rol': 5, 'alta-borradores-ocr': 4,
    'soporte-enviar-seguir': 3, 'soporte-gestionar': 3,
    'actor-mis-inspecciones': 3, 'inspector-completar-inspeccion': 7,
  };
  for (const [id, minimum] of Object.entries(minimums)) {
    const guide = guides.find((g: any) => g.id === id);
    assert.ok(guide.steps.filter((s: any) => s.image && s.alt).length >= minimum, id);
  }
  const provenance = JSON.parse(read('training-capture-provenance.json'));
  const replacement = JSON.parse(read('actor-onboarding-capture-provenance.json'));
  const requirementReplacement = JSON.parse(read('psip-actor-capture-provenance.json'));
  assert.equal(provenance.synthetic, true);
  assert.equal(provenance.productionCapture, false);
  assert.equal(provenance.edited, false);
  assert.equal(provenance.files.length, 13);
  for (const item of provenance.files) {
    const bytes = readFileSync(new URL('screenshots/' + item.file, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
    assert.equal(bytes.readUInt32BE(16), item.width);
    assert.equal(bytes.readUInt32BE(20), item.height);
    const steps = guides.flatMap((g: any) => g.steps).filter((s: any) => s.image === 'screenshots/' + item.file);
    const owner = replacement.supersedes.some((entry: any) => entry.file === item.file) ? replacement : requirementReplacement;
    const superseded = owner.supersedes.find((entry: any) => entry.file === item.file);
    if (superseded) {
      assert.equal(steps.length, 0, 'A superseded capture stays archived, without illustrating the current flow');
      assert.ok(owner.files.some((entry: any) => entry.file === superseded.replacement));
      assert.ok(guides.find((g: any) => g.id === superseded.guide).steps.some((s: any) => s.image === 'screenshots/' + superseded.replacement));
    } else assert.ok(steps.length, item.file + ' must be used');
    for (const step of steps) assert.match(step.caption, /Datos sintéticos/);
  }
});

test('actor inspection guide does not grant access to general inspections or authority decisions', () => {
  const guide = guides.find((g: any) => g.id === 'actor-mis-inspecciones');
  assert.deepEqual(Array.from(guide.audiences), ['generador', 'transportista', 'operador']);
  assert.match(JSON.stringify(guide), /No ve los borradores/);
  assert.match(JSON.stringify(guide), /no aprueba ni cierra/);
  assert.match(JSON.stringify(guide), /no habilita nuevas respuestas/);
  assert.match(JSON.stringify(guide), /no al módulo general de Inspecciones/);
  const proof = JSON.parse(read('psip-actor-capture-provenance.json'));
  assert.equal(proof.synthetic, true); assert.equal(proof.productionCapture, false);
  assert.equal(proof.edited, false); assert.equal(proof.physicalAndroid, false);
  assert.equal(proof.files.length, 3);
  for (const [index, file] of proof.files.entries()) {
    const bytes = readFileSync(new URL('screenshots/' + file.file, root));
    assert.equal(file.mime, 'image/jpeg'); assert.match(file.file, /\.jpg$/);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    assert.deepEqual(jpegDimensions(bytes), { width: file.width, height: file.height });
    assert.equal(guide.steps[index].image, 'screenshots/' + file.file);
    assert.match(guide.steps[index].caption, /artificial/);
    assert.match(guide.steps[index].caption, /Android físico pendiente/);
  }
});

test('audit guidance separates certificate configuration from issuance and preserves the recorded wording', () => {
  const guide = guides.find((g: any) => g.id === 'auditor-consultar-actividad');
  const text = JSON.stringify(guide);
  for (const phrase of ['Gestión de certificados configurada', 'no que se emitió un documento',
    'Texto original registrado', 'columna Aclaración', 'búsqueda de texto se limita a la página visible',
    'CSV descarga sólo los registros visibles de la página actual']) assert.ok(text.includes(phrase), phrase);
});

test('certificate and addendum guides explain the approved rectification without erasing the observation', () => {
  const cert = JSON.stringify(guides.find((g: any) => g.id === 'certificados-operador-partes'));
  const adenda = JSON.stringify(guides.find((g: any) => g.id === 'adendas-hallazgos-partes'));
  assert.ok(cert.includes('Una rectificación aprobada resuelve la observación'));
  assert.ok(cert.includes('Otras adendas pendientes o rechazadas siguen requiriendo resolución'));
  assert.ok(adenda.includes('la observación anterior deja de bloquear la certificación final'));
  assert.ok(adenda.includes('queda como antecedente observado'));
});

test('public trial screenshot is unedited, anonymous and explicitly separate from an actual application', () => {
  const p = JSON.parse(read('registration-capture-provenance.json'));
  assert.equal(p.authenticated, false); assert.equal(p.synthetic, true);
  assert.equal(p.businessDataWritten, false); assert.equal(p.edited, false);
  const bytes = readFileSync(new URL('screenshots/' + p.file, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), p.sha256);
  assert.equal(bytes.readUInt32BE(16), p.width); assert.equal(bytes.readUInt32BE(20), p.height);
  const step = guides.find((g: any) => g.id === 'alta-borradores-ocr').steps[0];
  assert.equal(step.image, 'screenshots/' + p.file);
  assert.match(step.caption, /Datos sintéticos/); assert.match(step.alt, /Prueba sin envío/);
});

test('OCR evidence is an unedited real trial with synthetic data, not approval or persistent upload', () => {
  const p = JSON.parse(read('ocr-capture-provenance.json'));
  assert.equal(p.flowStatus, 'PASS');
  assert.equal(p.synthetic, true); assert.equal(p.edited, false);
  assert.equal(p.businessDataWritten, false); assert.equal(p.persistido, false);
  assert.equal(p.authenticated, false); assert.equal(p.ocr, 'TESSERACT');
  assert.equal(p.draftRecovered, true);
  const bytes = readFileSync(new URL('screenshots/' + p.file, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), p.sha256);
  assert.equal(bytes.readUInt32BE(16), p.width); assert.equal(bytes.readUInt32BE(20), p.height);
  // The 2026-10-12 licence image is retained as historical evidence; the
  // current guide illustrates the separately verified synthetic bill instead.
  const step = guides.find((g: any) => g.id === 'alta-borradores-ocr').steps.find((s: any) => s.title === 'Cargar documentos y revisar OCR');
  assert.ok(step);
  assert.match(step.caption, /Factura artificial/);
  assert.match(step.alt, /Factura eléctrica/);
  const current = JSON.parse(read('electricity-capture-provenance.json'));
  assert.equal(current.synthetic, true); assert.equal(current.productionCapture, false);
  assert.equal(current.edited, false); assert.equal(current.physicalAndroid, false);
  const currentBytes = readFileSync(new URL('screenshots/' + current.file, root));
  assert.equal(current.mime, 'image/jpeg'); assert.match(current.file, /\.jpg$/);
  assert.equal(createHash('sha256').update(currentBytes).digest('hex'), current.sha256);
  assert.deepEqual(jpegDimensions(currentBytes), { width: current.width, height: current.height });
  assert.equal(step.image, 'screenshots/' + current.file);
});

test('guides have unique identities, useful steps and existing evidence', () => {
  assert.equal(new Set(guides.map((g: any) => g.id)).size, guides.length);
  for (const guide of guides) {
    assert.ok(profiles.some((p: any) => p.id === guide.profile));
    for (const audience of guide.audiences || []) assert.ok(profiles.some((p: any) => p.id === audience));
    if (guide.id === 'documentos-identidad-integridad') assert.ok(guide.steps.length >= 2, guide.id);
    else assert.ok(guide.steps.length >= 3, guide.id);
    for (const step of guide.steps) {
      assert.ok(step.title && step.expected && step.body.length, guide.id);
      if (step.image) assert.ok(existsSync(fileURLToPath(new URL(step.image, root))), step.image);
    }
  }
});

test('images displayed in the manual use an extension matching their file contents', () => {
  const sources = new Set<string>();
  for (const guide of guides) for (const step of guide.steps) if (step.image) sources.add(step.image);
  for (const match of read('directorio.html').matchAll(/<img\s+src="(screenshots\/[^"]+)"/g)) sources.add(match[1]);
  for (const source of sources) {
    const bytes = readFileSync(new URL(source, root));
    if (bytes.readUInt16BE(0) === 0xffd8) assert.match(source, /\.jpe?g$/i, source + ' contains JPEG');
    else if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) assert.match(source, /\.png$/i, source + ' contains PNG');
    else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') assert.match(source, /\.webp$/i, source + ' contains WebP');
    else assert.fail(source + ' is not a recognized manual image');
  }
});

test('MIME aliases preserve the original evidence bytes and replace active references', () => {
  const aliases = JSON.parse(read('image-mime-aliases-20261027.json'));
  assert.equal(aliases.syntheticCapturesUnchanged, true);
  assert.ok(aliases.files.length > 0);
  assert.equal(new Set(aliases.files.map((file: any) => file.previous)).size, aliases.files.length);
  const active = read('help-data.js') + read('directorio.html');
  for (const file of aliases.files) {
    const old = readFileSync(new URL(file.previous, root));
    const current = readFileSync(new URL(file.current, root));
    assert.match(file.previous, /\.png$/); assert.match(file.current, /\.jpg$/);
    assert.equal(current.readUInt16BE(0), 0xffd8);
    assert.ok(old.equals(current), file.previous);
    assert.equal(createHash('sha256').update(current).digest('hex'), file.sha256);
    assert.ok(active.includes(file.current.replace(/^screenshots\//, '')), file.current);
    assert.ok(!active.includes(file.previous.replace(/^screenshots\//, '')), file.previous);
  }
});

test('training, registration, support and migration are searchable, with safety boundaries', () => {
  for (const id of ['capacitacion-por-rol', 'alta-borradores-ocr', 'soporte-enviar-seguir', 'soporte-gestionar', 'cambio-dominio']) {
    const guide = guides.find((g: any) => g.id === id);
    assert.ok(guide, id);
    assert.ok(guide.safety, id);
  }
  const registration = guides.find((g: any) => g.id === 'alta-borradores-ocr');
  assert.ok(registration.audiences.includes('transportista'));
  assert.match(JSON.stringify(registration), /archivos.*no|no.*archivos/i);
  const support = guides.find((g: any) => g.id === 'soporte-enviar-seguir');
  assert.ok(support.keywords.includes('ticket'));
  const migration = JSON.stringify(guides.find((g: any) => g.id === 'cambio-dominio'));
  assert.match(migration, /sitrep\.mendoza\.gov\.ar/);
  assert.match(migration, /no se trasladan automáticamente/);
});

test('manual operational links remain on the installation origin, including the future domain', () => {
  for (const name of ['index.html', 'search.html', 'tutorial.html', 'directorio.html']) {
    const html = read(name);
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1];
      assert.doesNotMatch(href, /https?:\/\/(?:rptrazar\.mendoza\.gov\.ar|sitrep\.ultimamilla\.com\.ar|sitrep\.mendoza\.gov\.ar)/, name);
      if (/^(?:https?:|mailto:|tel:|#)/.test(href)) continue;
      for (const origin of ['https://sitrep.ultimamilla.com.ar', 'https://sitrep.mendoza.gov.ar']) {
        assert.equal(new URL(href, `${origin}/manual/${name}`).origin, origin);
      }
    }
  }
});

test('training does not present another server dataset or destructive resets as current instructions', () => {
  const html = read('directorio.html');
  const training = html.split('<section id="capacitacion-qa"')[1].split('</section>')[0];
  assert.doesNotMatch(training, /CAP-20260923|resetear|9\/9/i);
  assert.match(training, /solo lectura/i);
  assert.doesNotMatch(html, /href="[^"]*cmuegqi/);
  assert.doesNotMatch(html, /<td>Texto libre<\/td>/);
});

test('classroom records keep five teams and distinct actor/authority views', () => {
  const workshop = guides.find((g: any) => g.id === 'capacitacion-por-rol');
  assert.equal(workshop.steps.length, 6);
  assert.match(workshop.steps[0].body.join(' '), /enlaces no inician sesión ni cambian el rol/);
  assert.match(workshop.steps[0].body.join(' '), /Equipo 5: reserva/);
  assert.match(workshop.steps[2].body.join(' '), /número conserva/);
  for (const index of [2, 3, 4]) {
    assert.equal(workshop.steps[index].teams.length, 5);
    for (const [i, team] of workshop.steps[index].teams.entries()) {
      const n = i + 1;
      assert.equal(team.label, 'Equipo ' + n);
      for (const r of team.records) assert.match(r.path, new RegExp('cap-20261012-(?:manifiesto-' + n + '-|inspeccion-' + n + '-|participacion-' + n + '-|ticket-(?:generador|transportista|operador)-' + n + '$)'));
      if (index === 2) assert.deepEqual(Array.from(team.records, (r: any) => r.path), ['BORRADOR', 'APROBADO', 'TRATADO'].map(s => '/manifiestos/cap-20261012-manifiesto-' + n + '-' + s));
      if (index === 3) {
        assert.equal(team.records[0].path, '/inspecciones/cap-20261012-inspeccion-' + n + '-GENERADOR');
        for (const role of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) {
          const id = 'cap-20261012-participacion-' + n + '-' + role + '-abierta';
          assert.ok(team.records.some((r: any) => r.path === '/requerimientos/' + id));
          assert.ok(team.records.some((r: any) => r.path === '/inspecciones/' + id));
          assert.ok(!team.records.some((r: any) => r.path === '/mis-inspecciones/' + id));
        }
      }
    }
  }
});

test('all classroom links remain on the current/future domain; trial stays trial', () => {
  const workshop = guides.find((g: any) => g.id === 'capacitacion-por-rol');
  const resources = workshop.steps.flatMap((s: any) => [...(s.resources || []), ...(s.teams || []).flatMap((t: any) => t.records)]);
  assert.equal(resources.length, 76);
  assert.equal(resources.filter((r: any) => r.href === '/manual/tutorial.html?guide=capacitacion-cuatro-telefonos').length, 1);
  for (const r of resources) {
    const href = r.path || r.href;
    assert.match(href, /^\/(?!\/)[a-zA-Z0-9/?=&._-]+$/);
    for (const origin of ['https://sitrep.ultimamilla.com.ar', 'https://sitrep.mendoza.gov.ar']) {
      assert.equal(new URL(href, origin).origin, origin);
      if (r.path) assert.equal(new URL('/app' + href, origin).origin, origin);
    }
    if (href.startsWith('/inscripcion/')) assert.equal(new URL(href, 'https://example.invalid').searchParams.get('modo'), 'revision');
  }
  const fixture = resources.find((r: any) => r.download);
  assert.equal(fixture.href, '/manual/fixtures/licencia-capacitacion.png');
  assert.ok(existsSync(fileURLToPath(new URL('fixtures/licencia-capacitacion.png', root))));
});


test('classroom new features explain incomplete identities, registered fleet and preserved declarations', () => {
  const guide = guides.find((g: any) => g.id === 'capacitacion-novedades');
  assert.equal(guide.steps.length, 4);
  assert.match(guide.safety, /siguen apagadas en la operación real/);
  assert.match(JSON.stringify(guide), /no inventes datos/i);
  assert.match(JSON.stringify(guide), /otra.*conserva el antecedente/);
  assert.match(JSON.stringify(guide), /no se aprueba a sí mismo/);
  assert.match(JSON.stringify(guide), /no se reemplazan|elegilas otra vez/);
  assert.equal(guide.steps[0].resources[0].path, '/switch-user?modo=capacitacion');
  assert.match(read('index.html'), /guide=capacitacion-novedades/);
});


test('four phones retain their roles and follow one new case through GPS and closure', () => {
  const guide = guides.find((g: any) => g.id === 'capacitacion-cuatro-telefonos');
  assert.equal(guide.steps.length, 7);
  assert.match(guide.safety, /No se necesita la cuenta administradora personal/);
  assert.match(guide.steps[0].body.join(' '), /perfiles de navegador independientes/);
  assert.match(guide.steps[0].body.join(' '), /no certifica GPS físico/);
  assert.match(guide.steps[2].body.join(' '), /Sync/);
  assert.match(guide.steps[3].body.join(' '), /Hoy → Viajes Activos/);
  assert.match(guide.steps[5].body.join(' '), /Los cuatro deben ver Tratado/);
  assert.match(read('index.html'), /guide=capacitacion-cuatro-telefonos/);
});


test('classroom new proposals separate authorship, three decisions, agenda and signed releases', () => {
  const guide=guides.find((g:any)=>g.id==='capacitacion-cuatro-telefonos');
  const text=JSON.stringify(guide);
  assert.match(text,/Puede iniciar cualquiera: operador, transporte, generador o administrador CAP/);
  assert.match(text,/Sólo con las tres aprobaciones/);
  assert.match(text,/Manifiestos pendientes/);
  assert.match(text,/Por aprobar, En espera o En curso/);
  assert.match(text,/Iniciar coordinación/);
  assert.match(text,/Activar sonido/);
  assert.match(text,/Tratado no libera automáticamente/);
  assert.match(text,/todas las adendas aprobadas/);
  assert.match(text,/CAPACITACIÓN — SIN VALIDEZ OFICIAL/);
});
