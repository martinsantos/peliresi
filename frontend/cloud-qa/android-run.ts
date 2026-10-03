import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase } from './safety.ts';
import { freezeCloudPlayStore, assertStableSystemPackages } from './system-packages.ts';

await assertCloudDatabase();
const baseline = freezeCloudPlayStore();
await writeFile(path.join(process.env.QA_ARTIFACTS!, 'android-system-packages.json'), JSON.stringify({ ...baseline, stable: false }, null, 2));
const results = [];
// Sequential on the one temporary emulator. Preserve functional evidence even
// when original APK staging fails, and preserve APK smoke if a flow fails.
for (const file of ['android.ts', 'apk.ts']) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', path.join('frontend/cloud-qa', file)],
    { stdio: 'inherit', timeout: 12 * 60 * 1000 });
  results.push({ file, status: result.status, error: result.error?.message, signal: result.signal });
}
await writeFile(path.join(process.env.QA_ARTIFACTS!, 'android-run.json'), JSON.stringify(results, null, 2));
// A moving Chrome/GMS version cannot certify the same tested environment.
await writeFile(path.join(process.env.QA_ARTIFACTS!, 'android-system-packages.json'), JSON.stringify(assertStableSystemPackages(baseline), null, 2));
if (results.some(item => item.status !== 0 || item.error)) process.exitCode = 1;
