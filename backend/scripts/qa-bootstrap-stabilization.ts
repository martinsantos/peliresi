/** Run on the SITREP host with Node stdin. Creates a NEW isolated QA database.
 * Copies schema + successful Prisma migration metadata only, NEVER actor data.
 * Refuses existing targets; no production env, credential or service changes.
 * This script is intentionally valid Node CommonJS as well as TypeScript.
 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

let stage = 'preflight';
try {
if (process.env.QA_BOOTSTRAP_CONFIRM !== 'YES') throw new Error('QA_BOOTSTRAP_CONFIRM=YES required');
const database = 'sitrep_qa_stabilization_20260905';
const role = 'sitrep_qa_stabilization_20260905';
const runtime = '/opt/sitrep-qa-stabilization-20260905';
const container = 'directus-admin-database-1';
const password = crypto.randomBytes(32).toString('hex');
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const admin = sql => execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'directus', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
if (fs.existsSync(`${runtime}/.env`)) throw new Error('QA runtime already configured; inspect rather than overwrite');
const exists = !!admin(`SELECT datname FROM pg_database WHERE datname=${literal(database)};`).trim();
const roleExists = !!admin(`SELECT rolname FROM pg_roles WHERE rolname=${literal(role)};`).trim();
if (exists || roleExists) {
  if (process.env.QA_BOOTSTRAP_REPAIR !== 'YES' || !exists || !roleExists) throw new Error('QA target exists; refusing overwrite');
  const tableCount = execFileSync('docker', ['exec', container, 'psql', '-U', 'directus', '-d', database, '-Atc', "SELECT count(*) FROM pg_tables WHERE schemaname='public'"], { encoding: 'utf8' }).trim();
  if (tableCount !== '0') throw new Error('Repair refuses a QA database with existing tables');
}

const schema = execFileSync('docker', ['exec', container, 'pg_dump', '-U', 'directus', '-d', 'trazabilidad_rrpp', '--schema-only', '--no-owner', '--no-privileges'], { maxBuffer: 16 * 1024 * 1024 });
const migrations = JSON.parse(execFileSync('docker', ['exec', container, 'psql', '-U', 'directus', '-d', 'trazabilidad_rrpp', '-Atc', `SELECT coalesce(json_agg(json_build_object('name',migration_name,'checksum',checksum)), '[]'::json) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`], { encoding: 'utf8' }));
const failed = execFileSync('docker', ['exec', container, 'psql', '-U', 'directus', '-d', 'trazabilidad_rrpp', '-Atc', 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL'], { encoding: 'utf8' }).trim();
if (failed !== '0') throw new Error('Source has unresolved Prisma migrations; investigate before QA baseline');

stage = 'create isolated role/database';
if (!exists) {
  admin(`CREATE ROLE ${role} LOGIN PASSWORD ${literal(password)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;`);
  admin(`CREATE DATABASE ${database} OWNER ${role};`);
} else {
  // Only an explicitly confirmed empty failed QA bootstrap can reach here.
  admin(`ALTER ROLE ${role} PASSWORD ${literal(password)};`);
}
execFileSync('docker', ['exec', container, 'psql', '-U', 'directus', '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', `ALTER SCHEMA public OWNER TO ${role}`], { stdio: 'pipe' });
const qa = sql => execFileSync('docker', ['exec', '-i', '-e', `PGPASSWORD=${password}`, container, 'psql', '-h', '127.0.0.1', '-U', role, '-d', database, '-v', 'ON_ERROR_STOP=1'], { input: sql, maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
stage = 'restore schema only';
qa('BEGIN;\n' + schema.toString('utf8').replace(/^CREATE SCHEMA public;$/m, '') + '\nCOMMIT;');
for (const migration of migrations) qa(`INSERT INTO _prisma_migrations (id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES (${literal(crypto.randomUUID())},${literal(migration.checksum)},${literal(migration.name)},now(),now(),1);`);

stage = 'write private QA configuration';
fs.mkdirSync(runtime, { recursive: true, mode: 0o700 });
// Static enrichment is optional business context, not part of the database
// schema. Empty QA catalogs prevent importing real registration data.
fs.mkdirSync(`${runtime}/data`, { recursive: true, mode: 0o700 });
for (const [name, value] of Object.entries({ 'generadores-enrichment': {}, 'generadores-top-rubros': [], 'operadores-enrichment': {}, 'operadores-por-corriente': {} })) {
  fs.writeFileSync(`${runtime}/data/${name}.json`, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
}
const storage = '/var/lib/sitrep-qa-uploads-20260905';
fs.mkdirSync(storage, { recursive: true, mode: 0o700 });
const keys = crypto.generateKeyPairSync('ed25519', { privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const env = {
  NODE_ENV: 'qa', HOST: '127.0.0.1', PORT: '3103',
  DATABASE_URL: `postgresql://${role}:${password}@127.0.0.1:5432/${database}?schema=public&connection_limit=5`,
  JWT_SECRET: crypto.randomBytes(48).toString('hex'), JWT_REFRESH_SECRET: crypto.randomBytes(48).toString('hex'),
  DISABLE_EMAILS: 'true', EMAIL_ALLOWED_RECIPIENTS: 'nobody@example.invalid',
  BLOCKCHAIN_ENABLED: 'false', DEMO_LOGIN_ENABLED: 'false',
  PRIVILEGED_ACCESS_EMAILS: 'admin@dgfa.mendoza.gov.ar,qa.admin.generador@sitrep.local,qa.admin.operador@sitrep.local,qa.admin.transportista@sitrep.local', IMPERSONATION_EMAILS: 'admin@dgfa.mendoza.gov.ar',
  FILE_SCAN_MODE: 'required', CLAMAV_SCAN_CMD: '/usr/bin/clamscan --no-summary', UPLOADS_DIR: storage,
  DOCUMENT_HMAC_SECRET: crypto.randomBytes(48).toString('hex'),
  CERTIFICATE_ED25519_PRIVATE_KEY: keys.privateKey, CERTIFICATE_ED25519_PUBLIC_KEY: keys.publicKey,
  CORS_ORIGIN: 'http://127.0.0.1:4179,http://localhost:4179', FRONTEND_URL: 'http://127.0.0.1:4179',
  QA_CONFIRM_ISOLATED: 'YES', QA_E2E_ENABLED: 'true', QA_E2E_CONFIRM: 'YES', QA_DISABLE_EMAILS: 'true',
  QA_ADMIN_EMAIL: 'admin@dgfa.mendoza.gov.ar', QA_ADMIN_PASSWORD: crypto.randomBytes(24).toString('base64url'),
};
fs.writeFileSync(`${runtime}/.env`, Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ database, runtime, storage, schemaOnly: true, migrationRecords: migrations.length, emailDisabled: true, bind: '127.0.0.1:3103' }));
} catch {
  // execFileSync errors can include environment arguments: never dump them.
  console.error(`QA bootstrap failed at: ${stage}. Inspect exact QA targets before retrying; nothing is removed automatically.`);
  process.exitCode = 1;
}
