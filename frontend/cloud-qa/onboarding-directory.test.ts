import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const directory = readFileSync(new URL('../../docs/manual/directorio.html', import.meta.url), 'utf8');
const moduleBody = directory.split('<section id="mod-inscripcion"')[1]?.split('</section>')[0];
const gallery = directory.split('<h3 id="gal-wizards">')[1]?.split('<h3 id="gal-mobile">')[0];
const help = { window: {} as any };
runInNewContext(readFileSync(new URL('../../docs/manual/help-data.js', import.meta.url), 'utf8'), help);

test('the public directory retains admission anchors and links to current guides', () => {
  assert.ok(moduleBody);
  for (const id of ['inscr-fase1', 'inscr-gen', 'inscr-oper', 'inscr-trans', 'inscr-tef',
    'inscr-adm-gen', 'inscr-adm-oper', 'inscr-adm-trans', 'inscr-mobile', 'inscr-workflow', 'inscr-resumen']) {
    assert.match(moduleBody, new RegExp(`id="${id}"`), id);
  }
  for (const id of ['alta-borradores-ocr', 'revision-altas-renovaciones', 'entidad-actividades-representantes']) {
    assert.ok(help.window.SITREP_HELP.guides.some((guide: any) => guide.id === id), id);
    assert.ok(moduleBody.includes(`tutorial.html?guide=${id}`), id);
  }
});

test('admission and its gallery never advertise the withdrawn fiscal estimate as current', () => {
  for (const text of ['Importe pendiente de liquidación', 'no acredita', 'potencia instalada en HP', 'dos personas']) {
    assert.ok(moduleBody.includes(text), text);
  }
  assert.doesNotMatch(moduleBody, /TEF = M x R x ISO|monto TEF resultante|c[aá]lculo autom[aá]tico en tiempo real|importes de la calculadora administrativa son una simulación/i);
  for (const old of ['W20_adm_gen_paso4_tef.png', 'W36_tef_resultado.png', 'W39_tef_coef_a.png', 'W41_tef_desglose.png', 'W28_adm_oper_paso5_tef.png', 'W43_mob_gen_tef.png']) {
    assert.ok(!moduleBody.includes(old), old);
    assert.ok(!gallery.includes(old), old);
  }
  assert.match(moduleBody, /tef-review-pending-20261026\.png/);
  assert.match(gallery, /tef-review-pending-20261026\.png/);
});

test('actor use cases do not promise a calculated TEF amount', () => {
  for (const [start, end] of [['CU-A02: Gestionar Generadores', 'CU-A03:'], ['CU-A04: Gestionar Operadores', 'CU-A05:']]) {
    const excerpt = directory.split(start)[1]?.split(end)[0];
    assert.ok(excerpt, start);
    assert.doesNotMatch(excerpt, /Paso [45] — Calculo TEF|y calculo TEF/i);
    assert.match(excerpt, /Importe pendiente de liquidación/);
  }
});

test('the admission figure and scrollable tables use the current directory styles', () => {
  const css = readFileSync(new URL('../../docs/manual/directorio.css', import.meta.url));
  const cssHash = createHash('sha256').update(css).digest('hex').slice(0, 12);
  assert.ok(directory.includes('directorio.css?v=' + cssHash));
  assert.match(moduleBody, /class="cu-screenshot admission-figure"/);
  assert.match(moduleBody, /<table tabindex="0" aria-label="Estados y responsabilidades de la inscripción">/);
  assert.match(css.toString(), /\.admission-figure\s*\{\s*max-width:\s*393px/);
  for (const id of ['arq-api', 'devops-schema']) {
    const section = directory.split(`<section id="${id}"`)[1]?.split('</section>')[0];
    assert.match(section, /<table tabindex="0" aria-label="/, id);
  }
});
