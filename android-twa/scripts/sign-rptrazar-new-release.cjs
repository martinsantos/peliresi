#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const projectDir = path.join(repoRoot, 'android-twa', 'build-rptrazar-new');
const secretsDir = path.join(repoRoot, 'android-twa', 'secrets');
const envPath = path.join(secretsDir, 'rptrazar-release.env');
const keystorePath = path.join(secretsDir, 'rptrazar-release.keystore');
const javaHome = process.env.JAVA_HOME || path.join(os.homedir(), '.bubblewrap', 'jdk', 'jdk-17.0.11+9', 'Contents', 'Home');
const androidHome = process.env.ANDROID_HOME || path.join(os.homedir(), '.bubblewrap', 'android_sdk');
const buildTools = path.join(androidHome, 'build-tools', '35.0.0');
const zipalign = path.join(buildTools, 'zipalign');
const apksigner = path.join(buildTools, 'apksigner');
const jarsigner = path.join(javaHome, 'bin', 'jarsigner');

function readEnvFile(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    env[line.slice(0, index)] = line.slice(index + 1);
  }
  return env;
}

function run(command, args, options = {}) {
  const result = childProcess.spawnSync(command, args, {
    cwd: projectDir,
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: androidHome, ...options.env },
    input: options.input,
  });
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

const signingEnv = readEnvFile(envPath);
const alias = signingEnv.RPTRAZAR_TWA_KEY_ALIAS || 'rptrazar';
const password = signingEnv.RPTRAZAR_TWA_KEYSTORE_PASSWORD;
if (!password) throw new Error(`Missing RPTRAZAR_TWA_KEYSTORE_PASSWORD in ${envPath}`);

const unsignedApk = 'app/build/outputs/apk/release/app-release-unsigned.apk';
const alignedApk = 'app/build/outputs/apk/release/app-release-aligned.apk';
const signedApk = 'app/build/outputs/apk/release/app-release-signed.apk';
const unsignedAab = 'app/build/outputs/bundle/release/app-release.aab';
const signedAab = 'app/build/outputs/bundle/release/app-release-signed.aab';

run(zipalign, ['-p', '-f', '4', unsignedApk, alignedApk]);
run(apksigner, [
  'sign',
  '--ks',
  keystorePath,
  '--ks-key-alias',
  alias,
  '--ks-pass',
  'env:RPTRAZAR_TWA_KEYSTORE_PASSWORD',
  '--out',
  signedApk,
  alignedApk,
], { env: signingEnv });
const verifyApk = run(apksigner, ['verify', '--print-certs', signedApk]);

run(jarsigner, [
  '-keystore',
  keystorePath,
  '-storetype',
  'PKCS12',
  '-signedjar',
  signedAab,
  unsignedAab,
  alias,
], { input: `${password}\n` });
const verifyAab = run(jarsigner, ['-verify', '-verbose', '-certs', signedAab]);

const apkFingerprint = verifyApk.stdout.match(/SHA-256 digest:\s*([0-9a-f]+)/i)?.[1]?.toUpperCase();
console.log(`Signed APK ${path.join(projectDir, signedApk)}`);
console.log(`Signed AAB ${path.join(projectDir, signedAab)}`);
console.log(`APK SHA256 ${apkFingerprint || 'unknown'}`);
console.log(verifyAab.stdout.includes('jar verified') ? 'AAB verified' : 'AAB verification completed');
