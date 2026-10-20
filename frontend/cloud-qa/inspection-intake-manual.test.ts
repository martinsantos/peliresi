import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
const manual = new URL('../../docs/manual/', import.meta.url);
const context: any = { window: {} }; vm.runInNewContext(readFileSync(new URL('help-data.js', manual), 'utf8'), context);
const guides = context.window.SITREP_HELP.guides;
test('finding guide distinguishes source evidence, unknown scope and a formal inspection', () => {
  const guide = guides.find((g: any) => g.id === 'hallazgos-manifiestos-psip'); assert.ok(guide); assert.equal(guide.steps.length, 4);
  const text = JSON.stringify(guide);
  for (const term of ['dentro de la adenda', 'Y omitida', 'alcance sin verificar', 'no se fusionan', 'no se abre', 'corrientes Y', 'no acredita infracción', 'CAP sigue cerrado']) assert.ok(text.toLowerCase().includes(term.toLowerCase()), term);
  assert.ok(guide.steps.flatMap((s: any) => s.resources || []).some((r: any) => r.path === '/inspecciones?vista=antecedentes'));
});
test('manual bundle references agree at the candidate version', () => {
  for (const file of ['index.html', 'tutorial.html', 'search.html']) assert.match(readFileSync(new URL(file, manual), 'utf8'), /help-data\.js\?v=2026\.20\.17/);
});
test('finding and queue screenshots come unedited from the nine accepted preview journeys', () => {
  const proof = JSON.parse(readFileSync(new URL('inspection-intake-capture-provenance.json', manual), 'utf8'));
  assert.equal(proof.synthetic, true); assert.equal(proof.productionCapture, false); assert.equal(proof.edited, false); assert.equal(proof.browserTestsPassed, 9); assert.equal(proof.files.length, 2);
  const guide = guides.find((g: any) => g.id === 'hallazgos-manifiestos-psip');
  for (const item of proof.files) {
    const bytes = readFileSync(new URL('screenshots/' + item.file, manual));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256); assert.equal(bytes.readUInt32BE(16), item.width); assert.equal(bytes.readUInt32BE(20), item.height);
    const step = guide.steps.find((s: any) => s.image === 'screenshots/' + item.file); assert.ok(step); assert.match(step.caption, /Datos sintéticos/);
  }
});
