import { sanitizeBodyForAnalytics } from '../../middlewares/analytics.middleware';

describe('analytics document privacy', () => {
  it('redacts PII, OCR and document payloads recursively', () => {
    const sanitized = sanitizeBodyForAnalytics({
      cuit: '30-12345678-9',
      datosActor: { domicilio: 'Calle 1', nombre: 'Visible metadata' },
      documento: { ocr: 'texto fiscal', referencia: 'ATM-1' },
      estado: 'PENDIENTE',
    });
    expect(JSON.stringify(sanitized)).not.toContain('30-12345678-9');
    expect(JSON.stringify(sanitized)).not.toContain('Calle 1');
    expect(JSON.stringify(sanitized)).not.toContain('texto fiscal');
    expect(sanitized.estado).toBe('PENDIENTE');
  });
});
