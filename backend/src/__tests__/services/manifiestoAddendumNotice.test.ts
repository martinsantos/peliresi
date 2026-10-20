import { describe, expect, it, vi } from 'vitest';
import { notifyAddendumParties } from '../../services/manifiestoAddendumNotice.service';

const manifest = { id: 'manifest-qa', numero: 'QA-2026-1', generadorId: 'g', transportistaId: 't', operadorId: 'o' };
const tx = () => {
  const createMany = vi.fn().mockResolvedValue({ count: 2 });
  return {
    generador: { findUnique: vi.fn().mockResolvedValue({ usuarioId: 'generator' }) },
    transportista: { findUnique: vi.fn().mockResolvedValue({ usuarioId: 'carrier' }) },
    operador: { findUnique: vi.fn().mockResolvedValue({ usuarioId: 'operator' }) },
    notificacion: { createMany },
  };
};

describe('adenda cross-party notices', () => {
  it('notifies the other parties without copying the motive or approving for them', async () => {
    const db = tx();
    await notifyAddendumParties(db as never, manifest, 'adenda-qa', 0, 'CREADA', 'carrier');
    const notices = db.notificacion.createMany.mock.calls[0][0].data;
    expect(notices.map((notice: { usuarioId: string }) => notice.usuarioId)).toEqual(['generator', 'operator']);
    expect(notices.every((notice: { manifiestoId: string; datos: string }) => notice.manifiestoId === manifest.id && JSON.parse(notice.datos).url === '/manifiestos/manifest-qa/adendas')).toBe(true);
    expect(notices[0].mensaje).toContain('QA-2026-1');
    expect(db.notificacion.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });

  it('uses stable notice identities for a retried decision and a new identity for the next version', async () => {
    const first = tx();
    const retry = tx();
    const later = tx();
    await notifyAddendumParties(first as never, manifest, 'adenda-qa', 1, 'OBSERVADA', 'operator');
    await notifyAddendumParties(retry as never, manifest, 'adenda-qa', 1, 'OBSERVADA', 'operator');
    await notifyAddendumParties(later as never, manifest, 'adenda-qa', 2, 'APROBADA', 'operator');
    expect(first.notificacion.createMany.mock.calls[0][0].data[0].id).toBe(retry.notificacion.createMany.mock.calls[0][0].data[0].id);
    expect(first.notificacion.createMany.mock.calls[0][0].data[0].id).not.toBe(later.notificacion.createMany.mock.calls[0][0].data[0].id);
  });

  it('returns no external dispatch IDs for already committed notices on retry', async () => {
    const db = tx();
    const first = await notifyAddendumParties(db as never, manifest, 'adenda-qa', 0, 'CREADA', 'carrier');
    expect(first).toHaveLength(2);
    db.notificacion.createMany.mockResolvedValue({ count: 0 });
    expect(await notifyAddendumParties(db as never, manifest, 'adenda-qa', 0, 'CREADA', 'carrier')).toEqual([]);
  });
});
