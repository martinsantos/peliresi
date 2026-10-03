import test from 'node:test';
import assert from 'node:assert/strict';
import { LogTail, startSystemLog } from './system-log.ts';

test('retains a diagnostic tail with an explicit truncation ledger', () => {
  const tail = new LogTail(8); tail.add('first'); tail.add('second');
  assert.deepEqual(tail.snapshot(), { text: 'stsecond', totalBytes: 11, retainedBytes: 8, truncated: true });
});
test('a large chunk cannot bypass the byte cap', () => {
  const tail = new LogTail(16); tail.add(Buffer.alloc(100000, 'a')); tail.add('end');
  assert.equal(tail.snapshot().retainedBytes, 16); assert.equal(tail.snapshot().totalBytes, 100003);
  assert.equal(tail.snapshot().text, 'a'.repeat(13) + 'end');
});
test('measures UTF8 bytes, not character counts', () => {
  const tail = new LogTail(32); tail.add('inspección');
  assert.equal(tail.snapshot().retainedBytes, Buffer.byteLength('inspección'));
  assert.equal(tail.snapshot().truncated, false);
});
test('refuses invalid capacities and cannot start local ADB', async () => {
  for (const cap of [0, -1, 2.5, Infinity, 2097153]) assert.throws(() => new LogTail(cap));
  const previous = process.env.GITHUB_ACTIONS;
  process.env.GITHUB_ACTIONS = 'false';
  try { await assert.rejects(startSystemLog('/tmp/not-started'), /ERR_ASSERTION|AssertionError/); }
  finally {
    if (previous === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = previous;
  }
});
