import { beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn() }));
vi.mock('../../services/api', () => ({ default: api }));
import { actoresService } from '../../services/actores.service';
const actor = { id: 'qa-saved', razonSocial: 'QA Transporte', cuit: '30-00000000-1', vehiculos: [], choferes: [] };
beforeEach(() => vi.clearAllMocks());
describe('transport registration response matches the actual HTTP envelope', () => {
  it.each(['create', 'update'] as const)('%s exposes the saved ID from data.transportista, preserving nested fleet', async operation => {
    api.post.mockResolvedValue({ data: { success: true, data: { transportista: actor } } });
    api.put.mockResolvedValue({ data: { success: true, data: { transportista: actor } } });
    const result = operation === 'create' ? await actoresService.createTransportista({ razonSocial: actor.razonSocial } as never)
      : await actoresService.updateTransportista(actor.id, { razonSocial: actor.razonSocial });
    expect(result).toEqual(actor); expect(result.id).toBe('qa-saved');
    expect(operation === 'create' ? api.post : api.put).toHaveBeenCalledOnce();
  });
  it.each(['create', 'update'] as const)('%s preserves legacy flat responses without losing the saved actor', async operation => {
    api.post.mockResolvedValue({ data: { data: actor } }); api.put.mockResolvedValue({ data: { data: actor } });
    expect(operation === 'create' ? await actoresService.createTransportista({} as never)
      : await actoresService.updateTransportista(actor.id, {})).toEqual(actor);
  });
});
