import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSeed } from './load-seed.ts';

test('load the canonical seed from the frontend ESM entry without executing database writes', () => {
  const module = loadSeed();
  assert.equal(typeof module.seedNightDatabase, 'function');
  assert.equal(typeof module.assertNightDatabase, 'function');
  assert.equal(module.qaEmail('probe'), 'probe@night-qa.invalid');
  assert.equal(module.qaPassword, 'OnlyLocal-NightQA-2026!');
});
