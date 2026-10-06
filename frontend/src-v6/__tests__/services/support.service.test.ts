import { beforeEach, describe, expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('../../services/api', () => ({ default: calls }));
import { supportService, supportError } from '../../services/support.service';
describe('native support API client', () => {
  beforeEach(() => { vi.clearAllMocks(); calls.post.mockResolvedValue({ data: { data: { id: 'ticket' } } }); calls.get.mockResolvedValue({ data: { data: [] } }); });
  it('keeps the same request key and real multipart files without owner or role fields', async () => {
    const file = new File(['image'], 'evidencia.png');
    const input = { asunto: 'Fallo GPS', descripcion: 'No muestra el marcador.', categoria: 'GPS' as const, contexto: { ruta: '/transporte/viaje/one' } };
    await supportService.create(input, [file], 'request123');
    await supportService.create(input, [file], 'request123');
    for (const [url, form, config] of calls.post.mock.calls) {
      expect(url).toBe('/soporte'); expect(form.getAll('files')).toEqual([file]);
      expect(form.has('usuarioId')).toBe(false); expect(form.has('rol')).toBe(false);
      expect(config.headers).toEqual({ 'Content-Type': undefined, 'Idempotency-Key': 'request123' });
    }
  });
  it('sends an explicit version and distinguishes an internal note from a response', async () => {
    await supportService.act('ticket', { accion: 'NOTA', cuerpo: 'Dato reservado de soporte', version: 7 }, [], 'action123');
    const [url, form] = calls.post.mock.calls[0];
    expect(url).toBe('/soporte/ticket/acciones'); expect(form.get('accion')).toBe('NOTA'); expect(form.get('version')).toBe('7');
  });
  it('checks an uncertain creation through a private owner-scoped endpoint', async () => {
    await supportService.sent('original_key'); expect(calls.get).toHaveBeenCalledWith('/soporte/envios/original_key');
  });
  it('does not claim a successful send on timeout', () => {
    expect(supportError(new Error('timeout'))).toMatch(/No se confirmó/);
    expect(supportError({ response: { status: 409, data: { message: 'El ticket cambió' } } })).toBe('El ticket cambió');
  });
});
