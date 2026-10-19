import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ list: vi.fn(), count: vi.fn(), scope: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { manifiesto: { findMany: mocks.list, count: mocks.count } } }));
vi.mock('../../utils/roleFilter', () => ({ applyRoleFilter: mocks.scope, canAccessManifiesto: vi.fn() }));

import { getManifiestos } from '../../controllers/manifiesto-query.controller';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([]);
  mocks.count.mockResolvedValue(0);
});

describe('manifest phase filters', () => {
  it.each([
    ['pendientes', ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO']],
    ['en_curso', ['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO']],
    ['terminados', ['TRATADO', 'RECHAZADO', 'CANCELADO']],
    ['post_entrega', ['ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO', 'RECHAZADO', 'CANCELADO']],
  ])('queries the full %s group before pagination and role scoping', async (fase, states) => {
    const json = vi.fn();
    const next = vi.fn();
    await getManifiestos({ query: { fase }, user: { id: 'actor' } } as never, { json } as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(mocks.scope).toHaveBeenCalledOnce();
    expect(mocks.list.mock.calls[0][0].where.estado).toEqual({ in: states });
    expect(mocks.count.mock.calls[0][0].where.estado).toEqual({ in: states });
    if (fase === 'post_entrega') {
      expect(mocks.list.mock.calls[0][0].where.fechaEntrega).toEqual({ not: null });
      expect(mocks.list.mock.calls[0][0].orderBy).toEqual({ fechaEntrega: 'desc' });
    }
    expect(json).toHaveBeenCalledOnce();
  });

  it('rejects an unknown phase without querying a manifest', async () => {
    const next = vi.fn();
    await getManifiestos({ query: { fase: 'whatever' }, user: { id: 'actor' } } as never, { json: vi.fn() } as never, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
