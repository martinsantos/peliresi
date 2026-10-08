import assert from 'node:assert/strict';
import test from 'node:test';
import { assertBrowserReuse, BROWSER_BASELINE } from './browser-reuse.ts';
function complete() {
  const files = ['dist/index.js', 'dist/lib/prismaConnection.js', 'dist/controllers/monitor.controller.js', 'prisma/schema.prisma',
    ...Array.from({ length: 100 }, (_, index) => 'dist/file-' + index + '.js')].map(file => ({ file, sha256: 'synthetic' }));
  return { baseline: { commit: BROWSER_BASELINE.commit, backendFiles: files },
    current: { commit: 'new-qa-only', backendFiles: files.map(row => ({ ...row })) }, commit: 'new-qa-only',
    changed: ['frontend/cloud-qa/multiuser.ts', 'frontend/cloud-qa/browser-reuse.ts'],
    run: { head_sha: BROWSER_BASELINE.commit, status: 'completed', conclusion: 'failure' },
    steps: ['Backend and frontend unit tests with disconnected DB', 'Compile isolated candidate backend, web and app',
      'Actual web and app E2E, one browser worker, no fake auth', 'Close owned QA processes and PostgreSQL'].map(name => ({ name, conclusion: 'success' }))
      .concat([{ name: 'Thirty-minute mixed users behind Nginx, two actual Node20 workers and real DB/files restore', conclusion: 'failure' }]),
    report: { stats: { expected: 219, unexpected: 0, flaky: 0, skipped: 0 }, errors: [],
      suites: [{ suites: ['web-desktop', 'web-responsive', 'app'].map(projectName => ({ specs: Array.from({ length: 73 }, () => ({ tests: [{
        projectName, status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed', retry: 0 }],
      }] })) })) }] },
  };
}
test('only full, unchanged browser journeys and identical backend/runtime bytes can be reused', () => {
  assert.doesNotThrow(() => assertBrowserReuse(complete()));
});
test('any source/schema/manual/journey change requires a new browser run', () => {
  for (const file of ['backend/src/lib/prisma.ts', 'backend/src/__tests__/x.test.ts', 'frontend/src-v6/App.tsx',
    'backend/prisma/schema.prisma', 'frontend/cloud-qa/e2e/support.spec.ts', 'frontend/cloud-qa/prepare.ts', 'docs/manual/directorio.html']) {
    const proof = complete(); proof.changed.push(file); assert.throws(() => assertBrowserReuse(proof));
  }
});
test('changing one compiled file or generated client blocks reuse', () => {
  const proof = complete(); proof.current.backendFiles[0].sha256 = 'different'; assert.throws(() => assertBrowserReuse(proof));
});
test('an interrupted/failing/retried/incomplete browser run cannot become green evidence', () => {
  for (const kind of ['interrupted', 'failing', 'retried', 'missing'] as const) {
    const proof = complete();
    if (kind === 'interrupted') proof.steps[2].conclusion = 'cancelled';
    if (kind === 'failing') proof.report.stats.unexpected = 1;
    if (kind === 'retried') proof.report.stats.flaky = 1;
    if (kind === 'missing') proof.report.suites[0].suites[0].specs.pop();
    assert.throws(() => assertBrowserReuse(proof));
  }
});
test('wrong commit, extra failure or missing closure prevents reuse', () => {
  for (const kind of ['commit', 'failure', 'closure'] as const) {
    const proof = complete();
    if (kind === 'commit') proof.run.head_sha = 'wrong';
    if (kind === 'failure') proof.steps[0].conclusion = 'failure';
    if (kind === 'closure') proof.steps[3].conclusion = 'cancelled';
    assert.throws(() => assertBrowserReuse(proof));
  }
});
