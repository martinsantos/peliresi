/** Build on disposable CI only. Never modifies the old APK or a signing key. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import path from 'node:path';

assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.GITHUB_REPOSITORY, 'martinsantos/peliresi');
const output = path.join(process.env.RUNNER_TEMP!, 'sitrep-brand-review');
const target = path.join(output, 'android');
const require = createRequire(path.join(process.env.RUNNER_TEMP!, 'sitrep-bubblewrap/package.json'));
const { TwaManifest, TwaGenerator } = require('@bubblewrap/core');
const icon = await readFile(new URL('../../frontend/public/icon-512.png', import.meta.url));
const source = await readFile(new URL('../../frontend/public/favicon.svg', import.meta.url));
const approved = await readFile(new URL('../../frontend/public/mail-sitrep-rotonda.svg', import.meta.url));
assert.deepEqual(source, approved);
await mkdir(target, { recursive: true });
// Serve committed assets over loopback only; no third-party image fetch.
const server = createServer((req, res) => {
  if (req.url !== '/icon.png') { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(icon);
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
const manifest = new TwaManifest({
  packageId: 'ar.com.ultimamilla.sitrep', host: 'sitrep.ultimamilla.com.ar',
  name: 'SITREP - Trazabilidad RRPP', launcherName: 'SITREP', display: 'standalone',
  themeColor: '#0D8A4F', themeColorDark: '#0D8A4F', navigationColor: '#0D8A4F',
  navigationColorDark: '#0D8A4F', navigationDividerColor: '#0D8A4F', navigationDividerColorDark: '#0D8A4F',
  backgroundColor: '#1B5E3C', enableNotifications: true,
  startUrl: '/app/', orientation: 'portrait-primary', fallbackType: 'customtabs',
  appVersion: '1.0.2', appVersionCode: 4,
  iconUrl: 'http://127.0.0.1:' + address.port + '/icon.png',
  maskableIconUrl: 'http://127.0.0.1:' + address.port + '/icon.png',
  splashScreenFadeOutDuration: 300,
  webManifestUrl: 'https://sitrep.ultimamilla.com.ar/manifest-app.json',
  fullScopeUrl: 'https://sitrep.ultimamilla.com.ar/app/',
  signingKey: { path: 'MISSING-ORIGINAL-RELEASE-KEY.keystore', alias: 'SITREP' },
  fingerprints: [{ value: '14:30:25:00:EF:38:5B:21:7B:03:EF:D8:21:18:BB:B4:5C:68:DE:11:93:0F:C8:03:CC:50:0F:02:0E:08:E1:D7' }],
  features: { locationDelegation: { enabled: true } }, shortcuts: [],
});
try {
  assert.equal(manifest.validate(), null);
  await manifest.saveToFile(path.join(target, 'twa-manifest.json'));
  await new TwaGenerator().createTwaProject(target, manifest, { debug() {}, info() {}, warn: console.warn, error: console.error }, () => {});
} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
await writeFile(path.join(target, 'gradle.properties'), 'org.gradle.jvmargs=-Xmx1536m\norg.gradle.workers.max=1\norg.gradle.daemon=false\nandroid.useAndroidX=true\n');
await writeFile(path.join(output, 'candidate.json'), JSON.stringify({
  run: process.env.GITHUB_RUN_ID, commit: process.env.GITHUB_SHA,
  sourceMarkSHA256: createHash('sha256').update(source).digest('hex'),
  iconSHA256: createHash('sha256').update(icon).digest('hex'),
  host: manifest.host, package: manifest.packageId, versionCode: 4,
  releaseSigned: false, distributionAllowed: false,
  limitation: 'Original release signing key unavailable; debug APK is VM-only, not an installed-app upgrade.',
}, null, 2));
