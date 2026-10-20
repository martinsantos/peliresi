import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), transaction: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { inspeccion: { findMany: db.findMany, count: db.count, groupBy: db.groupBy }, $transaction: db.transaction } }));
import { listarInspecciones } from '../../controllers/inspeccion.controller';

describe('PSIP multi-state filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.transaction.mockResolvedValue([[], 42, [{ estado: 'NOTIFICADA', _count: { estado: 42 } }], 42]);
  });
  async function list(query: Record<string, unknown>, rol = 'ADMIN') {
    const res = { json: vi.fn() }; const next = vi.fn();
    await listarInspecciones({ query, user: { id: 'qa', rol } } as never, res as never, next);
    return { res, next };
  }
  it('filters the database before pagination and counts, while summaries retain their global scope', async () => {
    const { res, next } = await list({ estados: 'NOTIFICADA,EN_DESCARGO,REQUIERE_SUBSANACION', page: '2', limit: '25' });
    expect(next).not.toHaveBeenCalled();
    expect(db.findMany.mock.calls[0][0]).toMatchObject({ where: { estado: { in: ['NOTIFICADA', 'EN_DESCARGO', 'REQUIERE_SUBSANACION'] } }, skip: 25, take: 25 });
    expect(db.count.mock.calls[0][0].where).toEqual(db.findMany.mock.calls[0][0].where);
    expect(db.groupBy.mock.calls[0][0].where.estado).toBeUndefined();
    expect(res.json.mock.calls[0][0].data).toMatchObject({ total: 42, totalPages: 2 });
  });
  it('intersects an exact state with the group, never widening a sector scope', async () => {
    await list({ estados: 'NOTIFICADA,EN_DESCARGO', estado: 'NOTIFICADA', tipoActor: 'OPERADOR' }, 'ADMIN_GENERADOR');
    expect(db.findMany.mock.calls[0][0].where).toMatchObject({ tipoActor: 'GENERADOR', estado: { in: ['NOTIFICADA'] } });
  });
  it('returns zero states for contradictory filters', async () => {
    await list({ estados: 'NOTIFICADA,EN_DESCARGO', estado: 'EN_CAMPO' });
    expect(db.findMany.mock.calls[0][0].where.estado).toEqual({ in: [] });
  });
  it.each(['NOTIFICADA,INVENTADA', '', ['NOTIFICADA']])('rejects malformed multi-state input %s', async (estados) => {
    const { next } = await list({ estados });
    expect(next).toHaveBeenCalledOnce();
    expect(db.findMany).not.toHaveBeenCalled();
  });
  it('preserves the original exact-state filter when no group is sent', async () => {
    await list({ estado: 'EN_CAMPO' });
    expect(db.findMany.mock.calls[0][0].where.estado).toBe('EN_CAMPO');
  });
  it('counts live deadlines only on unanswered dated requests, not the dossier reference date', async () => {
    await list({ estados: 'NOTIFICADA,EN_DESCARGO,REQUIERE_SUBSANACION' });
    const where = db.count.mock.calls[1][0].where;
    expect(where).not.toHaveProperty('plazoRespuestaAt');
    expect(where.intercambios.some).toMatchObject({ tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', destinatario: 'INSPECCIONADO',
      plazoRespuestaAt: { gte: expect.any(Date) }, respuestas: { none: { parte: 'INSPECCIONADO', tipo: { in: ['RESPUESTA', 'DESCARGO', 'SUBSANACION'] } } } });
  });
  it('returns a privacy-limited pending summary without shipping all exchanges in list rows', async () => {
    db.transaction.mockResolvedValue([[{ id: 'a', estado: 'EN_DESCARGO', intercambios: [
      { id: 'request', secuencia: 1, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', destinatario: 'INSPECCIONADO', respondeAId: null, plazoRespuestaAt: null },
    ] }], 1, [], 0]);
    const { res, next } = await list({});
    expect(next).not.toHaveBeenCalled();
    const row = res.json.mock.calls[0][0].data.items[0];
    expect(row.seguimiento).toEqual({ paso: 'RESPONDER', pendientes: [{ id: 'request', secuencia: 1, plazoRespuestaAt: null }] });
    expect(row).not.toHaveProperty('intercambios');
  });
});
