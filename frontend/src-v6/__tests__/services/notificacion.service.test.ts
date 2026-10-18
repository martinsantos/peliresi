import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notificacionService } from '../../services/notificacion.service';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../services/api', () => ({ default: api }));

describe('notification pagination and real counts', () => {
  beforeEach(() => { api.get.mockReset(); });

  it('translates the second page to the server offset and retains totals', async () => {
    api.get.mockResolvedValue({ data: { data: { notificaciones: [{ id: 'older' }], total: 45, noLeidas: 31, pagina: 2, totalPaginas: 3 } } });
    const result = await notificacionService.list({ page: 2, limit: 20, leida: false });
    expect(api.get).toHaveBeenCalledWith('/notificaciones', { params: { offset: 20, limit: 20, leida: false } });
    expect(result).toEqual({ items: [{ id: 'older' }], total: 45, noLeidas: 31, page: 2, limit: 20, totalPages: 3 });
  });

  it('matches the server default rather than inventing a 100-item page', async () => {
    api.get.mockResolvedValue({ data: { data: { notificaciones: [], total: 0, noLeidas: 0, pagina: 1, totalPaginas: 0 } } });
    expect(await notificacionService.list()).toEqual({ items: [], total: 0, noLeidas: 0, page: 1, limit: 20, totalPages: 0 });
    expect(api.get).toHaveBeenCalledWith('/notificaciones', { params: { offset: 0, limit: 20 } });
  });

  it('does not turn a failed unread-count request into a reassuring zero', async () => {
    api.get.mockRejectedValue(new Error('offline'));
    await expect(notificacionService.getNoLeidas()).rejects.toMatchObject({ message: 'offline' });
  });
});
