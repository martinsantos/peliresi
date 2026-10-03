import test from 'node:test';
import assert from 'node:assert/strict';
import { renewAndroidConnection } from './android-connection.ts';

const connection = (serial='emulator-5554') => ({ serial: () => serial, close: async () => {}, setDefaultTimeout: (_: number) => {} });
test('closes the stale transport before selecting the same device; no profile operation', async () => {
  const events: string[] = [];
  const previous = { ...connection(), close: async () => { events.push('close'); } };
  const next = { ...connection(), setDefaultTimeout: (value: number) => { events.push('timeout:'+value); } };
  assert.equal(await renewAndroidConnection(previous, async () => { events.push('devices'); return [next]; }), next);
  assert.deepEqual(events, ['close', 'devices', 'timeout:25000']);
});
test('fails without retrying when transport close fails', async () => {
  let attempts=0;
  const previous={ ...connection(), close: async () => { throw new Error('ADB disconnected'); } };
  await assert.rejects(renewAndroidConnection(previous, async () => { attempts++; return [connection()]; }), /ADB disconnected/);
  assert.equal(attempts,0);
});
test('rejects missing, additional or different devices', async () => {
  for(const devices of [[],[connection(),connection()],[connection('emulator-5556')]])
    await assert.rejects(renewAndroidConnection(connection(),async()=>devices));
});
test('rejects accidental reuse of the old driver', async () => {
  const old=connection();
  await assert.rejects(renewAndroidConnection(old,async()=>[old]),/stale Android driver/);
});
