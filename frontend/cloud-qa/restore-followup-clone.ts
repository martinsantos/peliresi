/** Restore one named, previously verified synthetic preview backup into a new QA-only database. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const host = 'openclaw-vps', container = 'sitrep-qa-training-20261018';
const source = 'sitrep_night_qa_20260926', target = 'sitrep_followup_isolation_20261031b';
const directory = '/Users/santosma/Documents/SITREP-respaldo-preview-20261027';
const archive = `${directory}/copia-ce2eb1cb-20261031/preview-base-ce2eb1cb.dump.gpg`;
const proof = JSON.parse(readFileSync(`${directory}/copia-ce2eb1cb-20261031/restauracion-preview-ce2eb1cb.json`, 'utf8'));
assert.equal(proof.source, source); assert.equal(proof.production, false); assert.equal(proof.equal, true);
assert.equal(proof.tables, 128); assert.equal(proof.fullDecryptVerified, true);
assert.equal(createHash('sha256').update(readFileSync(archive)).digest('hex'), proof.archive_sha256);
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const ssh = (parts: string[]) => {
  const result = spawnSync('ssh', ['-o', 'BatchMode=yes', host, parts.map(quote).join(' ')], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`QA command failed: ${result.stderr.slice(-1200)}`);
  return result.stdout;
};
const docker = (parts: string[]) => ssh(['docker', 'exec', container, ...parts]);
const inspected = JSON.parse(ssh(['docker', 'inspect', container]))[0];
const networks = Object.keys(inspected.NetworkSettings.Networks).sort();
assert.deepEqual(networks, ['sitrep-qa-enterprise-net-20261016']);
assert.equal(JSON.parse(ssh(['docker', 'network', 'inspect', networks[0]]))[0].Internal, true);
assert.equal(Object.values(inspected.NetworkSettings.Ports ?? {}).some(Boolean), false);
assert.equal(inspected.HostConfig.NanoCpus, 1000000000);
assert.equal(inspected.HostConfig.Memory, 2147483648);
assert.equal(inspected.HostConfig.MemorySwap, 2147483648);
const connection = ['-h', '127.0.0.1', '-p', '55440', '-U', 'qa'];
const psql = (database: string, query: string) => docker(['psql', '--no-psqlrc', '-A', '-t', '-v', 'ON_ERROR_STOP=1', ...connection, '-d', database, '-c', query]).trim();
assert.equal(psql(source, 'SELECT current_database(), inet_server_port(), host(inet_server_addr())'), `${source}|55440|127.0.0.1`);
assert.equal(psql(source, `SELECT count(*) FROM pg_database WHERE datname='${target}'`), '0');
docker(['mkdir', '-m', '700', '/work/sitrep/.qa-followup-clone-20261031b']);
docker(['createdb', ...connection, target]);
const decrypt = spawn('gpg', ['--batch', '--pinentry-mode', 'loopback', '--passphrase-file', `${directory}/clave-recuperacion.txt`, '--decrypt', archive], { stdio: ['ignore', 'pipe', 'pipe'] });
const restore = spawn('ssh', ['-o', 'BatchMode=yes', host, ['docker', 'exec', '-i', container, 'pg_restore', '--no-owner', '--no-acl', '--exit-on-error', ...connection, '-d', target].map(quote).join(' ')], { stdio: ['pipe', 'ignore', 'pipe'] });
let errors = ''; decrypt.stderr.on('data', chunk => { errors += chunk.toString(); }); restore.stderr.on('data', chunk => { errors += chunk.toString(); });
const completed = (child: typeof decrypt) => new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
const waits = [completed(decrypt), completed(restore)];
await pipeline(decrypt.stdout, restore.stdin);
const codes = await Promise.all(waits);
assert.deepEqual(codes, [0, 0], `Synthetic restore failed: ${errors.slice(-1200)}`);
assert.equal(psql(target, 'SELECT current_database(), inet_server_port(), host(inet_server_addr())'), `${target}|55440|127.0.0.1`);
const query = `SELECT n.nspname,c.relname,(xpath('//row/digest/text()',query_to_xml(format($q$SELECT count(*)::text || ':' || md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS digest FROM %I.%I AS t$q$,n.nspname,c.relname),false,true,'')))[1]::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' ORDER BY n.nspname,c.relname;`;
const rows = psql(target, query).split('\n');
assert.equal(rows.length, proof.tables);
assert.equal(createHash('sha256').update(rows.join('\n')).digest('hex'), proof.digest);
const result = { synthetic: true, production: false, sourceBackupSha256: proof.archive_sha256, target, tables: rows.length,
  digest: proof.digest, equal: true, ownersAndAclVerified: false, networkInternal: true, publishedPorts: false };
const write = spawnSync('ssh', ['-o', 'BatchMode=yes', host, ['docker', 'exec', '-i', container, 'sh', '-c', 'umask 077; test ! -e /work/sitrep/.qa-followup-clone-20261031b/restore-proof.json; cat > /work/sitrep/.qa-followup-clone-20261031b/restore-proof.json'].map(quote).join(' ')],
  { input: JSON.stringify(result, null, 2), encoding: 'utf8' });
assert.equal(write.status, 0, write.stderr); console.log(JSON.stringify(result));
