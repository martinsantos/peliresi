import { beforeEach, describe, expect, it, vi } from 'vitest';
const lookup = vi.hoisted(() => vi.fn());
vi.mock('../../lib/prisma', () => ({ default: { usuario: { findUnique: lookup } } }));
import { verifiedImpersonator } from '../../services/impersonationIdentity.service';
describe('signed impersonation identity never grants operator privileges', () => {
  beforeEach(() => { lookup.mockReset(); lookup.mockResolvedValue({ id: 'admin', nombre: 'Administradora', rol: 'ADMIN', activo: true }); });
  it('normal sessions do not query an impersonator or manufacture one', async () => {
    expect(await verifiedImpersonator(undefined, 'actor')).toBeUndefined(); expect(lookup).not.toHaveBeenCalled();
  });
  it('validates a signed operator against the live administrator account', async () => {
    expect(await verifiedImpersonator('admin', 'actor')).toEqual({ id: 'admin', nombre: 'Administradora' });
    expect(lookup).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'admin' } }));
  });
  it.each([null, 42, '', {}, 'actor'])('rejects invalid/self operator claims %s before any lookup', async claim => {
    await expect(verifiedImpersonator(claim, 'actor')).rejects.toMatchObject({ statusCode: 401 }); expect(lookup).not.toHaveBeenCalled();
  });
  it('rejects restricted sessions and disabled or downgraded original administrators', async () => {
    await expect(verifiedImpersonator('admin', 'actor', true)).rejects.toMatchObject({ statusCode: 401 });
    for (const record of [null, { id: 'admin', activo: false, rol: 'ADMIN' }, { id: 'admin', activo: true, rol: 'ADMIN_GENERADOR' }]) {
      lookup.mockResolvedValue(record); await expect(verifiedImpersonator('admin', 'actor')).rejects.toMatchObject({ statusCode: 401 });
    }
  });
});
