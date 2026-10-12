import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stopSitrepProcess } from './apk-relaunch.ts';
test('cold app launch stops SITREP only and proves process absence', () => {
  const calls: string[][] = [];
  stopSitrepProcess((...args) => { calls.push(args); if(args[1] === 'pidof') throw {status:1}; return ''; });
  assert.deepEqual(calls, [['shell','am','force-stop','ar.com.ultimamilla.sitrep'],['shell','pidof','ar.com.ultimamilla.sitrep']]);
});
test('surviving process cannot be counted as cold launch', () => {
  assert.throws(() => stopSitrepProcess(() => '1234'), /survived/);
});
test('device failure cannot be counted as stopped process', () => {
  assert.throws(() => stopSitrepProcess((...args) => { if(args[1] === 'pidof') throw {status:137}; return ''; }));
  assert.throws(() => stopSitrepProcess(() => { throw new Error('offline'); }), /offline/);
});
