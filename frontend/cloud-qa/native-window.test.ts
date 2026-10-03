import test from 'node:test';
import assert from 'node:assert/strict';
import { chromeButtonPoint, collectNativeWindow, nativeNodes, pixelLauncherAnrClosePoint } from './native-window.ts';

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
test('uses the Spanish web logout button reported by Android and rejects clipped bounds', () => {
  const logout=node().replace('No thanks','Cerrar Sesión');
  assert.deepEqual(chromeButtonPoint(window(logout),'Cerrar Sesión'),{x:140,y:140});
  assert.throws(()=>chromeButtonPoint(window(node('', '[73,2188][1008,1520]').replace('No thanks','Cerrar Sesión')),'Cerrar Sesión'));
});

// Exact title, resource IDs and bounds observed in run11/android/logout-native-before.xml.
const launcherTitle = '<node package="android" resource-id="android:id/alertTitle" text="Pixel Launcher isn&apos;t responding"/>';
const launcherClose = '<node package="android" resource-id="android:id/aerr_close" text="Close app" enabled="true" clickable="true" bounds="[70,1174][1010,1300]"/>';
test('recovers only the observed Pixel Launcher system ANR using its actual button bounds', () => {
  assert.deepEqual(pixelLauncherAnrClosePoint(window(launcherTitle + launcherClose)), { x: 540, y: 1237 });
  assert.deepEqual(pixelLauncherAnrClosePoint(window(launcherTitle + launcherClose.replace('[70,1174][1010,1300]', '[20,30][120,130]'))), { x: 70, y: 80 });
  assert.equal(pixelLauncherAnrClosePoint(window(node())), null);
});
test('never closes Chrome, SITREP or unknown app ANRs', () => {
  for (const app of ['Chrome', 'SITREP', 'Unknown app']) {
    assert.equal(pixelLauncherAnrClosePoint(window(launcherTitle.replace('Pixel Launcher', app) + launcherClose)), null);
  }
  assert.equal(pixelLauncherAnrClosePoint(window(launcherTitle.replace('package="android"', 'package="com.android.chrome"') + launcherClose)), null);
  assert.equal(pixelLauncherAnrClosePoint(window(launcherTitle.replace('android:id/alertTitle', 'android:id/message') + launcherClose)), null);
});
test('refuses ambiguous dialogs or missing, disabled, wrong-resource and wrong-package close buttons', () => {
  assert.throws(() => pixelLauncherAnrClosePoint(window(launcherTitle + launcherTitle.replace('Pixel Launcher', 'Chrome') + launcherClose)));
  assert.throws(() => pixelLauncherAnrClosePoint(window(launcherTitle + launcherClose + launcherClose)));
  for (const button of ['', launcherClose.replace('enabled="true"', 'enabled="false"'),
    launcherClose.replace('clickable="true"', 'clickable="false"'), launcherClose.replace('aerr_close', 'aerr_wait'),
    launcherClose.replace('Close app', 'Wait'), launcherClose.replace('package="android"', 'package="ar.com.ultimamilla.sitrep"')]) {
    assert.throws(() => pixelLauncherAnrClosePoint(window(launcherTitle + button)));
  }
});
test('refuses absent, empty or inverted bounds for the system ANR recovery', () => {
  for (const bounds of ['', '[70,1174][70,1300]', '[1010,1300][70,1174]']) {
    assert.throws(() => pixelLauncherAnrClosePoint(window(launcherTitle + launcherClose.replace('[70,1174][1010,1300]', bounds))));
  }
});

test('fresh native dump yields to other driver work and reads only after completion', async () => {
  const calls: Array<{args: string[]; timeout: number}> = [];
  let finish!: () => void;
  const dump = new Promise<void>(resolve => { finish = resolve; });
  const result = collectNativeWindow(async (args, timeout) => {
    calls.push({args, timeout});
    if (args[1] === 'uiautomator') { await dump; return 'UI hierarchy dumped'; }
    return window(node());
  });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1, 'The event loop stays available while the dump is pending');
  finish();
  assert.equal(await result, window(node()));
  assert.deepEqual(calls, [
    {args: ['shell', 'uiautomator', 'dump', '/data/local/tmp/sitrep-cloud-qa-window.xml'], timeout: 20000},
    {args: ['shell', 'cat', '/data/local/tmp/sitrep-cloud-qa-window.xml'], timeout: 5000},
  ]);
});
test('failed native dump is never retried or replaced with an older XML file', async () => {
  let calls = 0;
  await assert.rejects(collectNativeWindow(async () => { calls++; throw new Error('device offline'); }), /Native UI dump failed: device offline/);
  assert.equal(calls, 1);
});
test('failed or incomplete native XML read is not accepted as an empty passing window', async () => {
  await assert.rejects(collectNativeWindow(async args => {
    if (args[1] === 'cat') throw new Error('read disconnected');
    return 'dumped';
  }), /read disconnected/);
  await assert.rejects(collectNativeWindow(async args => args[1] === 'cat' ? '<hierarchy><node/>' : 'dumped'));
});
