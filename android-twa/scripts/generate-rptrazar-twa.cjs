#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TARGET_DIR = path.resolve(process.argv[2] || path.join(REPO_ROOT, 'android-twa', 'build-rptrazar'));
const WEB_MANIFEST_URL = 'https://rptrazar.mendoza.gov.ar/manifest-app.json';
const WEB_MANIFEST_HOST = new URL(WEB_MANIFEST_URL).hostname;
const DEFAULT_RPTRAZAR_IP = '192.168.192.135';
const RELEASE_KEYSTORE = path.resolve(
  process.env.RPTRAZAR_TWA_KEYSTORE ||
    path.join(REPO_ROOT, 'android-twa', 'secrets', 'sitrep-release.keystore'),
);
const RELEASE_KEY_ALIAS =
  process.env.RPTRAZAR_TWA_KEY_ALIAS || process.env.SITREP_TWA_KEY_ALIAS || 'SITREP';
const EXPECTED_FINGERPRINT = process.env.RPTRAZAR_TWA_FINGERPRINT ||
  '14:30:25:00:EF:38:5B:21:7B:03:EF:D8:21:18:BB:B4:5C:68:DE:11:93:0F:C8:03:CC:50:0F:02:0E:08:E1:D7';
const ANDROID_PACKAGE_ID = process.env.RPTRAZAR_TWA_PACKAGE_ID || 'ar.com.ultimamilla.sitrep';
const APP_NAME = process.env.RPTRAZAR_TWA_NAME || 'SITREP - Trazabilidad RRPP';
const LAUNCHER_NAME = process.env.RPTRAZAR_TWA_LAUNCHER_NAME || 'SITREP';
const APP_VERSION_CODE = Number(process.env.RPTRAZAR_TWA_VERSION_CODE || '3');
const APP_VERSION_NAME = process.env.RPTRAZAR_TWA_VERSION_NAME || '1.0.1';

const defaultBubblewrapModules = path.join(
  os.homedir(),
  '.npm',
  '_npx',
  '881cef4662d2c421',
  'node_modules',
);
const bubblewrapModules = process.env.BUBBLEWRAP_NODE_MODULES || defaultBubblewrapModules;
const bubblewrapCore = require(path.join(bubblewrapModules, '@bubblewrap', 'core'));

function resolveOverrideIp(hostname) {
  if (hostname !== WEB_MANIFEST_HOST) return null;
  if (process.env.RPTRAZAR_RESOLVE_IP) return process.env.RPTRAZAR_RESOLVE_IP;

  try {
    const output = childProcess.execFileSync('dig', ['+short', hostname], { encoding: 'utf8' });
    return output
      .split(/\s+/)
      .find((entry) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(entry)) || DEFAULT_RPTRAZAR_IP;
  } catch {
    return DEFAULT_RPTRAZAR_IP;
  }
}

function curlFetch(url) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rptrazar-twa-fetch-'));
  const bodyPath = path.join(tmpDir, 'body');
  const parsedUrl = new URL(url);
  const args = ['-sSL'];
  const overrideIp = resolveOverrideIp(parsedUrl.hostname);
  if (overrideIp) {
    args.push('--resolve', `${parsedUrl.hostname}:443:${overrideIp}`);
  }
  args.push('-o', bodyPath, '-w', '%{http_code}\\n%{content_type}', url);
  const meta = childProcess.execFileSync('curl', args, { encoding: 'utf8' });
  const [statusLine, ...contentTypeParts] = meta.trim().split('\n');
  const body = fs.readFileSync(bodyPath);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return {
    status: Number(statusLine),
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? contentTypeParts.join('\n') : null;
      },
    },
    async text() {
      return body.toString('utf8');
    },
    async arrayBuffer() {
      return body;
    },
  };
}

async function main() {
  bubblewrapCore.fetchUtils.fetch = async (input) => curlFetch(String(input));

  const webManifestResponse = curlFetch(WEB_MANIFEST_URL);
  if (webManifestResponse.status !== 200) {
    throw new Error(`Web manifest responded with HTTP ${webManifestResponse.status}`);
  }

  const webManifest = JSON.parse(await webManifestResponse.text());
  const twaManifest = bubblewrapCore.TwaManifest.fromWebManifestJson(
    new URL(WEB_MANIFEST_URL),
    webManifest,
  );

  twaManifest.packageId = ANDROID_PACKAGE_ID;
  twaManifest.host = 'rptrazar.mendoza.gov.ar';
  twaManifest.name = APP_NAME;
  twaManifest.launcherName = LAUNCHER_NAME;
  twaManifest.display = 'standalone';
  twaManifest.themeColor = new bubblewrapCore.TwaManifest({
    ...twaManifest.toJson(),
    themeColor: '#0D8A4F',
  }).themeColor;
  twaManifest.themeColorDark = twaManifest.themeColor;
  twaManifest.navigationColor = twaManifest.themeColor;
  twaManifest.navigationColorDark = twaManifest.themeColor;
  twaManifest.navigationDividerColor = twaManifest.themeColor;
  twaManifest.navigationDividerColorDark = twaManifest.themeColor;
  twaManifest.backgroundColor = new bubblewrapCore.TwaManifest({
    ...twaManifest.toJson(),
    backgroundColor: '#0f172a',
  }).backgroundColor;
  twaManifest.enableNotifications = true;
  twaManifest.startUrl = '/app/';
  twaManifest.orientation = 'portrait-primary';
  twaManifest.fallbackType = 'customtabs';
  twaManifest.features = {
    ...twaManifest.features,
    locationDelegation: { enabled: true },
  };
  twaManifest.appVersionCode = APP_VERSION_CODE;
  twaManifest.appVersionName = APP_VERSION_NAME;
  twaManifest.signingKey = {
    path: path.relative(TARGET_DIR, RELEASE_KEYSTORE),
    alias: RELEASE_KEY_ALIAS,
  };
  twaManifest.fingerprints = EXPECTED_FINGERPRINT ? [{ value: EXPECTED_FINGERPRINT }] : [];
  twaManifest.generatorApp = 'bubblewrap-cli-local-curl';

  fs.mkdirSync(TARGET_DIR, { recursive: true });
  const generator = new bubblewrapCore.TwaGenerator();
  await generator.removeTwaProject(TARGET_DIR);
  await twaManifest.saveToFile(path.join(TARGET_DIR, 'twa-manifest.json'));

  const log = {
    debug() {},
    info(message) {
      if (message) console.log(message);
    },
    warn(message) {
      if (message) console.warn(message);
    },
    error(message) {
      if (message) console.error(message);
    },
  };
  await generator.createTwaProject(TARGET_DIR, twaManifest, log, (current, total) => {
    process.stdout.write(`Generating TWA ${current}/${total}\r`);
  });
  process.stdout.write('\n');

  const manifestPath = path.join(TARGET_DIR, 'twa-manifest.json');
  const checksum = crypto.createHash('sha1').update(fs.readFileSync(manifestPath)).digest('hex');
  fs.writeFileSync(path.join(TARGET_DIR, 'manifest-checksum.txt'), checksum);

  console.log(`Generated ${TARGET_DIR}`);
  console.log(`Package ${ANDROID_PACKAGE_ID}`);
  console.log(`Signing key expected at ${twaManifest.signingKey.path}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
