import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertFullE2EEvidence, type FullE2EEvidence } from './e2e-evidence.ts';

function complete(): FullE2EEvidence {
  return {
    stats: { expected: 237, unexpected: 0, flaky: 0, skipped: 0 }, errors: [],
    suites: [{ suites: ['web-desktop', 'web-responsive', 'app'].map(projectName => ({
      specs: Array.from({ length: 79 }, () => ({ tests: [{
        projectName, status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed', retry: 0 }],
      }] })),
    })) }],
  };
}

test('the complete 79 x 3 evidence is accepted without lowering the denominator', () => {
  assert.doesNotThrow(() => assertFullE2EEvidence(complete()));
});
test('the older 219-case suite cannot certify current receipt and registration flows', () => {
  const old = complete(); old.stats.expected = 219;
  for (const surface of old.suites[0].suites!) surface.specs!.splice(73);
  assert.throws(() => assertFullE2EEvidence(old));
});
test('the former 66 x 3 suite does not certify original certificates, address history or simplified ticket routing', () => {
  const old = complete(); old.stats.expected = 198;
  for (const surface of old.suites[0].suites!) surface.specs!.splice(66);
  assert.throws(() => assertFullE2EEvidence(old));
});
test('the previous 65 x 3 evidence does not certify public wizard alignment, step visibility or scroll recovery', () => {
  const old = complete(); old.stats.expected = 195;
  for (const surface of old.suites[0].suites!) surface.specs!.splice(65);
  assert.throws(() => assertFullE2EEvidence(old));
});
test('the previous 64 x 3 evidence does not certify inspection hierarchy or unoccluded save', () => {
  const old = complete(); old.stats.expected = 192;
  for (const surface of old.suites[0].suites!) surface.specs!.splice(64);
  assert.throws(() => assertFullE2EEvidence(old));
});
test('the previous 61 x 3 evidence does not certify impersonation, triage or voice', () => {
  const old = complete(); old.stats.expected = 183;
  for (const surface of old.suites[0].suites!) surface.specs!.splice(61);
  assert.throws(() => assertFullE2EEvidence(old));
});
test('an old 141-case summary and a missing case cannot be packaged', () => {
  const old = complete(); old.stats.expected = 141;
  assert.throws(() => assertFullE2EEvidence(old));
  const missing = complete(); missing.suites[0].suites![0].specs!.pop();
  assert.throws(() => assertFullE2EEvidence(missing));
});
test('the previous green 60 x 3 suite cannot certify the lost-attachment recovery journey', () => {
  const old = complete(); old.stats.expected = 180;
  for (const surface of old.suites[0].suites!) surface.specs!.pop();
  assert.throws(() => assertFullE2EEvidence(old));
});
for (const counter of ['unexpected', 'flaky', 'skipped'] as const) {
  test('rejects a nonzero ' + counter + ' counter', () => {
    const evidence = complete(); evidence.stats[counter] = 1;
    assert.throws(() => assertFullE2EEvidence(evidence));
  });
}
test('a green aggregate cannot hide a missing surface', () => {
  const evidence = complete();
  for (const suite of evidence.suites[0].suites!) {
    for (const spec of suite.specs!) spec.tests[0].projectName = 'web-desktop';
  }
  assert.throws(() => assertFullE2EEvidence(evidence));
});
test('an actual failure, expected failure or retry cannot hide under green counters', () => {
  for (const outcome of ['failed', 'expected-failure', 'retry']) {
    const evidence = complete();
    const actual = evidence.suites[0].suites![0].specs![0].tests[0];
    if (outcome === 'failed') actual.results[0].status = 'failed';
    if (outcome === 'expected-failure') actual.expectedStatus = 'failed';
    if (outcome === 'retry') actual.results.push({ status: 'passed', retry: 1 });
    assert.throws(() => assertFullE2EEvidence(evidence));
  }
});
test('a suite-level error prevents packaging', () => {
  const evidence = complete(); evidence.errors.push({ message: 'Synthetic setup failure' });
  assert.throws(() => assertFullE2EEvidence(evidence));
});
