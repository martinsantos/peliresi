#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const secretsDir = path.join(repoRoot, 'android-twa', 'secrets');
const keystorePath = path.join(secretsDir, 'rptrazar-release.keystore');
const envPath = path.join(secretsDir, 'rptrazar-release.env');
const fingerprintPath = path.join(secretsDir, 'rptrazar-release.sha256');
const alias = process.env.RPTRAZAR_TWA_KEY_ALIAS || 'rptrazar';
const javaHome = process.env.JAVA_HOME || path.join(os.homedir(), '.bubblewrap', 'jdk', 'jdk-17.0.11+9', 'Contents', 'Home');
const keytool = path.join(javaHome, 'bin', 'keytool');
const password = process.env.RPTRAZAR_TWA_KEYSTORE_PASSWORD ||
  crypto.randomBytes(24).toString('base64url');

function run(command, args, options = {}) {
  const result = childProcess.spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}

function extractFingerprint(output) {
  const match = output.match(/SHA256:\s*([0-9A-F:]+)/i);
  if (!match) {
    throw new Error('Could not extract SHA256 fingerprint from keytool output');
  }
  return match[1].toUpperCase();
}

fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
if (fs.existsSync(keystorePath) && process.env.RPTRAZAR_TWA_KEYSTORE_OVERWRITE !== '1') {
  throw new Error(`Refusing to overwrite existing keystore: ${keystorePath}`);
}

run(
  keytool,
  [
    '-genkeypair',
    '-storetype',
    'PKCS12',
    '-keystore',
    keystorePath,
    '-alias',
    alias,
    '-keyalg',
    'RSA',
    '-keysize',
    '2048',
    '-validity',
    '10000',
    '-dname',
    'CN=RP Trazar, OU=Engineering, O=Ultima Milla, C=AR',
  ],
  {
    input: `${password}\n${password}\n\n`,
    env: { ...process.env, JAVA_HOME: javaHome },
  },
);

const listResult = run(
  keytool,
  ['-list', '-v', '-keystore', keystorePath, '-alias', alias, '-storepass', password],
  { env: { ...process.env, JAVA_HOME: javaHome } },
);
const fingerprint = extractFingerprint(listResult.stdout);

fs.writeFileSync(
  envPath,
  [
    `RPTRAZAR_TWA_KEYSTORE=${keystorePath}`,
    `RPTRAZAR_TWA_KEY_ALIAS=${alias}`,
    `RPTRAZAR_TWA_KEYSTORE_PASSWORD=${password}`,
    `RPTRAZAR_TWA_FINGERPRINT=${fingerprint}`,
    '',
  ].join('\n'),
  { mode: 0o600 },
);
fs.writeFileSync(fingerprintPath, `${fingerprint}\n`, { mode: 0o644 });
fs.chmodSync(keystorePath, 0o600);

console.log(`Created ${keystorePath}`);
console.log(`Wrote protected signing env ${envPath}`);
console.log(`Fingerprint ${fingerprint}`);
