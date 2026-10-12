/** VM-only debug candidate; no credentials, data mutation or trust bypass. */
import assert from 'node:assert/strict';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { freezeCloudPlayStore, assertStableSystemPackages } from './system-packages.ts';
import { dismissObservedChromePrompts, readNativeWindow } from './native-window.ts';
const run = promisify(execFile);
const baseline = freezeCloudPlayStore();
const output = path.join(process.env.RUNNER_TEMP!, 'sitrep-brand-review');
const evidence = path.join(output, 'native');
await mkdir(evidence, { recursive: true });
const adb = (...args: string[]) => execFileSync('adb', args, { encoding: 'utf8', timeout: 20000 });
const pkg = 'ar.com.ultimamilla.sitrep';
assert.equal(adb('shell', 'pm', 'path', pkg).trim(), '', 'Never replace an installed app with a debug signature');
adb('install', path.join(output, 'android/app/build/outputs/apk/debug/app-debug.apk'));
const identity = adb('shell', 'dumpsys', 'package', pkg);
assert.match(identity, /versionCode=4\b/); assert.match(identity, /versionName=1\.0\.2\b/);
await writeFile(path.join(evidence, 'package.txt'), identity);
let xml = '';
adb('shell', 'am', 'start', '-W', '-n', pkg + '/.LauncherActivity');
for (let i=0;i<12;i++) {
  await dismissObservedChromePrompts(evidence);
  xml = await readNativeWindow();
  if (xml.includes('Correo electrónico o CUIT') && xml.includes('Ingresar')) break;
  await new Promise(resolve => setTimeout(resolve, 1000));
}
assert.ok(xml.includes('Correo electrónico o CUIT') && xml.includes('Ingresar'), 'Actual public login must render');
await writeFile(path.join(evidence, 'login.xml'), xml);
await writeFile(path.join(evidence, 'login.png'), execFileSync('adb', ['exec-out', 'screencap', '-p'], { timeout: 10000 }));
// Record the real second cold launch; no activity substituted for the splash.
adb('shell', 'am', 'force-stop', pkg);
adb('shell', 'am', 'force-stop', 'com.android.chrome');
const recording = run('adb', ['shell', 'screenrecord', '--time-limit', '8', '/sdcard/sitrep-brand-review.mp4'], { timeout: 15000 });
await new Promise(resolve => setTimeout(resolve, 800));
adb('shell', 'am', 'start', '-W', '-n', pkg + '/.LauncherActivity');
await recording;
adb('pull', '/sdcard/sitrep-brand-review.mp4', path.join(evidence, 'cold-launch.mp4'));
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path.join(evidence, 'cold-launch.mp4'), '-vf', 'fps=5,scale=360:-1', '-frames:v', '25', path.join(evidence, 'launch-%02d.png')], { timeout: 20000 });
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
