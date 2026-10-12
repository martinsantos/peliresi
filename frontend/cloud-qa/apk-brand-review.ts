/** VM-only debug candidate; no credentials, data mutation or trust bypass. */
import assert from 'node:assert/strict';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { _android } from 'playwright';
import { freezeCloudPlayStore, assertStableSystemPackages } from './system-packages.ts';
import { dismissObservedChromePrompts, readNativeWindow } from './native-window.ts';
const run = promisify(execFile);
const baseline = freezeCloudPlayStore();
const output = path.join(process.env.RUNNER_TEMP!, 'sitrep-brand-review');
const evidence = path.join(output, 'native');
await mkdir(evidence, { recursive: true });
const adb = (...args: string[]) => execFileSync('adb', args, { encoding: 'utf8', timeout: 20000 });
const pkg = 'ar.com.ultimamilla.sitrep';
// Same disposable-browser setup as apk.ts. Do not click/accept Chrome terms,
// add Google accounts, disable TLS, or override Digital Asset Links.
adb('shell', 'am', 'set-debug-app', '--persistent', 'com.android.chrome');
const devices = await _android.devices();
assert.equal(devices.length, 1, 'Only the isolated cloud emulator');
const device = devices[0];
const browser = await device.launchBrowser({ args: ['--no-first-run', '--no-default-browser-check'] });
// `pm path` exits 1 for an absent package on Android 15; list is successful
// for both empty and populated results while preserving the no-replacement guard.
assert.ok(!adb('shell', 'pm', 'list', 'packages', pkg).split(/\r?\n/).includes(`package:${pkg}`), 'Never replace an installed app with a debug signature');
adb('install', path.join(output, 'android/app/build/outputs/apk/debug/app-debug.apk'));
const identity = adb('shell', 'dumpsys', 'package', pkg);
assert.match(identity, /versionCode=4\b/); assert.match(identity, /versionName=1\.0\.2\b/);
await writeFile(path.join(evidence, 'package.txt'), identity);
let xml = '';
async function recordLaunch(name: string) {
  const remote = '/sdcard/sitrep-brand-' + name + '.mp4';
  const video = path.join(evidence, name + '.mp4');
  const recording = run('adb', ['shell', 'screenrecord', '--time-limit', '8', remote], { timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 800));
  adb('shell', 'am', 'start', '-W', '-n', pkg + '/.LauncherActivity');
  await recording;
  adb('pull', remote, video);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', video, '-vf', 'fps=5,scale=360:-1', '-frames:v', '40', path.join(evidence, name + '-%02d.png')], { timeout: 20000 });
}
// Record before requesting an accessibility tree: the native splash may not
// expose one. Evidence survives a later login failure, never a mocked splash.
await recordLaunch('first-launch');
for (let i=0;i<12;i++) {
  try {
    await dismissObservedChromePrompts(evidence);
    xml = await readNativeWindow();
  } catch (error) {
    // Same observed launch transition as apk.ts; never use an old XML dump.
    if (!String(error).includes('null root node') || i >= 3) throw error;
    console.log('Waiting for a fresh native tree after splash transition');
    await new Promise(resolve => setTimeout(resolve, 1000));
    continue;
  }
  if (xml.includes('Correo electrónico o CUIT') && xml.includes('Ingresar')) break;
  await new Promise(resolve => setTimeout(resolve, 1000));
}
await writeFile(path.join(evidence, 'login.xml'), xml);
await writeFile(path.join(evidence, 'login.png'), execFileSync('adb', ['exec-out', 'screencap', '-p'], { timeout: 10000 }));
assert.ok(xml.includes('Correo electrónico o CUIT') && xml.includes('Ingresar'), 'Actual public login must render');
// Record the real second cold launch; no activity substituted for the splash.
adb('shell', 'am', 'force-stop', pkg);
adb('shell', 'am', 'force-stop', 'com.android.chrome');
await recordLaunch('cold-launch');
xml = await readNativeWindow();
assert.ok(xml.includes('Correo electrónico o CUIT') && xml.includes('Ingresar'));
const config = await readFile(path.join(output, 'android/app/build.gradle'), 'utf8');
assert.ok(config.includes('sitrep.ultimamilla.com.ar'));
assert.ok(!config.includes('rptrazar.mendoza.gov.ar'));
await writeFile(path.join(evidence, 'result.json'), JSON.stringify({
  run: process.env.GITHUB_RUN_ID, commit: process.env.GITHUB_SHA, launch: 'PASS', reopen: 'PASS',
  originalReleaseSignature: false, distributionAllowed: false,
  trustBypassed: false, authenticated: false, emailsSent: 0,
  limitation: 'Debug key is VM-only. Chrome Custom Tab fallback is expected until original release signature is available; not a signed production upgrade.',
  system: assertStableSystemPackages(baseline), visualReview: 'Pending inspection of recorded cold-launch frames',
}, null, 2));
await browser.close();
await device.close();
