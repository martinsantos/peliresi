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
});
