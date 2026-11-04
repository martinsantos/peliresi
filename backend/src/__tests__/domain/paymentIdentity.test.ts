import { describe, expect, it } from 'vitest';
import { decimalAmount, normalizePaymentIdentity, paymentIdentifier, paymentKeys, paymentProposal } from '../../domain/paymentIdentity';
const input = { emisor: 'ATM_TASAS', idComprobante: '00-123.456', transaccion: '009876', control: 'QA-987', cuit: '30-90000001-1', codigoTasa: '00162', fechaPago: '20/10/2026', importe: '12.345,60', periodo: 'Inscripción 2026', referenciaLiquidacion: 'QA-ALTA-1', originalRevisado: true };
describe('ATM identity, not a picture or a tax assessment', () => {
  it('normalizes only explicit identifiers, a calendar date and an exact decimal amount', () => {
    expect(normalizePaymentIdentity(input, '30900000011')).toMatchObject({ idComprobante: '123456', transaccion: '9876', control: 'QA987', cuit: '30900000011', codigoTasa: '162', fechaPago: '2026-10-20', importe: '12345.60' });
  });
  it.each(['idComprobante', 'codigoTasa', 'fechaPago', 'importe', 'periodo', 'referenciaLiquidacion'])('does not accept a missing %s as an allocated payment', key => {
    expect(() => normalizePaymentIdentity({ ...input, [key]: '' }, input.cuit)).toThrow();
  });
  it.each([null, false, 'true'])('requires an explicit original review, not %j', originalRevisado => {
    expect(() => normalizePaymentIdentity({ ...input, originalRevisado }, input.cuit)).toThrow();
  });
  it('does not let a substituted beneficiary allocate the payment', () => {
    expect(() => normalizePaymentIdentity(input, '30900000022')).toThrow(/CUIT/);
  });
  it('does not accept another issuer namespace or an object in a text field', () => {
    expect(() => normalizePaymentIdentity({ ...input, emisor: 'OTRO' }, input.cuit)).toThrow();
    expect(() => normalizePaymentIdentity({ ...input, importe: { amount: 1 } }, input.cuit)).toThrow();
  });
  it.each(['31/02/2026', '2026-13-01', 'ayer'])('rejects nonexistent or ambiguous dates %s', fechaPago => {
    expect(() => normalizePaymentIdentity({ ...input, fechaPago }, input.cuit)).toThrow();
  });
  it.each(['-1', 'NaN', '1e5', '1,234,56', '12.34.56', '0'])('rejects an invalid/nonpositive amount %s', importe => {
    expect(() => normalizePaymentIdentity({ ...input, importe }, input.cuit)).toThrow();
  });
  it.each([['12500', '12500.00'], ['1.234,5', '1234.50'], ['12.345', '12345.00'], ['1234.56', '1234.56']])('reads exact decimal %s without floating point', (raw, value) => expect(decimalAmount(raw)).toBe(value));
  it('uses the same unique aliases despite another beneficiary, date, amount, period or reference', () => {
    const value = normalizePaymentIdentity(input, input.cuit), changed = { ...value, cuit: '20999999999', fechaPago: '2027-01-01', importe: '1.00', periodo: '2027', referenciaLiquidacion: 'OTHER' };
    expect(paymentKeys(changed)).toEqual(paymentKeys(value));
    expect(paymentKeys(value)).toHaveLength(2); expect(paymentKeys(value).every(key => /^[a-f0-9]{64}$/.test(key))).toBe(true);
  });
  it('retains the operation alias when somebody edits the printed receipt ID', () => {
    const value = normalizePaymentIdentity(input, input.cuit);
    expect(paymentKeys({ ...value, idComprobante: 'OTHER' }).filter(key => paymentKeys(value).includes(key))).toHaveLength(1);
  });
  it('extracts labelled original fields and never treats a bank account/card number as an ID', () => {
    const value = paymentProposal('ATM Administración Tributaria Mendoza\nID Comprobante: 001234\nTransacción: 009876\nControl: QA-987\nCUIT: 30-90000001-1\nCódigo de Tasa: 162\nFecha Pago: 20/10/2026\nIMPORTE TOTAL: $12.345,60\nTarjeta: 987654321');
    expect(value.conflictos).toEqual([]); expect(value.campos).toMatchObject({ emisor: 'ATM_TASAS', idComprobante: '1234', importe: '12345.60', fechaPago: '2026-10-20' });
    expect(paymentProposal('ATM\nTarjeta 123456\nCBU 9000000000000000000000').campos.idComprobante).toBeUndefined();
  });
  it('does not choose between contradictory receipt IDs or correct OCR O into zero', () => {
    const value = paymentProposal('ATM\nID Comprobante: 1234\nID Comprobante: 5678');
    expect(value.campos.idComprobante).toBeUndefined(); expect(value.conflictos).toContain('idComprobante');
    expect(paymentIdentifier('O0123')).toBe('O0123');
  });
});
