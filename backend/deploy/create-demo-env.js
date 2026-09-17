/** Creates the isolated demo environment without copying production secrets. */
const fs = require('fs');
const crypto = require('crypto');

const source = fs.readFileSync('/var/www/sitrep-backend/.env', 'utf8');
const match = source.match(/^DATABASE_URL=(.*)$/m);
if (!match) throw new Error('DATABASE_URL missing from production environment');

const databaseUrl = new URL(match[1].trim().replace(/^["']|["']$/g, ''));
databaseUrl.pathname = '/trazabilidad_demo';
const certificateKeys = crypto.generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const oneLinePem = value => value.replace(/\n/g, '\\n');

const values = [
  'NODE_ENV=production',
  'HOST=127.0.0.1',
  'PORT=3457',
  `DATABASE_URL=${databaseUrl.toString()}`,
  `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`,
  `JWT_REFRESH_SECRET=${crypto.randomBytes(48).toString('hex')}`,
  'JWT_EXPIRES_IN=30m',
  'JWT_REFRESH_EXPIRES_IN=1d',
  'CORS_ORIGIN=https://www.ultimamilla.com.ar',
  'FRONTEND_URL=https://www.ultimamilla.com.ar/demoambiente',
  'BLOCKCHAIN_ENABLED=false',
  'DISABLE_EMAILS=true',
  'EMAIL_ALLOWED_RECIPIENTS=nobody@sitrep.invalid',
  'DEMO_LOGIN_ENABLED=false',
  'PRIVILEGED_ACCESS_EMAILS=capacitacion.admin@sitrep.invalid',
  'IMPERSONATION_EMAILS=capacitacion.admin@sitrep.invalid',
  'FILE_SCAN_MODE=disabled',
  `DOCUMENT_HMAC_SECRET=${crypto.randomBytes(48).toString('hex')}`,
  `CERTIFICATE_ED25519_PRIVATE_KEY=${oneLinePem(certificateKeys.privateKey)}`,
  `CERTIFICATE_ED25519_PUBLIC_KEY=${oneLinePem(certificateKeys.publicKey)}`,
  'TURNSTILE_SECRET_KEY=',
  'LOG_LEVEL=info',
];

fs.writeFileSync('/var/www/sitrep-demo-backend/.env', `${values.join('\n')}\n`, { mode: 0o600 });
console.log('Created isolated demo environment configuration.');
