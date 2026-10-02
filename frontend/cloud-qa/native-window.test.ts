import test from 'node:test';
import assert from 'node:assert/strict';
import { chromeButtonPoint, nativeNodes } from './native-window.ts';

const node = (extra = '', bounds = '[40,100][240,180]') => `<node package="com.android.chrome" text="No thanks" enabled="true" clickable="true" bounds="${bounds}" ${extra}/>`;
const window = (nodes: string) => '<?xml version="1.0"?><hierarchy>' + nodes + '</hierarchy>';
test('uses the observed native button bounds, not fixed emulator coordinates', () => {
  assert.deepEqual(chromeButtonPoint(window(node()), 'No thanks'), { x: 140, y: 140 });
  assert.deepEqual(chromeButtonPoint(window(node('', '[700,1600][1040,1710]')), 'No thanks'), { x: 870, y: 1655 });
});
test('rejects absent and ambiguous native targets', () => {
  assert.throws(() => chromeButtonPoint(window(''), 'No thanks'));
  assert.throws(() => chromeButtonPoint(window(node() + node()), 'No thanks'));
});
test('never taps disabled, other-package or zero-area nodes', () => {
  assert.throws(() => chromeButtonPoint(window(node().replace('enabled="true"', 'enabled="false"')), 'No thanks'));
  assert.throws(() => chromeButtonPoint(window(node().replace('com.android.chrome', 'ar.com.ultimamilla.sitrep')), 'No thanks'));
  assert.throws(() => chromeButtonPoint(window(node('', '[40,100][40,100]')), 'No thanks'));
});
test('requires a complete dump and decodes native text without executing it', () => {
  assert.throws(() => nativeNodes('<hierarchy><node/>'));
  assert.equal(nativeNodes(window('<node text="A &amp; B &quot;test&quot;"/>'))[0].text, 'A & B "test"');
});
