import { describe, expect, it } from 'vitest';
import { isTrainingActNumber } from '../../pages/inspecciones/inspectionPresentation';

describe('inspection training provenance', () => {
  it.each(['DEMO-INS-GEN-01', 'ARP-DEMO-099', 'DEMO/TEST-01', ' demO-01 '])('recognizes explicit synthetic marker %s', (value) => {
    expect(isTrainingActNumber(value)).toBe(true);
  });

  it.each(['ACTA-2026-001', '116-2025-MAG', '', null, undefined])('does not label ordinary act numbers as training: %s', (value) => {
    expect(isTrainingActNumber(value)).toBe(false);
  });
});
