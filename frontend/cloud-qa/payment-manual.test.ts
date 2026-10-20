import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const manual = path.resolve(import.meta.dirname, '../../docs/manual');
test('the registration guide explains identity reservation, legacy review and distinct electricity units', () => {
  const context = { window: {} as any }; vm.runInNewContext(readFileSync(path.join(manual, 'help-data.js'), 'utf8'), context);
  const guide = context.window.SITREP_HELP.guides.find((item: any) => item.id === 'alta-borradores-ocr'); assert.ok(guide);
  const prose = JSON.stringify(guide);
  for (const phrase of ['Identificar y reservar pago ATM', 'Confirmar y reservar pago', 'misma operación', 'aunque cambien la foto', 'conciliación administrativa', 'sin alterar su decisión histórica', 'potencia instalada en HP', 'ni cambia automáticamente la TEF', 'EDEMSA', 'COSPAC Bowen', 'Sud Río Tunuyán']) assert.ok(prose.includes(phrase), phrase);
  assert.ok(!prose.includes('El registro por identidad de pago queda pendiente'));
  assert.ok(prose.includes('no garantiza leer todas las facturas históricas'));
  for (const name of ['index.html', 'tutorial.html', 'search.html']) assert.ok(readFileSync(path.join(manual, name), 'utf8').includes('help-data.js?v=2026.20.17'));
});
