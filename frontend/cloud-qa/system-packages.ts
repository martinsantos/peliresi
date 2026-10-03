import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { assertCloudEnvironment } from './safety.ts';

type Run = (args: string[]) => string;
type Version = { code: string; name: string };
const STORE = 'com.android.vending';
const DEPENDENCIES = ['com.android.chrome', 'com.google.android.gms'] as const;
const adb: Run = args => execFileSync('adb', args, { encoding: 'utf8', timeout: 5000, maxBuffer: 2 * 1024 * 1024 });
export function packageVersion(dump: string): Version {
  const code = dump.match(/^\s*versionCode=(\d+)\b/m)?.[1];
  const name = dump.match(/^\s*versionName=(\S+)/m)?.[1];
  assert.ok(code && name, 'Missing actual Android package version');
  return { code, name };
}
function snapshot(run: Run) {
  return Object.fromEntries(DEPENDENCIES.map(pkg => {
    assert.ok(run(['shell', 'pm', 'list', 'packages', '-e', '--user', '0', pkg]).trim().split('\n').includes('package:' + pkg), pkg + ' must remain enabled');
    return [pkg, packageVersion(run(['shell', 'dumpsys', 'package', pkg]))];
  })) as Record<typeof DEPENDENCIES[number], Version>;
}

/** Pin only the updater in the disposable QA VM, never GMS, Chrome or app data.
 * run24 shows Play Store rapid_auto_update freezing GMS and killing Chrome.
 * https://developer.android.com/tools/adb#pm
 */
export function freezeCloudPlayStore(run: Run = adb, env = process.env) {
  assertCloudEnvironment(env); // Before the first ADB call, including diagnostics.
  const serial = run(['get-serialno']).trim();
  assert.match(serial, /^emulator-\d+$/, 'Never change a physical device');
  assert.equal(run(['shell', 'getprop', 'ro.kernel.qemu']).trim(), '1');
  assert.equal(run(['shell', 'getprop', 'ro.build.version.sdk']).trim(), '35');
  const before = snapshot(run);
  const response = run(['shell', 'pm', 'disable-user', '--user', '0', STORE]);
  assert.match(response, /Package com\.android\.vending new state: disabled-user/);
  assert.ok(run(['shell', 'pm', 'list', 'packages', '-d', '--user', '0', STORE]).trim().split('\n').includes('package:' + STORE));
  assert.deepEqual(snapshot(run), before, 'Dependencies changed during environment setup');
  return { serial, sdk: '35', updater: STORE, state: 'disabled-user', dependencies: before,
    scope: 'Disposable cloud emulator only; no certification during OS updates' };
}

export function assertStableSystemPackages(baseline: ReturnType<typeof freezeCloudPlayStore>, run: Run = adb, env = process.env) {
  assertCloudEnvironment(env);
  assert.equal(run(['get-serialno']).trim(), baseline.serial);
  assert.ok(run(['shell', 'pm', 'list', 'packages', '-d', '--user', '0', STORE]).trim().split('\n').includes('package:' + STORE));
  const after = snapshot(run);
  assert.deepEqual(after, baseline.dependencies, 'Chrome/GMS changed during QA; evidence is not a fixed-environment gate');
  return { ...baseline, after, stable: true };
}
