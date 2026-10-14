import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertIsolatedApkSignature } from './apk-signature.ts';

const fingerprint = 'a'.repeat(64);
const fixture = (label: string) => [
  'Verifies',
  'Verified using v2 scheme (APK Signature Scheme v2): true',
  'Number of signers: 1',
  label + ' certificate DN: C=US, O=Android, CN=Android Debug',
  label + ' certificate SHA-256 digest: ' + fingerprint,
].join('\n');

for (const label of ['Signer #1', 'V2 Signer:']) {
  test('recognizes verified debug certificate with observed label ' + label, () => {
    assert.equal(assertIsolatedApkSignature(fixture(label)), fingerprint);
  });
}
test('rejects unverified, release, multiple or malformed signing identities', () => {
  for (const output of [
    fixture('V2 Signer:').replace(': true', ': false'),
    fixture('V2 Signer:').replace('Number of signers: 1', 'Number of signers: 2'),
    fixture('V2 Signer:').replace('CN=Android Debug', 'CN=Release'),
    fixture('V2 Signer:').replace(fingerprint, 'abc'),
    fixture('V2 Signer:').replace(fingerprint, '14302500ef385b217b03efd82118bbb45c68de11930fc803cc500f020e08e1d7'),
    fixture('V2 Signer:') + '\nV2 Signer: certificate SHA-256 digest: ' + fingerprint,
  ]) assert.throws(() => assertIsolatedApkSignature(output));
});
