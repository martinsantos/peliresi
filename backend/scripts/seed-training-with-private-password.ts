/** Seed isolated training fixtures without exposing the password in logs. */
export {};
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');

const credentialsPath = process.argv[2];
const runLabel = process.argv[3];
if (!credentialsPath || !/^training-access-\d{8}\.txt$/.test(path.basename(credentialsPath))) {
  throw new Error('Pass a dated training-access file path.');
}
if (!/^20\d{6}$/.test(runLabel || '')) {
  throw new Error('Pass an eight-digit training run label.');
}

require('dotenv').config();
if (process.env.DISABLE_EMAILS !== 'true') {
  throw new Error('Email sending must be disabled before seeding training data.');
}
if (new URL(process.env.DATABASE_URL).pathname !== '/sitrep_prod') {
  throw new Error('Unexpected database target; no training data created.');
}

let password;
if (fs.existsSync(credentialsPath)) {
  const match = fs.readFileSync(credentialsPath, 'utf8').match(/^PASSWORD=(.+)$/m);
  if (!match) throw new Error('Existing training access file is invalid.');
  password = match[1];
} else {
  password = crypto.randomBytes(24).toString('base64url');
  const text = [
    `TRAINING_RUN_LABEL=${runLabel}`,
    'GENERADOR=capacitacion.generador@rptrazar.mendoza.gov.ar',
    'TRANSPORTISTA=capacitacion.transportista@rptrazar.mendoza.gov.ar',
    'OPERADOR=capacitacion.operador@rptrazar.mendoza.gov.ar',
    `PASSWORD=${password}`,
    '',
  ].join('\n');
  fs.writeFileSync(credentialsPath, text, { flag: 'wx', mode: 0o600 });
}

const result = childProcess.spawnSync(process.execPath, ['prisma/seed-production-training.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    TRAINING_DEFAULT_PASSWORD: password,
    TRAINING_RUN_LABEL: runLabel,
  },
  stdio: 'inherit',
  timeout: 120000,
});
if (result.status !== 0) {
  throw new Error(`Training seed failed (exit ${result.status ?? 'unknown'}).`);
}
console.log('Training credentials remain in the private access file; no password was printed.');
