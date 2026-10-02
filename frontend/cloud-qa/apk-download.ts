import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudEnvironment } from './safety.ts';

assertCloudEnvironment();
assert.ok(process.env.QA_GITHUB_TOKEN, 'Read-only job token required for private draft asset');
assert.ok(process.env.RUNNER_TEMP);
const headers = { Authorization: `Bearer ${process.env.QA_GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
const releaseResponse = await fetch('https://api.github.com/repos/martinsantos/peliresi/releases/401766766', { headers });
assert.equal(releaseResponse.status, 200, 'Private QA draft must be readable without expanding job permissions');
const release = await releaseResponse.json();
assert.equal(release.draft, true, 'Never consume a published product release');
assert.equal(release.tag_name, 'qa-apk-isolated-20261002');
const asset = release.assets.find((item: { id: number }) => item.id === 605485727);
assert.ok(asset);
assert.equal(asset.name, 'sitrep-android-v1.0.0-2.apk');
assert.equal(asset.size, 1273070);
assert.equal(asset.url, 'https://api.github.com/repos/martinsantos/peliresi/releases/assets/605485727');
let response = await fetch(asset.url, { headers: { ...headers, Accept: 'application/octet-stream' }, redirect: 'manual' });
if (response.status === 302) {
  const destination = new URL(response.headers.get('location')!);
  assert.equal(destination.protocol, 'https:');
  assert.equal(destination.hostname, 'release-assets.githubusercontent.com');
  // Signed asset URL is never logged; authorization is not forwarded off API.
  response = await fetch(destination);
}
assert.equal(response.status, 200);
const bytes = Buffer.from(await response.arrayBuffer());
assert.equal(bytes.length, asset.size);
const sha256 = createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256, '4200e6d857e3a161e15bcfd161c44b54fc76245d8e9f4e3a093f973b06ad4bf5');
await writeFile(path.join(process.env.RUNNER_TEMP, 'sitrep-original-candidate.apk'), bytes);
await mkdir(process.env.QA_ARTIFACTS!, { recursive: true });
await writeFile(path.join(process.env.QA_ARTIFACTS!, 'apk-candidate-source.json'), JSON.stringify({
  sha256, assetId: asset.id, privateDraft: true, publicRelease: false, originalUnmodified: true,
  originalPhoneVersionConfirmed: false, size: bytes.length,
}, null, 2));
console.log('Original signed APK verified and staged on temporary VM; private draft not published');
