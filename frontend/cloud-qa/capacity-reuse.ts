import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertCloudEnvironment, assertCloudDatabase, root } from './safety.ts';
export const CAPACITY_BASELINE = { run: '37837156424', commit: 'd12d57fa34ee048aae72a743dd25208406a1dd3c' };
export function assertCapacityReuse(prior: any, frozen: any, current: any) {
  assert.equal(prior.commit, CAPACITY_BASELINE.commit); assert.equal(frozen.commit, CAPACITY_BASELINE.commit);
  assert.deepEqual(current.backendFiles, frozen.backendFiles); assert.ok(frozen.backendFiles.length > 100);
  assert.equal(prior.accounts, 50); assert.equal(prior.distinctAccounts, 50); assert.equal(prior.authenticatedAccounts, 50);
  assert.equal(prior.externalProvidersDisabled, true); assert.equal(prior.productionDataWritten, false);
  assert.equal(prior.checks.length, 7); assert.ok(prior.checks.slice(0,6).every((row: any) => row.status === 'PASS'));
  assert.equal(prior.checks[6].status, 'FAIL'); assert.equal(prior.checks[6].error, 'TypeError: Do not know how to serialize a BigInt');
  assert.ok(Date.parse(prior.endedAt) - Date.parse(prior.startedAt) >= 1800000);
  assert.deepEqual(prior.phases, [{ sessions: 10, seconds: 300 }, { sessions: 25, seconds: 300 }, { sessions: 50, seconds: 1200 }]);
  assert.ok(prior.samples.length >= 50);
  for (const row of prior.samples) {
    assert.ok(row.database.connections <= 45); assert.equal(row.workers.workers.length, 2);
    assert.ok(row.workers.workers.every((worker: any) => worker.node.startsWith('v20.19.') && worker.rss < 450 * 1048576));
  }
  for (const [group, maximum] of [['read', 2000], ['write', 3000], ['pdf', 5000]] as const) {
    const metric = prior.metrics.find((row: any) => row.group === group); assert.ok(metric.count > 0 && metric.p95Ms < maximum);
    assert.ok(Object.keys(metric.statuses).every(status => ['200', '201', '403', '404', '409'].includes(status)));
  }
}
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const priorDirectory = () => {
  assert.ok(process.env.RUNNER_TEMP && path.isAbsolute(process.env.RUNNER_TEMP));
  return path.join(process.env.RUNNER_TEMP!, 'sitrep-capacity-baseline139');
};
async function main() {
  assertCloudEnvironment(); assert.equal(process.env.QA_RECOVERY_ONLY, 'true'); assert.equal(process.env.QA_BROWSER_REUSE, 'true');
  const output = process.env.QA_ARTIFACTS!, directory = priorDirectory();
  const read = async (dir: string, name: string) => JSON.parse(await readFile(path.join(dir,name),'utf8'));
  const prior = await read(directory,'multiuser.json'), frozen = await read(directory,'build-frozen.json'), current = await read(output,'build-frozen.json');
  assertCapacityReuse(prior,frozen,current);
  const changed = execFileSync('git',['diff','--name-only',CAPACITY_BASELINE.commit,'HEAD'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
  const allowed = new Set(['.github/workflows/certification-tests.yml','frontend/cloud-qa/multiuser.ts','frontend/cloud-qa/multiuser-package.ts',
    'frontend/cloud-qa/browser-reuse.ts','frontend/cloud-qa/capacity-reuse.ts','frontend/cloud-qa/capacity-reuse.test.ts',
    'frontend/cloud-qa/evidence-json.ts','frontend/cloud-qa/evidence-json.test.ts']);
  assert.ok(changed.every(file=>allowed.has(file)), 'Capacity reuse rejects any product, unit or business-journey change');
  const token = process.env.QA_GITHUB_TOKEN; assert.ok(token);
  async function github(suffix: string) {
    const response = await fetch('https://api.github.com/repos/martinsantos/peliresi/actions/runs/'+CAPACITY_BASELINE.run+suffix,
      {headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,200); return response.json();
  }
  const run = await github(''), jobs = await github('/jobs'); assert.equal(run.head_sha,CAPACITY_BASELINE.commit);
  assert.equal(run.status,'completed'); assert.equal(run.conclusion,'failure');
  const steps = jobs.jobs.find((job: any)=>job.name==='isolated-qa').steps;
  const failed = steps.filter((step: any)=>step.conclusion==='failure').map((step: any)=>step.name);
  assert.deepEqual(failed,['Thirty-minute mixed users behind Nginx, two actual Node20 workers and real DB/files restore']);
  assert.equal(steps.find((step: any)=>step.name==='Close owned QA processes and PostgreSQL').conclusion,'success');
  const raw = await readFile(path.join(directory,'multiuser.json'));
  await writeFile(path.join(output,'multiuser-prior139.json'),raw,{flag:'wx'});
  const files = await Promise.all(['multiuser-database.dump','multiuser-uploads.tar.gz'].map(async file=>({file,sha256:sha(await readFile(path.join(directory,file)))})));
  await writeFile(path.join(output,'capacity-reuse.json'),JSON.stringify({baselineRun:CAPACITY_BASELINE.run,baselineCommit:CAPACITY_BASELINE.commit,
    currentCommit:process.env.GITHUB_SHA,originalReportSha256:sha(raw),files,backendBytesIdentical:true,capacityRepeatedThisRun:false,
    sixPassedChecksRetained:true,priorRecoveryLoggingFailurePreserved:true,sourceDatabase:'sitrep_night_qa_20260926',port:55440},null,2));
  console.log('Actual thirty-minute/six-check capacity proof retained unchanged; a new physical/DB restore is still mandatory');
}
export async function restoreCapacitySource() {
  await assertCloudDatabase(); assert.equal(process.env.QA_RECOVERY_ONLY,'true');
  const directory = priorDirectory(), output = process.env.QA_ARTIFACTS!;
  const receipt = JSON.parse(await readFile(path.join(output,'capacity-reuse.json'),'utf8'));
  assert.equal(receipt.currentCommit,process.env.GITHUB_SHA); assert.equal(receipt.baselineRun,CAPACITY_BASELINE.run);
  for (const row of receipt.files) assert.equal(sha(await readFile(path.join(directory,row.file))),row.sha256);
  const raw = await readFile(path.join(directory,'multiuser.json')); assert.equal(sha(raw),receipt.originalReportSha256);
  const dump = path.join(directory,'multiuser-database.dump');
  assert.equal((await readFile(dump)).subarray(0,5).toString(),'PGDMP');
  // Only the disposable named synthetic DB is reset, after owned servers stop.
  execFileSync('/usr/lib/postgresql/16/bin/pg_restore',['-h','127.0.0.1','-p','55440','-U','qa','-d','sitrep_night_qa_20260926',
    '--clean','--if-exists','--exit-on-error',dump],{timeout:60000});
  const uploads = process.env.UPLOADS_DIR!; assert.equal(uploads,path.join(output,'uploads'));
  // Current synthetic uploads are unrelated to the restored snapshot; keep
  // them in their own evidence folder, never overwrite their bytes.
  const { rename } = await import('node:fs/promises');
  await rename(uploads,path.join(output,'uploads-before-source-restore'));
  await mkdir(uploads); execFileSync('tar',['-xzf',path.join(directory,'multiuser-uploads.tar.gz'),'-C',uploads]);
  return JSON.parse(raw.toString());
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main();
