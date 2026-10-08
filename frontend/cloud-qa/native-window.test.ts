import test from 'node:test';
import assert from 'node:assert/strict';
import { chromeButtonPoint, chromeRenderedButtonPoint, chromeButtonHasZeroBounds, collectNativeWindow, nativeKeyboardShown, nativeNodes, pixelLauncherAnrClosePoint } from './native-window.ts';

test('reads explicit OS keyboard visibility rather than inferring it from DOM focus or viewport size', () => {
  assert.equal(nativeKeyboardShown('InputMethodManagerService\n  mInputShown=true mShowRequested=true'), true);
  assert.equal(nativeKeyboardShown('InputMethodManagerService\n  mInputShown=false mShowRequested=false'), false);
});
test('unknown, incomplete and ambiguous keyboard dumps cannot pass as a hidden keyboard', () => {
  for (const dump of ['', 'mInputShown=unknown', 'mInputShown=true\nmInputShown=false', 'mInputShown=false\nmInputShown=false']) assert.throws(() => nativeKeyboardShown(dump));
});

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
test('multi-line options use their complete actual native button label and observed bounds', () => {
  const option = node('class="android.widget.Button"', '[60,280][1000,410]').replace('No thanks', '1 Domicilio declarado Establecimiento Pendiente');
  assert.deepEqual(chromeRenderedButtonPoint(window(option), '1\nDomicilio declarado\nEstablecimiento\nPendiente'), { x: 530, y: 345 });
  assert.throws(() => chromeRenderedButtonPoint(window(option), 'Domicilio declarado'));
});
test('option targeting rejects matching search inputs, ambiguous labels, other packages and invalid bounds', () => {
  const option = node('class="android.widget.Button"').replace('No thanks', '1 Domicilio declarado Establecimiento Pendiente');
  for (const unsafe of [option.replace('android.widget.Button', 'android.widget.EditText'), option + option,
    option.replace('com.android.chrome', 'other.app'), option.replace('enabled="true"', 'enabled="false"'),
    option.replace('[40,100][240,180]', '[40,100][40,100]')]) {
    assert.throws(() => chromeRenderedButtonPoint(window(unsafe), '1 Domicilio declarado Establecimiento Pendiente'));
  }
  assert.throws(() => chromeRenderedButtonPoint(window(option), ''));
});
test('never taps disabled, other-package or zero-area nodes', () => {
  assert.throws(() => chromeButtonPoint(window(node().replace('enabled="true"', 'enabled="false"')), 'No thanks'));
  assert.throws(() => chromeButtonPoint(window(node().replace('com.android.chrome', 'ar.com.ultimamilla.sitrep')), 'No thanks'));
  assert.throws(() => chromeButtonPoint(window(node('', '[40,100][40,100]')), 'No thanks'));
});
test('diagnoses exact all-zero accessibility bounds without authorizing a native tap', () => {
  const button = node('class="android.widget.Button"', '[0,0][0,0]').replace('No thanks', 'Guardar cambios');
  assert.equal(chromeButtonHasZeroBounds(window(button), 'Guardar cambios'), true);
  assert.throws(() => chromeButtonPoint(window(button), 'Guardar cambios'));
  assert.equal(chromeButtonHasZeroBounds(window(button.replace('[0,0][0,0]', '[40,100][240,180]')), 'Guardar cambios'), false);
});
test('zero-bounds diagnosis rejects wrong labels, packages, classes, disabled or ambiguous nodes', () => {
  const button = node('class="android.widget.Button"', '[0,0][0,0]').replace('No thanks', 'Guardar cambios');
  for (const invalid of ['', button + button, button.replace('com.android.chrome', 'other.app'),
    button.replace('android.widget.Button', 'android.widget.EditText'), button.replace('enabled="true"', 'enabled="false"'),
    button.replace('clickable="true"', 'clickable="false"'), button.replace('Guardar cambios', 'Guardar cambios ajenos')])
    assert.throws(() => chromeButtonHasZeroBounds(window(invalid), 'Guardar cambios'));
});
test('malformed or clipped native bounds never become a DOM-input exception', () => {
  for (const bounds of ['', '[40,100][40,100]', '[240,180][40,100]', 'unknown'])
    assert.throws(() => chromeButtonHasZeroBounds(window(node('class="android.widget.Button"', bounds)), 'No thanks'));
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
    if (args[1] === 'uiautomator') { await dump; return 'UI hierchary dumped to: /data/local/tmp/sitrep-cloud-qa-window.xml\n'; }
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
test('a success-looking message with nonzero exit remains a failure with diagnostic evidence', async () => {
  const calls: string[][] = [];
  const error = Object.assign(new Error('Command failed: adb shell uiautomator dump'), {
    code: 255, signal: null, killed: false,
    stdout: 'UI hierchary dumped to: /data/local/tmp/sitrep-cloud-qa-window.xml\n', stderr: '',
  });
  await assert.rejects(collectNativeWindow(async args => { calls.push(args); throw error; }), failure => {
    assert.match(String(failure), /"code":255/);
    assert.match(String(failure), /"killed":false/);
    assert.match(String(failure), /"elapsedMs":\d+/);
    assert.match(String(failure), /UI hierchary dumped to:/);
    return true;
  });
  assert.equal(calls.length, 1, 'Never read a possibly stale XML or retry a failed command');
});
test('failed or incomplete native XML read is not accepted as an empty passing window', async () => {
  await assert.rejects(collectNativeWindow(async args => {
    if (args[1] === 'cat') throw new Error('read disconnected');
    return 'UI hierchary dumped to: /data/local/tmp/sitrep-cloud-qa-window.xml';
  }), /read disconnected/);
  await assert.rejects(collectNativeWindow(async args => args[1] === 'cat' ? '<hierarchy><node/>' : 'UI hierchary dumped to: /data/local/tmp/sitrep-cloud-qa-window.xml'));
});

test('zero-exit native errors cannot reuse a complete but stale previous window', async () => {
  for (const message of ['ERROR: could not get idle state.', '', 'UI hierchary dumped to: /another/window.xml']) {
    const calls: string[][] = [];
    await assert.rejects(collectNativeWindow(async args => {
      calls.push(args); return args[1] === 'cat' ? window(node()) : message;
    }), /Native UI dump did not confirm/);
    assert.equal(calls.length, 1, 'Never read the previous file after a failed fresh dump');
  }
});
