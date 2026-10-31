import assert from 'node:assert/strict';
import { test } from 'node:test';
import { qaBackendEntry } from './rollback-backend.ts';

test('only the dedicated rehearsal can select one of the two fixed snapshots', () => {
  const dir = '/work/sitrep/.qa-rollback-partial-20261030';
  assert.match(qaBackendEntry({} as NodeJS.ProcessEnv), /backend\/dist\/index\.js$/);
  assert.match(qaBackendEntry({ QA_ARTIFACTS: dir, QA_COMPAT_BACKEND: '17152d81' }), /snapshot\/backend\/dist\/index\.js$/);
  assert.match(qaBackendEntry({ QA_ARTIFACTS: dir, QA_COMPAT_BACKEND: '8fb6277e' }), /snapshot-8fb\/backend\/dist\/index\.js$/);
  assert.throws(() => qaBackendEntry({ QA_ARTIFACTS: '/tmp', QA_COMPAT_BACKEND: '17152d81' }));
  assert.throws(() => qaBackendEntry({ QA_ARTIFACTS: dir, QA_COMPAT_BACKEND: '../../production' }));
  assert.match(qaBackendEntry({ QA_ARTIFACTS: '/work/sitrep/.qa-certificate-receipt-ux-20261030', QA_COMPAT_BACKEND: 'certificate-receipt-ux' }), /backend\/dist-qa-closure-d7d29dde\/index\.js$/);
  assert.throws(() => qaBackendEntry({ QA_ARTIFACTS: '/tmp', QA_COMPAT_BACKEND: 'certificate-receipt-ux' }));
  assert.match(qaBackendEntry({ QA_ARTIFACTS: '/work/sitrep/.qa-help-gps-consistency-20261030', QA_COMPAT_BACKEND: 'help-gps-consistency' }), /backend\/dist-qa-closure-d7d29dde\/index\.js$/);
  assert.throws(() => qaBackendEntry({ QA_ARTIFACTS: '/tmp', QA_COMPAT_BACKEND: 'help-gps-consistency' }));
  assert.match(qaBackendEntry({ QA_ARTIFACTS: '/work/sitrep/.qa-inspection-representative-20261030', QA_COMPAT_BACKEND: 'inspection-company' }), /backend\/dist-qa-psip-company-20261030-v2\/index\.js$/);
  assert.throws(() => qaBackendEntry({ QA_ARTIFACTS: '/tmp', QA_COMPAT_BACKEND: 'inspection-company' }));
  assert.match(qaBackendEntry({ QA_ARTIFACTS: '/work/sitrep/.qa-inspection-deadline-company-20261030', QA_COMPAT_BACKEND: 'inspection-deadline-company-before' }), /backend\/dist-qa-psip-company-20261030-v2\/index\.js$/);
  assert.throws(() => qaBackendEntry({ QA_ARTIFACTS: '/tmp', QA_COMPAT_BACKEND: 'inspection-deadline-company-before' }));
  assert.match(qaBackendEntry({ QA_ARTIFACTS: '/work/sitrep/.qa-inspection-deadline-company-20261030', QA_COMPAT_BACKEND: 'inspection-deadline-company-after' }), /backend\/dist-qa-psip-deadline-company-20261030-v3\/index\.js$/);
  assert.throws(() => qaBackendEntry({ QA_ARTIFACTS: '/tmp', QA_COMPAT_BACKEND: 'inspection-deadline-company-after' }));
});
