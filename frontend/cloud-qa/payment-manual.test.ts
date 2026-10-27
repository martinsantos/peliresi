import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createHash } from 'node:crypto';
const manual = path.resolve(import.meta.dirname, '../../docs/manual');
test('the registration guide explains identity reservation, legacy review and distinct electricity units', () => {
  const context = { window: {} as any }; vm.runInNewContext(readFileSync(path.join(manual, 'help-data.js'), 'utf8'), context);
  const guide = context.window.SITREP_HELP.guides.find((item: any) => item.id === 'alta-borradores-ocr'); assert.ok(guide);
  const prose = JSON.stringify(guide);
  for (const phrase of ['Identificar y reservar pago ATM', 'Confirmar y reservar pago', 'misma operación', 'aunque cambien la foto', 'conciliación administrativa', 'sin alterar su decisión histórica', 'potencia instalada en HP', 'ni cambia automáticamente la TEF', 'EDEMSA', 'COSPAC Bowen', 'Sud Río Tunuyán', 'Ingresar con mi cuenta', 'Continuar borrador', 'Corregir datos y documentos', 'no reemplaza un adjunto rechazado', 'Abrir solicitud y ver su estado', 'Factura eléctrica opcional', 'pestaña Documentos']) assert.ok(prose.includes(phrase), phrase);
  assert.ok(!prose.includes('El registro por identidad de pago queda pendiente'));
  assert.ok(prose.includes('no garantiza leer todas las facturas históricas'));
  // Cache-busting versions are content hashes, not a date fixed to an older guide.
  const helpHash = createHash('sha256').update(readFileSync(path.join(manual, 'help-data.js'))).digest('hex').slice(0, 12);
  const cssHash = createHash('sha256').update(readFileSync(path.join(manual, 'manual.css'))).digest('hex').slice(0, 12);
  for (const name of ['index.html', 'tutorial.html', 'search.html']) {
    const html = readFileSync(path.join(manual, name), 'utf8');
    assert.ok(html.includes('help-data.js?v=' + helpHash), name + ' help version');
    assert.ok(html.includes('manual.css?v=' + cssHash), name + ' CSS version');
  }
});
test('the current correction screenshot comes from the accepted artificial app flow and preserves the old original', () => {
  const proof = JSON.parse(readFileSync(path.join(manual, 'actor-onboarding-capture-provenance.json'), 'utf8'));
  assert.equal(proof.synthetic, true); assert.equal(proof.productionCapture, false); assert.equal(proof.edited, false);
  assert.equal(proof.browserTestsPassed, 18); assert.equal(proof.files.length, 1); assert.equal(proof.supersedes.length, 1);
  const context = { window: {} as any }; vm.runInNewContext(readFileSync(path.join(manual, 'help-data.js'), 'utf8'), context);
  const guide = context.window.SITREP_HELP.guides.find((item: any) => item.id === 'alta-borradores-ocr');
  for (const file of proof.files) {
    const bytes = readFileSync(path.join(manual, 'screenshots', file.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    assert.equal(bytes.readUInt32BE(16), file.width); assert.equal(bytes.readUInt32BE(20), file.height);
    const step = guide.steps.find((item: any) => item.image === 'screenshots/' + file.file);
    assert.ok(step, 'The guide still uses the proven capture even if its step moves');
    assert.match(step.caption, /Datos sintéticos/);
    assert.match(step.alt, /Corregir datos y documentos/);
  }
  assert.equal(proof.supersedes[0].file, 'mobile/registration-observed-20261012.png');
  assert.equal(proof.supersedes[0].replacement, proof.files[0].file);
  const old = JSON.parse(readFileSync(path.join(manual, 'training-capture-provenance.json'), 'utf8')).files.find((entry: any) => entry.file === proof.supersedes[0].file);
  assert.equal(createHash('sha256').update(readFileSync(path.join(manual, 'screenshots', old.file))).digest('hex'), old.sha256);
});
