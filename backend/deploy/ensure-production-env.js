/* One-shot, non-logging production env preparation.
 * Run only on the intended host with the candidate .env path as argv[2].
 * It preserves existing values, creates host-specific Ed25519/HMAC material
 * when the document feature is being enabled, and enforces the no-mail gate.
 */
const crypto = require('crypto');
const fs = require('fs');

const envPath = process.argv[2];
if (!envPath) throw new Error('env path required');

const raw = fs.readFileSync(envPath, 'utf8');
const entries = new Map();
for (const line of raw.split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match) entries.set(match[1], line);
}

const setValue = (key, value) => {
  const line = `${key}=${value}`;
  entries.set(key, line);
};
const escapedPem = (pem) => pem.replace(/\r?\n/g, '\\n');

if (!entries.has('CERTIFICATE_ED25519_PRIVATE_KEY') || !entries.get('CERTIFICATE_ED25519_PRIVATE_KEY').split('=').slice(1).join('=')) {
  const pair = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  setValue('CERTIFICATE_ED25519_PRIVATE_KEY', escapedPem(pair.privateKey));
  setValue('CERTIFICATE_ED25519_PUBLIC_KEY', escapedPem(pair.publicKey));
}
if (!entries.has('CERTIFICATE_ED25519_PUBLIC_KEY') || !entries.get('CERTIFICATE_ED25519_PUBLIC_KEY').split('=').slice(1).join('=')) {
  throw new Error('public key missing while private key exists; refusing partial signing configuration');
}
if (!entries.has('DOCUMENT_HMAC_SECRET') || !entries.get('DOCUMENT_HMAC_SECRET').split('=').slice(1).join('=')) {
  setValue('DOCUMENT_HMAC_SECRET', crypto.randomBytes(48).toString('hex'));
}
setValue('DISABLE_EMAILS', 'true');
setValue('EMAIL_ALLOWED_RECIPIENTS', 'santosma@gmail.com');
setValue('FILE_SCAN_MODE', process.env.SITREP_FILE_SCAN_MODE || 'required');
setValue('CLAMAV_SCAN_CMD', process.env.SITREP_CLAMAV_SCAN_CMD || '/usr/bin/clamscan --no-summary');
setValue('UPLOADS_DIR', process.env.SITREP_UPLOADS_DIR || '/var/lib/sitrep/uploads');

const order = [];
for (const line of raw.split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
  if (match && !order.includes(match[1])) order.push(match[1]);
}
for (const key of entries.keys()) if (!order.includes(key)) order.push(key);
fs.writeFileSync(envPath, `${order.map((key) => entries.get(key)).join('\n')}\n`, { mode: 0o600 });
console.log(JSON.stringify({ envPath, generatedSigningKeys: true, emailDisabled: true, allowedRecipient: 'santosma@gmail.com', fileScanMode: entries.get('FILE_SCAN_MODE').split('=').slice(1).join('='), uploadsDir: entries.get('UPLOADS_DIR').split('=').slice(1).join('=') }));
