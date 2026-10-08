import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertCloudEnvironment, root } from './safety.ts';
import { assertFullE2EEvidence, type FullE2EEvidence } from './e2e-evidence.ts';

export const BROWSER_BASELINE = { run: '37831212967', commit: '436d830ce3d38beff230719e799d4ed6af8371b4' };
const allowedHarnessChanges = new Set([
  '.github/workflows/certification-tests.yml',
  'frontend/cloud-qa/multiuser.ts', 'frontend/cloud-qa/multiuser-seed.test.ts',
  'frontend/cloud-qa/browser-reuse.ts', 'frontend/cloud-qa/browser-reuse.test.ts',
  'frontend/cloud-qa/multiuser-package.ts',
]);
type File = { file: string; sha256: string };
type Frozen = { commit: string; backendFiles: File[] };
type Step = { name: string; conclusion: string };
export function assertBrowserReuse(input: { baseline: Frozen; current: Frozen; commit: string; changed: string[];
  report: FullE2EEvidence; run: { head_sha: string; status: string; conclusion: string }; steps: Step[] }) {
  assert.equal(input.run.head_sha, BROWSER_BASELINE.commit);
  assert.equal(input.run.status, 'completed'); assert.equal(input.run.conclusion, 'failure');
  assert.equal(input.baseline.commit, BROWSER_BASELINE.commit); assert.equal(input.current.commit, input.commit);
  assert.ok(input.changed.every(file => allowedHarnessChanges.has(file)), 'Never reuse after a product, unit, schema, build, manual or browser-journey change');
  const failures = input.steps.filter(step => step.conclusion === 'failure').map(step => step.name);
  assert.deepEqual(failures, ['Thirty-minute mixed users behind Nginx, two actual Node20 workers and real DB/files restore']);
  for (const name of ['Backend and frontend unit tests with disconnected DB', 'Compile isolated candidate backend, web and app',
    'Actual web and app E2E, one browser worker, no fake auth', 'Close owned QA processes and PostgreSQL'])
    assert.equal(input.steps.find(step => step.name === name)?.conclusion, 'success', name);
  assert.ok(input.baseline.backendFiles.length > 100 && input.current.backendFiles.length > 100);
  const sort = (files: File[]) => [...files].sort((a,b) => a.file.localeCompare(b.file));
  assert.deepEqual(sort(input.current.backendFiles), sort(input.baseline.backendFiles), 'Require byte-identical compiled backend, schema and generated runtime');
  for (const file of ['dist/index.js', 'dist/lib/prismaConnection.js', 'dist/controllers/monitor.controller.js', 'prisma/schema.prisma'])
    assert.ok(input.current.backendFiles.some(row => row.file === file));
  assertFullE2EEvidence(input.report);
}
async function main() {
  assertCloudEnvironment(); assert.equal(process.env.QA_MULTIUSER, 'true'); assert.equal(process.env.QA_BROWSER_REUSE, 'true');
  const baseline = process.env.QA_BROWSER_BASELINE!;
  assert.equal(baseline, path.join(process.env.RUNNER_TEMP!, 'sitrep-browser-baseline138'));
  const output = process.env.QA_ARTIFACTS!;
  const read = async (directory: string, name: string) => JSON.parse(await readFile(path.join(directory, name), 'utf8'));
  const token = process.env.QA_GITHUB_TOKEN; assert.ok(token);
  async function github(route: string) {
    const response = await fetch('https://api.github.com/repos/martinsantos/peliresi/actions/runs/' + BROWSER_BASELINE.run + route, {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 200); return response.json();
  }
  const run = await github(''), jobs = await github('/jobs');
  const raw = await readFile(path.join(baseline, 'e2e.json'));
  const report = JSON.parse(raw.toString());
  const old = await read(baseline, 'build-frozen.json'), current = await read(output, 'build-frozen.json');
  const changed = execFileSync('git', ['diff', '--name-only', BROWSER_BASELINE.commit, 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  assertBrowserReuse({ baseline: old, current, commit: process.env.GITHUB_SHA!, changed, report, run,
    steps: jobs.jobs.find((job: { name: string }) => job.name === 'isolated-qa').steps });
  await writeFile(path.join(output, 'e2e.json'), raw, { flag: 'wx' });
  await writeFile(path.join(output, 'browser-reuse.json'), JSON.stringify({ baselineRun: BROWSER_BASELINE.run, baselineCommit: BROWSER_BASELINE.commit,
    currentCommit: process.env.GITHUB_SHA, originalReportSha256: createHash('sha256').update(raw).digest('hex'),
    productAndBrowserSourcesUnchanged: true, backendAndPrismaBytesIdentical: true, browserRepeatedThisRun: false,
    cases: 219, scope: 'backend-only; fresh unit, HTTP, multiuser and restore gates still required',
    priorLoadFailurePreserved: true }, null, 2));
  console.log('Verified prior 219 browser cases for identical product/journeys and byte-identical backend; not counted as a new browser run');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
