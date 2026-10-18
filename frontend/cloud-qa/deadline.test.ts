import test from 'node:test';
import assert from 'node:assert/strict';
import { DeadlineError, withinDeadline } from './deadline.ts';

test('returns only a completed driver result', async () => {
  assert.equal(await withinDeadline('launch', 100, async () => 'real context'), 'real context');
});
test('preserves the real operation failure instead of relabelling it', async () => {
  const failure = new Error('Chrome crashed');
  await assert.rejects(withinDeadline('launch', 100, async () => { throw failure; }), error => error === failure);
});
test('reports the exact stalled phase without silently passing or retrying', async () => {
  let attempts = 0;
  await assert.rejects(withinDeadline('restore tab', 5, () => {
    attempts++;
    return new Promise<never>(() => {});
  }), error => error instanceof DeadlineError && error.message.includes('restore tab'));
  assert.equal(attempts, 1);
});
test('late driver rejection remains handled after the deadline', async () => {
  let rejectLate!: (error: Error) => void;
  const promise = new Promise<never>((_, reject) => { rejectLate = reject; });
  await assert.rejects(withinDeadline('attach', 5, () => promise), DeadlineError);
  rejectLate(new Error('late closed socket'));
  await new Promise(resolve => setTimeout(resolve, 5));
});
