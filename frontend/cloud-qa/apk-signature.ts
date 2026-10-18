import assert from 'node:assert/strict';

const productionFingerprint = '14302500ef385b217b03efd82118bbb45c68de11930fc803cc500f020e08e1d7';

/** Accept observed apksigner labels, but require a single verified debug signer. */
export function assertIsolatedApkSignature(output: string): string {
  assert.match(output, /^Verifies\r?$/m);
  assert.match(output, /^Verified using v2 scheme \(APK Signature Scheme v2\): true\r?$/m);
  assert.match(output, /^Number of signers: 1\r?$/m);
  const labels = '(?:Signer #1|V2 Signer:)';
  assert.match(output, new RegExp('^' + labels + ' certificate DN: .*CN=Android Debug\\r?$', 'm'));
  const matches = [...output.matchAll(new RegExp('^' + labels + ' certificate SHA-256 digest: ([a-fA-F0-9]{64})\\r?$', 'gm'))];
  assert.equal(matches.length, 1, 'Exactly one complete signing certificate fingerprint is required');
  const fingerprint = matches[0][1].toLowerCase();
  assert.notEqual(fingerprint, productionFingerprint, 'QA must not use the production signing identity');
  return fingerprint;
}
