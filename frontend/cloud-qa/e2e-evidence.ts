import assert from 'node:assert/strict';

type Result = { status: string; retry: number };
type Case = { projectName: string; status: string; expectedStatus: string; results: Result[] };
type Suite = { specs?: Array<{ tests: Case[] }>; suites?: Suite[] };
export type FullE2EEvidence = {
  stats: { expected: number; unexpected: number; flaky: number; skipped: number };
  errors: unknown[];
  suites: Suite[];
};

// 79 journeys: previous 73 plus actual public registrations for all three
// actors, private duplicate feedback, real Spanish OCR and transport recovery.
// Keep exact denominators: adding a journey requires an explicit contract update.
export const FULL_E2E_JOURNEYS_PER_SURFACE = 79;
const surfaces = ['app', 'web-desktop', 'web-responsive'];

/** A green aggregate alone must not authorize an incomplete or retried release. */
export function assertFullE2EEvidence(evidence: FullE2EEvidence, scope: 'current' | 'pinned-run138' = 'current'): void {
  // Historical evidence keeps 73 journeys; only the pinned reuse guard may
  // accept it. A current release always requires the complete 79 journeys.
  const journeys = scope === 'pinned-run138' ? 73 : FULL_E2E_JOURNEYS_PER_SURFACE;
  assert.equal(evidence.stats.expected, journeys * surfaces.length);
  assert.equal(evidence.stats.unexpected + evidence.stats.flaky + evidence.stats.skipped, 0);
  assert.deepEqual(evidence.errors, []);
  const cases: Case[] = [];
  function visit(suites: Suite[]): void {
    for (const suite of suites) {
      for (const spec of suite.specs || []) cases.push(...spec.tests);
      visit(suite.suites || []);
    }
  }
  visit(evidence.suites);
  assert.equal(cases.length, evidence.stats.expected, 'Require actual cases, not only summary counters');
  assert.deepEqual([...new Set(cases.map(test => test.projectName))].sort(), surfaces);
  for (const surface of surfaces) {
    assert.equal(cases.filter(test => test.projectName === surface).length, journeys, surface);
  }
  for (const test of cases) {
    assert.equal(test.expectedStatus, 'passed', 'No expected failure or skipped business journey');
    assert.equal(test.status, 'expected');
    assert.equal(test.results.length, 1, 'Do not conceal retries in a release gate');
    assert.equal(test.results[0].status, 'passed');
    assert.equal(test.results[0].retry, 0);
  }
}
