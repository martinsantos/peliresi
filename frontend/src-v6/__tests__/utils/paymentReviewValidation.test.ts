import { describe, expect, it } from 'vitest';
import { validPaymentAmount, validPaymentDate } from '../../utils/paymentReviewValidation';

describe('ATM review input syntax', () => {
  it.each(['12.500,50', '12500.50', '12.500', '$ 0,01', '0.01', '999999999999.99'])('accepts supported positive amount %s', value => expect(validPaymentAmount(value)).toBe(true));
  it.each(['', '0,00', '-1', '1e3', '12,345', '1,000.50', '1000000000000', 'texto'])('rejects invalid amount %s', value => expect(validPaymentAmount(value)).toBe(false));
  it.each([['2024-02-29', true], ['2026-02-29', false], ['2026-04-31', false], ['2026-12-31', true], ['', false], ['2026-13-01', false]] as const)('checks calendar date %s', (value, valid) => expect(validPaymentDate(value)).toBe(valid));
});
