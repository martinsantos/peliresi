import test from 'node:test';
import assert from 'node:assert/strict';
import { dismissObservedKeyboard } from './apk-keyboard.ts';

test('dismisses a positively observed keyboard once and confirms it is hidden', async () => {
  const calls: string[] = []; let visible = true;
  const result = await dismissObservedKeyboard(async () => { calls.push('read'); return `mInputShown=${visible}`; },
    async () => { calls.push('back'); visible = false; }, async () => { calls.push('wait'); });
  assert.equal(result.dismissed, true);
  assert.deepEqual(calls, ['read', 'back', 'wait', 'read']);
});
test('does not navigate Back when the keyboard is already hidden', async () => {
  const result = await dismissObservedKeyboard(async () => 'mInputShown=false',
    async () => assert.fail('must not navigate'), async () => assert.fail('must not wait'));
  assert.equal(result.dismissed, false);
});
test('unknown keyboard state never authorizes Back', async () => {
  await assert.rejects(dismissObservedKeyboard(async () => 'unavailable',
    async () => assert.fail('must not navigate'), async () => {}));
});
test('persistent keyboard fails rather than issuing repeated Back navigation', async () => {
  let taps = 0;
  await assert.rejects(dismissObservedKeyboard(async () => 'mInputShown=true',
    async () => { taps++; }, async () => {}), /remained open/);
  assert.equal(taps, 1);
});
