import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { post: mocks.post } }));

import { inspeccionService } from '../../services/inspeccion.service';

describe('inspeccionService evidence upload', () => {
  beforeEach(() => {
    mocks.post.mockReset();
    mocks.post.mockResolvedValue({ data: { data: { id: 'evidence-1' } } });
  });

  it('sends the checklist item and comment context with the image', async () => {
    const file = new File(['image-bytes'], 'hallazgo.png', { type: 'image/png' });

    await inspeccionService.uploadEvidence('inspection-1', file, {
      itemId: 'item-1',
      descripcion: 'Falta la señalización reglamentaria',
    });

    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [url, form, config] = mocks.post.mock.calls[0] as [string, FormData, unknown];
    expect(url).toBe('/inspecciones/inspection-1/evidencias');
    expect(form.get('file')).toBe(file);
    expect(form.get('itemId')).toBe('item-1');
    expect(form.get('descripcion')).toBe('Falta la señalización reglamentaria');
    expect(config).toBeUndefined();
  });
});
