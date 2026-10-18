import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freezeCloudPlayStore, assertStableSystemPackages, packageVersion, installedPackageVersion } from './system-packages.ts';

const env = { CI: 'true', GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'martinsantos/peliresi',
  GITHUB_REF: 'refs/heads/codex/sitrep-cloud-qa-20261002', ALLOW_SYNTHETIC_QA: '1',
  DATABASE_URL: 'postgresql://qa@127.0.0.1:55440/sitrep_night_qa_20260926', PORT: '3037',
  NODE_ENV: 'test', NODE_APP_INSTANCE: 'qa', DISABLE_EMAILS: 'true', BLOCKCHAIN_ENABLED: 'false',
  ENABLE_ANALYTICS: 'false', FRONTEND_URL: 'http://127.0.0.1:4177', CORS_ORIGIN: 'http://127.0.0.1:4177',
  VITE_API_URL: '/api', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', VAPID_PUBLIC_KEY: '',
  VAPID_PRIVATE_KEY: '', BLOCKCHAIN_RPC_URL: '', BLOCKCHAIN_CONTRACT_ADDRESS: '' };
function device() {
  const calls: string[][] = []; let version = '124', serial = 'emulator-5554', disabled = false;
  const run = (args: string[]) => {
    calls.push(args); const command = args.join(' '), pkg = args.at(-1);
    if (command === 'get-serialno') return serial;
    if (command === 'shell getprop ro.kernel.qemu') return '1';
    if (command === 'shell getprop ro.build.version.sdk') return '35';
    if (command === 'shell pm disable-user --user 0 com.android.vending') { disabled = true; return 'Package com.android.vending new state: disabled-user'; }
    if (args.includes('list')) return args.includes('-d') ? (disabled ? 'package:com.android.vending' : '') : 'package:' + pkg;
    if (command === 'shell dumpsys package packages') return '\nPackages:\n' + ['com.android.chrome', 'com.google.android.gms']
      .map(name => '  Package [' + name + '] (abcd):\n    versionCode=' + version + ' minSdk=29\n    versionName=' + version + '.0\n').join('\n');
    throw new Error('Unexpected ADB command: ' + command);
  };
  return { run, calls, changeVersion: () => { version = '125'; }, physical: () => { serial = 'phone123'; } };
}
test('extracts actual versions and refuses missing package data', () => {
  assert.deepEqual(packageVersion('  versionCode=124 minSdk=29\n  versionName=124.0\n'), { code: '124', name: '124.0' });
  assert.throws(() => packageVersion('Package missing'), /Missing actual/);
});
test('installed versions never fall through to another package or a hidden factory version', () => {
  const dump = '\nPackages:\n  Package [com.android.chrome] (a):\n    versionCode=124\n    versionName=124.0\n' +
    '  Package [com.other] (b):\n    versionCode=999\n    versionName=other\n' +
    'Hidden system packages:\n  Package [com.android.chrome] (c):\n    versionCode=1\n    versionName=factory\n';
  assert.deepEqual(installedPackageVersion(dump, 'com.android.chrome'), { code: '124', name: '124.0' });
  assert.throws(() => installedPackageVersion(dump, 'com.google.android.gms'), /Missing installed dependency/);
  assert.throws(() => installedPackageVersion(dump.replace('    versionName=124.0\n', ''), 'com.android.chrome'), /Missing actual/);
  assert.throws(() => installedPackageVersion(dump.slice(dump.indexOf('Hidden system packages:')), 'com.android.chrome'), /Missing installed/);
});
test('version snapshots request only installed packages, never full resolver dumps per dependency', () => {
  const d = device(); freezeCloudPlayStore(d.run, env);
  assert.deepEqual(d.calls.filter(args => args.includes('dumpsys')),
    Array.from({ length: 2 }, () => ['shell', 'dumpsys', 'package', 'packages']));
});
test('freezes only Play Store while preserving enabled Chrome/GMS and checking their versions', () => {
  const d = device(), before = freezeCloudPlayStore(d.run, env), after = assertStableSystemPackages(before, d.run, env);
  assert.equal(after.stable, true);
  assert.deepEqual(d.calls.filter(args => args.includes('disable-user')), [['shell', 'pm', 'disable-user', '--user', '0', 'com.android.vending']]);
  assert.equal(d.calls.some(args => args.includes('clear') || args.includes('uninstall') || args.includes('force-stop')), false);
});
test('fails the environment gate if dependencies change, rather than retrying application tests', () => {
  const d = device(), before = freezeCloudPlayStore(d.run, env); d.changeVersion();
  assert.throws(() => assertStableSystemPackages(before, d.run, env), /Chrome\/GMS changed during QA/);
});
test('refuses local machines before any device command and refuses physical cloud devices before mutation', () => {
  const d = device();
  assert.throws(() => freezeCloudPlayStore(d.run, { ...env, GITHUB_ACTIONS: 'false' }));
  assert.equal(d.calls.length, 0);
  d.physical(); assert.throws(() => freezeCloudPlayStore(d.run, env), /Never change a physical device/);
  assert.deepEqual(d.calls, [['get-serialno']]);
});
test('refuses disabled GMS and unsuccessful updater commands rather than assuming isolation', () => {
  const d = device();
  assert.throws(() => freezeCloudPlayStore(args => args.includes('-e') && args.at(-1) === 'com.google.android.gms' ? '' : d.run(args), env), /gms must remain enabled/);
  assert.equal(d.calls.some(args => args.includes('disable-user')), false);
  assert.throws(() => freezeCloudPlayStore(args => args.includes('disable-user') ? 'Error: permission denied' : d.run(args), env));
});
