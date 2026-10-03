import assert from 'node:assert/strict';

type Connection = { serial(): string; close(): Promise<void>; setDefaultTimeout(milliseconds: number): void };

/** Reconnect the driver, not the application: never clear or replace its profile. */
export async function renewAndroidConnection<T extends Connection>(previous: T, devices: () => Promise<T[]>): Promise<T> {
  const serial = previous.serial();
  await previous.close();
  const current = await devices();
  assert.equal(current.length, 1, 'Exactly one isolated Android device must remain connected');
  assert.equal(current[0].serial(), serial, 'Never resume against a different Android device');
  assert.notEqual(current[0], previous, 'Do not reuse a stale Android driver after process restart');
  current[0].setDefaultTimeout(25000);
  return current[0];
}
