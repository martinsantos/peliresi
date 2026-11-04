import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const manual = new URL('../../docs/manual/', import.meta.url);
const source = readFileSync(new URL('help-data.js', manual));
const context = { window: {} as { SITREP_HELP?: { guides: Array<{ id: string; steps: Array<{ title: string; body: string[] }> }> } } };
runInNewContext(source.toString('utf8'), context, { timeout: 1000 });

test('the GPS guide explains segment boundaries and uncertainty', () => {
  const guide = context.window.SITREP_HELP?.guides.find(item => item.id === 'administrador-alertas-proactivas');
  const step = guide?.steps.find(item => item.title === 'Revisar observaciones del recorrido');
  assert.ok(step);
  const text = step.body.join(' ');
  for (const phrase of ['mismo tramo de relevo', 'sin tramo identificado', 'no puede reconstruirse su procedencia',
    'se desconoce cuándo las captó', 'no se atribuye a la transportista original', '30 minutos', 'distintos tramos']) {
    assert.ok(text.includes(phrase), phrase);
  }
});

test('manual entry points reference the current help data', () => {
  const version = createHash('sha256').update(source).digest('hex').slice(0, 12);
  for (const name of ['index.html', 'search.html', 'tutorial.html']) {
    const html = readFileSync(new URL(name, manual), 'utf8');
    assert.ok(html.includes('help-data.js?v=' + version), name);
  }
});
