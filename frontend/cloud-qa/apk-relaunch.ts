import assert from 'node:assert/strict';

/** Stop only SITREP, not its shared Chrome host or any browser state. */
export function stopSitrepProcess(adb: (...args: string[]) => string) {
  const pkg = 'ar.com.ultimamilla.sitrep';
  adb('shell', 'am', 'force-stop', pkg);
  try {
    adb('shell', 'pidof', pkg);
  } catch (error) {
    // pidof exits 1 when no matching process remains. Other errors are failures.
    assert.equal((error as { status?: number }).status, 1);
    return;
  }
  throw new Error('SITREP process survived force-stop; this is not a cold app launch');
}
