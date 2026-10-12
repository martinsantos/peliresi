import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = new URL('../../docs/manual/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), 'utf8');
const context = { window: {} as any };
runInNewContext(read('help-data.js'), context);
const { profiles, guides } = context.window.SITREP_HELP;

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
