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
