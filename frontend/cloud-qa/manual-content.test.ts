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
    assert.ok(steps.length, item.file + ' must be used');
    for (const step of steps) assert.match(step.caption, /Datos sintéticos/);
  }
});

test('actor inspection guide does not grant access to general inspections or authority decisions', () => {
  const guide = guides.find((g: any) => g.id === 'actor-mis-inspecciones');
  assert.deepEqual(Array.from(guide.audiences), ['generador', 'transportista', 'operador']);
  assert.match(JSON.stringify(guide), /No ve los borradores/);
  assert.match(JSON.stringify(guide), /no aprueba ni cierra/);
  assert.match(JSON.stringify(guide), /no habilita nuevas respuestas/);
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
  const step = guides.find((g: any) => g.id === 'alta-borradores-ocr').steps[1];
  assert.equal(step.image, 'screenshots/' + p.file);
  assert.match(step.caption, /Datos sintéticos/); assert.match(step.caption, /no aprueba/);
  assert.match(step.alt, /seleccionables/);
});

test('guides have unique identities, useful steps and existing evidence', () => {
  assert.equal(new Set(guides.map((g: any) => g.id)).size, guides.length);
  for (const guide of guides) {
    assert.ok(profiles.some((p: any) => p.id === guide.profile));
    for (const audience of guide.audiences || []) assert.ok(profiles.some((p: any) => p.id === audience));
    assert.ok(guide.steps.length >= 3, guide.id);
    for (const step of guide.steps) {
      assert.ok(step.title && step.expected && step.body.length, guide.id);
      if (step.image) assert.ok(existsSync(fileURLToPath(new URL(step.image, root))), step.image);
    }
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
          assert.ok(team.records.some((r: any) => r.path === '/mis-inspecciones/' + id));
          assert.ok(team.records.some((r: any) => r.path === '/inspecciones/' + id));
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
