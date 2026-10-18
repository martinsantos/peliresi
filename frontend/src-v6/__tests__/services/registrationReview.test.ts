import { describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ post: vi.fn().mockResolvedValue({ data: { data: { solicitud: { id: 'qa' } } } }) }));
vi.mock('../../services/api', () => ({ default: mock }));
import { solicitudService } from '../../services/solicitud.service';

describe('registration observation reaches the actual backend contract', () => {
  it('sends observations under the expected field and preserves their text', async () => {
    await solicitudService.observar('qa', 'Adjuntar la habilitación vigente.');
    expect(mock.post).toHaveBeenCalledWith('/solicitudes/qa/observar', { observaciones: 'Adjuntar la habilitación vigente.' });
  });
});
