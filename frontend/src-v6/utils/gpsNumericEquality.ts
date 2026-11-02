/**
 * PostgreSQL/driver round trips can change the least significant bits of a
 * floating point input. Compare at that scale only; the point reference,
 * manifest, sender and leg must still be checked independently.
 *
 * Sixteen adjacent IEEE-754 values at GPS-coordinate magnitudes are less
 * than a tenth of a micrometre. This is not a spatial proximity test.
 */
const MAX_ROUNDTRIP_ULPS = 16n;
const SIGN = 1n << 63n;
const MASK = (1n << 64n) - 1n;

function orderedBits(value: number): bigint {
  const buffer = new DataView(new ArrayBuffer(8));
  buffer.setFloat64(0, value, false);
  const bits = buffer.getBigUint64(0, false);
  // Both signed zero values occupy the same position in the ordering.
  return (bits & SIGN) !== 0n ? (~bits & MASK) + 1n : bits | SIGN;
}

export function sameGpsNumber(stored: unknown, expected: unknown): boolean {
  if (typeof stored !== 'number' || typeof expected !== 'number'
    || !Number.isFinite(stored) || !Number.isFinite(expected)) return false;
  if (stored === expected) return true;
  const a = orderedBits(stored), b = orderedBits(expected);
  return (a > b ? a - b : b - a) <= MAX_ROUNDTRIP_ULPS;
}

export function sameOptionalGpsNumber(stored: unknown, expected: unknown): boolean {
  if (stored == null || expected == null) return stored == null && expected == null;
  return sameGpsNumber(stored, expected);
}
