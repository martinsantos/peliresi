import { describe, expect, it, vi } from 'vitest';
const captured = vi.hoisted(() => vi.fn());
vi.mock('../../services/api', async () => {
  const { default: axios } = await import('axios');
  return { default: axios.create({ headers: { 'Content-Type': 'application/json' }, adapter: async config => {
    captured(config); return { status: 201, statusText: 'Created', headers: {}, config, data: { success: true, data: { documento: { id: 'qa-document' } } } };
  } }) };
});
import { transportistaDocumentoService } from '../../services/generador-fiscal.service';
describe('transport receipt upload preserves the actual file instead of Axios JSON conversion', () => {
  it('passes multipart File, type and year through the same JSON-default transform chain as the real API client', async () => {
    const file = new File(['%PDF-QA'], 'Recibo-QA.pdf', { type: 'application/pdf' });
    expect(await transportistaDocumentoService.upload('qa-actor', file, 'COMPROBANTE_PAGO', 2026)).toEqual({ id: 'qa-document' });
    const config = captured.mock.calls[0][0];
    expect(config.data).toBeInstanceOf(FormData);
    expect(config.data.get('archivo')).toBe(file); expect(config.data.get('tipo')).toBe('COMPROBANTE_PAGO'); expect(config.data.get('anio')).toBe('2026');
    expect(config.headers.get('Content-Type')).toBe('multipart/form-data');
  });
});
