import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { assertCloudEnvironment, root } from './safety.ts';

assertCloudEnvironment();
const baseline = JSON.parse(readFileSync(new URL('./unit-baseline.json', import.meta.url), 'utf8'));
const listing = execFileSync('git', ['ls-tree', '-r', 'HEAD', '--', 'backend', 'frontend', 'scripts'], { cwd: root, encoding: 'utf8' })
  .split('\n').filter(line => line && !line.includes('\tfrontend/cloud-qa/')).join('\n');
const actualHash = createHash('sha256').update(listing).digest('hex');
assert.equal(actualHash, baseline.hash, 'Unit reuse is forbidden after ANY product, unit, package, schema or build-script change');
assert.equal(listing.split('\n').length, baseline.trackedFiles);
assert.equal(baseline.backend.failed + baseline.frontend.failed + baseline.backend.pending + baseline.frontend.pending, 0);
writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'unit-reuse.json'), JSON.stringify({
  ...baseline, currentQACommit: process.env.GITHUB_SHA, actualHash,
  repeatedThisRun: false, reason: 'Only the cloud QA harness changed; all tracked product and unit files are byte-identical',
}, null, 2));
console.log(`Reusing measured ${baseline.backend.passed} backend and ${baseline.frontend.passed} frontend unit gates for byte-identical product sources; not counting repeats as new tests or approving the prior E2E`);
