#!/usr/bin/env node
'use strict';

const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const secretsDir = path.join(repoRoot, 'android-twa', 'secrets');
const defaultTarget = path.join(repoRoot, 'android-twa', 'build-rptrazar-new');
const defaultKeystore = path.join(secretsDir, 'rptrazar-release.keystore');
const defaultFingerprintFile = path.join(secretsDir, 'rptrazar-release.sha256');

process.argv[2] = process.argv[2] || defaultTarget;
process.env.RPTRAZAR_TWA_PACKAGE_ID ||= 'ar.gob.mendoza.rptrazar';
process.env.RPTRAZAR_TWA_NAME ||= 'RP Trazar - Residuos Peligrosos';
process.env.RPTRAZAR_TWA_LAUNCHER_NAME ||= 'RP Trazar';
process.env.RPTRAZAR_TWA_VERSION_CODE ||= '1';
process.env.RPTRAZAR_TWA_VERSION_NAME ||= '1.0.0';
process.env.RPTRAZAR_TWA_KEYSTORE ||= defaultKeystore;
process.env.RPTRAZAR_TWA_KEY_ALIAS ||= 'rptrazar';

try {
  const fs = require('fs');
  if (!process.env.RPTRAZAR_TWA_FINGERPRINT && fs.existsSync(defaultFingerprintFile)) {
    process.env.RPTRAZAR_TWA_FINGERPRINT = fs.readFileSync(defaultFingerprintFile, 'utf8').trim();
  }
} catch {
  // The base generator can still run without a local fingerprint, but assetlinks
  // must be updated before Android App Links verification can pass.
}

require('./generate-rptrazar-twa.cjs');
